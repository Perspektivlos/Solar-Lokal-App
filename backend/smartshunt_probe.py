"""Einmaliger lokaler Read-only-Prüflauf für Venus OS battery/290."""
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

import paho.mqtt.client as mqtt

from mqtt_client import _parse_mqtt_payload
from smartshunt import (
    COUNTER_PATHS,
    SMARTSHUNT_INSTANCE,
    build_smartshunt_state,
    ingest_smartshunt_value,
    is_valid_telemetry_value,
    unavailable_smartshunt,
)


_probe_lock = threading.Lock()


def _failed_result(reason: str, topic_base: str, started: float, checks=None) -> Dict[str, Any]:
    state = unavailable_smartshunt(reason)
    visible_checks = list(checks or [{"id": "prerequisite", "label": "Prüfvoraussetzung", "ok": False, "detail": reason}])
    if not any(check.get("id") == "read-only" for check in visible_checks):
        visible_checks.append({"id": "read-only", "label": "Keine W/-Steuerbefehle", "ok": True, "detail": "Keine Gerätebefehle gesendet"})
    return {
        "probe_id": str(uuid.uuid4()),
        "tested_at": datetime.now(timezone.utc).isoformat(),
        "passed": False,
        "read_only": True,
        "instance": SMARTSHUNT_INSTANCE,
        "topic_base": topic_base,
        "duration_ms": round((time.monotonic() - started) * 1000),
        "message_count": 0,
        "field_count": 0,
        "checks": visible_checks,
        "current": state,
    }


def probe_smartshunt(cfg_mqtt: Dict[str, Any], vrm_id: str, timeout_seconds: float = 10.0) -> Dict[str, Any]:
    started = time.monotonic()
    topic_base = f"N/{vrm_id or '<Portal-ID>'}/battery/{SMARTSHUNT_INSTANCE}/"
    if not _probe_lock.acquire(blocking=False):
        return _failed_result("Ein SmartShunt-Prüflauf ist bereits aktiv", topic_base, started)
    client = None
    connected = False
    messages = 0
    raw: Dict[str, Any] = {}
    error = None
    complete = threading.Event()
    try:
        host = str(cfg_mqtt.get("host") or "").strip()
        port = int(cfg_mqtt.get("port") or 1883)
        if not host:
            return _failed_result("Kein MQTT-Host konfiguriert", topic_base, started)
        if not vrm_id:
            return _failed_result("Keine Venus-OS-Portal-ID konfiguriert", topic_base, started)
        try:
            with socket.create_connection((host, port), timeout=min(4.0, timeout_seconds)):
                pass
        except Exception as exc:
            return _failed_result(f"MQTT-Broker nicht erreichbar ({type(exc).__name__})", topic_base, started, [
                {"id": "broker", "label": "MQTT-Broker erreichbar", "ok": False, "detail": type(exc).__name__},
                {"id": "read-only", "label": "Keine W/-Steuerbefehle", "ok": True, "detail": "Keine Gerätebefehle gesendet"},
            ])

        client = mqtt.Client(client_id=f"solar-smartshunt-probe-{uuid.uuid4().hex[:8]}")
        if cfg_mqtt.get("username"):
            client.username_pw_set(cfg_mqtt["username"], cfg_mqtt.get("password", ""))

        def on_connect(client_, userdata, flags, rc):
            nonlocal connected, error
            if int(rc) != 0:
                error = f"MQTT-Anmeldung abgelehnt (rc={rc})"
                complete.set()
                return
            connected = True
            client_.subscribe(f"{topic_base}#", qos=0)
            client_.publish(f"R/{vrm_id}/keepalive", "", qos=0)

        def on_message(client_, userdata, message):
            nonlocal messages
            if not message.topic.startswith(topic_base):
                return
            path = message.topic[len(topic_base):]
            value = _parse_mqtt_payload(message.payload)
            ingest_smartshunt_value(raw, path, value, datetime.now(timezone.utc).isoformat())
            messages += 1
            required = ("ProductName", "DeviceInstance", "Connected", "Mgmt/Connection", "Dc/0/Voltage", "Dc/0/Current", "Dc/0/Power", "Soc")
            history_present = any(path_name in raw for path_name in COUNTER_PATHS.values())
            if all(path_name in raw for path_name in required) and history_present:
                complete.set()

        def on_disconnect(client_, userdata, rc):
            nonlocal connected
            connected = False

        client.on_connect = on_connect
        client.on_message = on_message
        client.on_disconnect = on_disconnect
        client.connect(host, port, keepalive=20)
        client.loop_start()
        complete.wait(timeout=max(2.0, min(float(timeout_seconds), 15.0)))
        state = build_smartshunt_state(raw, mqtt_connected=connected)
        identity_checks = state.get("identity", {}).get("checks", {})
        required_live_paths = ("Dc/0/Voltage", "Dc/0/Current", "Dc/0/Power", "Soc")
        live_ok = all(is_valid_telemetry_value(raw.get(path)) for path in required_live_paths)
        history_count = len(state.get("device_history") or {})
        checks = [
            {"id": "broker", "label": "MQTT-Broker erreichbar", "ok": True, "detail": "TCP-Verbindung hergestellt"},
            {"id": "mqtt", "label": "MQTT-Verbindung", "ok": connected, "detail": error or ("Broker verbunden" if connected else "Verbindung getrennt")},
            {"id": "topic", "label": "battery/290 empfangen", "ok": messages > 0, "detail": f"{messages} Nachrichten · {len(state.get('raw') or {})} Felder"},
            {"id": "product", "label": "Produktname SmartShunt", "ok": bool(identity_checks.get("product")), "detail": state.get("identity", {}).get("product_name") or "nicht empfangen"},
            {"id": "instance", "label": "VRM-Instanz 290", "ok": bool(identity_checks.get("instance")), "detail": str(state.get("identity", {}).get("device_instance") or "nicht empfangen")},
            {"id": "connection", "label": "USB / VE.Direct", "ok": bool(identity_checks.get("connection")), "detail": state.get("identity", {}).get("connection") or "nicht empfangen"},
            {"id": "connected", "label": "Connected=1", "ok": bool(identity_checks.get("connected")), "detail": f"Connected={state.get('identity', {}).get('connected', '–')}"},
            {"id": "telemetry", "label": "Pflichtmesswerte vollständig", "ok": live_ok, "detail": "Spannung · Strom · Leistung · SoC"},
            {"id": "freshness", "label": "Messwerte aktuell", "ok": state.get("status") == "current", "detail": state.get("status_reason") or "nicht verfügbar"},
            {"id": "history", "label": "Native Gerätezähler", "ok": history_count > 0, "detail": f"{history_count} Zähler übernommen"},
            {"id": "read-only", "label": "Keine W/-Steuerbefehle", "ok": True, "detail": "Nur N/ gelesen und R/keepalive angefordert"},
        ]
        passed = all(check["ok"] for check in checks)
        return {
            "probe_id": str(uuid.uuid4()),
            "tested_at": datetime.now(timezone.utc).isoformat(),
            "passed": passed,
            "read_only": True,
            "instance": SMARTSHUNT_INSTANCE,
            "topic_base": topic_base,
            "duration_ms": round((time.monotonic() - started) * 1000),
            "message_count": messages,
            "field_count": len(state.get("raw") or {}),
            "checks": checks,
            "current": state,
        }
    except Exception as exc:
        detail = type(exc).__name__
        return _failed_result(
            f"MQTT-Verbindung fehlgeschlagen ({detail})",
            topic_base,
            started,
            [
                {"id": "broker", "label": "MQTT-Broker erreichbar", "ok": True, "detail": "TCP-Verbindung hergestellt"},
                {"id": "mqtt", "label": "MQTT-Verbindung", "ok": False, "detail": detail},
                {"id": "read-only", "label": "Keine W/-Steuerbefehle", "ok": True, "detail": "Keine Gerätebefehle gesendet"},
            ],
        )
    finally:
        if client is not None:
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                pass
        _probe_lock.release()