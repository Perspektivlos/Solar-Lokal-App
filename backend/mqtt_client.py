"""MQTT subscriber & parsing for the Solar Local Dashboard.

Self-contained module that owns the live MQTT data store (`_mqtt_data`),
connection state (`_mqtt_state`), the per-device topic handlers and the
`fetch_*_from_mqtt` accessors consumed by the aggregator in `server.py`.

The two dicts `_mqtt_data` and `_mqtt_state` are mutated in place (never
reassigned), so importers can bind them by reference and read live values.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    import paho.mqtt.client as mqtt
except Exception:  # pragma: no cover
    mqtt = None

logger = logging.getLogger("solar.mqtt")


# ---------- Live data store ----------

_mqtt_data: Dict[str, Any] = {
    "ahoy":   {"raw": {}, "_ts": None},
    "shelly": {"phases": [], "total_power": 0.0, "online": False, "_ts": None},
    "trucki": {"raw": {}, "_ts": None},
    "victron": {
        "instances": {},   # {288: {"Pv/V":..., "Yield/Power":..., "_ts": iso}}
        "system": {},      # battery_voltage, grid_power per phase, consumption, etc.
        "grid": {},        # Ac/Power, Ac/Lx/Power, ...
        "_ts": None,
    },
    "last_msg": None,
}

_mqtt_state: Dict[str, Any] = {"connected": False, "last_error": None, "messages": 0, "client": None}

_VICTRON_STATE_NAMES = {
    0: "Off", 1: "Low Power", 2: "Fault", 3: "Bulk",
    4: "Absorption", 5: "Float", 6: "Storage", 7: "Equalize",
    245: "Wakeup", 247: "Auto-equalize", 252: "Ext. control",
}


def _parse_mqtt_payload(payload: bytes) -> Any:
    text = payload.decode("utf-8", errors="ignore").strip()
    if not text:
        return None
    # Try JSON first (Victron + Shelly + Ahoy 'total' use JSON)
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "value" in obj and len(obj) <= 2:
            return obj["value"]
        return obj
    except Exception:
        pass
    # Plain numeric (Trucki)
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text


# ---------- Per-device topic handlers ----------

def _handle_victron_topic(topic: str, payload: bytes, now_iso: str) -> None:
    parts = topic.split("/")
    if len(parts) < 5:
        return
    service = parts[2]
    inst_raw = parts[3]
    path = "/".join(parts[4:])
    value = _parse_mqtt_payload(payload)
    _mqtt_data["victron"]["_ts"] = now_iso
    if service == "solarcharger":
        try:
            inst = int(inst_raw)
        except ValueError:
            return
        st = _mqtt_data["victron"]["instances"].setdefault(inst, {})
        st[path] = value
        st["_ts"] = now_iso
    elif service == "system" and inst_raw == "0":
        _mqtt_data["victron"]["system"][path] = value
    elif service == "grid":
        _mqtt_data["victron"]["grid"][path] = value


def _handle_shelly_topic(topic: str, payload: bytes, now_iso: str) -> None:
    sub = topic[len("venus/grid/shellypro/"):]
    if sub == "status/em:0":
        try:
            obj = json.loads(payload.decode("utf-8", errors="ignore"))
        except Exception as e:
            logger.debug(f"shelly mqtt parse: {e}")
            return
        phases = []
        for i, ch in enumerate(["a", "b", "c"]):
            phases.append({
                "phase": f"L{i+1}",
                "power": float(obj.get(f"{ch}_act_power", 0) or 0),
                "voltage": float(obj.get(f"{ch}_voltage", 0) or 0),
                "current": float(obj.get(f"{ch}_current", 0) or 0),
                "pf": float(obj.get(f"{ch}_pf", 0) or 0),
            })
        _mqtt_data["shelly"]["phases"] = phases
        _mqtt_data["shelly"]["total_power"] = float(
            obj.get("total_act_power", sum(p["power"] for p in phases)) or 0
        )
        _mqtt_data["shelly"]["_ts"] = now_iso
    elif sub == "online":
        _mqtt_data["shelly"]["online"] = (
            payload.decode("utf-8", errors="ignore").strip().lower() == "true"
        )


def _handle_ahoy_topic(topic: str, payload: bytes, now_iso: str) -> None:
    sub = topic[len("venus/pv/ahoydtu/"):]
    _mqtt_data["ahoy"]["raw"][sub] = _parse_mqtt_payload(payload)
    _mqtt_data["ahoy"]["_ts"] = now_iso


def _handle_trucki_topic(topic: str, payload: bytes, now_iso: str) -> None:
    sub = topic[len("Trucki/"):]
    _mqtt_data["trucki"]["raw"][sub] = _parse_mqtt_payload(payload)
    _mqtt_data["trucki"]["_ts"] = now_iso


def _dispatch_mqtt_message(topic: str, payload: bytes) -> None:
    """Route an MQTT message to the right device-specific handler."""
    now_iso = datetime.now(timezone.utc).isoformat()
    _mqtt_data["last_msg"] = now_iso

    if topic.startswith("N/"):
        _handle_victron_topic(topic, payload, now_iso)
    elif topic.startswith("venus/grid/shellypro/"):
        _handle_shelly_topic(topic, payload, now_iso)
    elif topic.startswith("venus/pv/ahoydtu/"):
        _handle_ahoy_topic(topic, payload, now_iso)
    elif topic.startswith("Trucki/"):
        _handle_trucki_topic(topic, payload, now_iso)


# ---------- Live accessors (consumed by the aggregator) ----------

def fetch_shelly_from_mqtt() -> Optional[Dict[str, Any]]:
    s = _mqtt_data["shelly"]
    if not s.get("phases"):
        return None
    return {
        "online": s.get("online", True),
        "total_power": round(s["total_power"], 1),
        "phases": [
            {"phase": p["phase"],
             "power": round(p["power"], 1),
             "voltage": round(p["voltage"], 1),
             "current": round(p["current"], 3),
             "pf": round(p["pf"], 2)}
            for p in s["phases"]
        ],
        "_via_mqtt": True,
    }


def fetch_ahoy_from_mqtt() -> Optional[Dict[str, Any]]:
    raw = _mqtt_data["ahoy"]["raw"]
    if not raw:
        return None
    total = raw.get("HM1500/total") or raw.get("total") or {}
    if not isinstance(total, dict):
        total = {}
    available = int(raw.get("HM1500/available", 0) or 0)
    p_ac = float(total.get("P_AC", 0) or 0)
    yield_day_wh = float(total.get("YieldDay", 0) or 0)  # Wh
    # Per-channel data not always published — expose aggregated channel for now
    channels = []
    for ch in range(1, 5):
        chp = raw.get(f"HM1500/ch{ch}/P_DC")
        chu = raw.get(f"HM1500/ch{ch}/U_DC")
        chi = raw.get(f"HM1500/ch{ch}/I_DC")
        chy = raw.get(f"HM1500/ch{ch}/YieldDay")
        if chp is not None or chu is not None:
            channels.append({
                "ch": ch,
                "power": round(float(chp or 0), 1),
                "voltage": round(float(chu or 0), 1),
                "current": round(float(chi or 0), 2),
                "yield_day": round(float(chy or 0) / 1000.0, 3),
            })
    if not channels:
        # Single aggregated channel if no per-ch data
        channels = [{
            "ch": 0, "power": round(p_ac, 1),
            "voltage": 0, "current": 0,
            "yield_day": round(yield_day_wh / 1000.0, 3),
        }]
    return {
        "online": available > 0,
        "total_power": round(p_ac, 1),
        "limit_percent": int(raw.get("HM1500/power_limit_read", 100) or 100),
        "yield_day_kwh": round(yield_day_wh / 1000.0, 3),
        "channels": channels,
        "_via_mqtt": True,
    }


def _trucki_soc_from_voltage(vbat: float, discharge_w: float = 0.0) -> float:
    """LiFePO4 16S piecewise SoC-from-voltage with load compensation.

    Calibrated against typical 16S LiFePO4 discharge curve. Flat middle region
    (40-90%) gets finer resolution where most cycling happens.

    Load compensation: when discharging (discharge_w > 0), the voltage sags due
    to internal resistance (~100 mΩ for 16S LiFePO4). We back-compute the rest
    voltage assuming I = P/V, ΔV = I × R.
    """
    if vbat <= 0:
        return 0.0
    # Load compensation
    v_rest = vbat
    if discharge_w > 50 and vbat > 30:
        current_a = discharge_w / vbat
        r_internal = 0.10  # 100 mΩ typical for 16S LiFePO4 pack with BMS
        v_rest = vbat + current_a * r_internal
    # (voltage, soc) anchor points - resting voltage
    curve = [
        (48.0,   0.0),
        (50.4,   5.0),
        (51.2,  10.0),
        (52.0,  20.0),
        (52.32, 30.0),
        (52.48, 40.0),
        (52.64, 50.0),
        (52.80, 60.0),
        (52.96, 70.0),
        (53.20, 80.0),
        (53.60, 90.0),
        (54.00, 95.0),
        (54.40, 100.0),
    ]
    if v_rest <= curve[0][0]:
        return 0.0
    if v_rest >= curve[-1][0]:
        return 100.0
    for i in range(len(curve) - 1):
        v1, s1 = curve[i]
        v2, s2 = curve[i + 1]
        if v1 <= v_rest <= v2:
            frac = (v_rest - v1) / (v2 - v1) if v2 > v1 else 0
            return s1 + frac * (s2 - s1)
    return 0.0


def fetch_trucki_from_mqtt() -> Optional[Dict[str, Any]]:
    raw = _mqtt_data["trucki"]["raw"]
    if not raw:
        return None
    # Only consider live values, filter overrides (settings)
    live = {k: v for k, v in raw.items() if "OVR" not in k}
    vbat = float(live.get("VBAT", 0) or 0)
    meter = float(live.get("METER", 0) or 0)
    state_on = str(live.get("STATE", "")).upper() == "ON"
    # METER ist die aktuelle AC-Einspeise-Leistung. SoC-Last-Kompensation
    # bekommt diesen Wert nur wenn Trucki gerade aktiv entlädt.
    discharge_w = meter if state_on else 0.0
    # ZEPC kann sein: "1", "(ENABLED) 1", "(DISABLED) 0", "ON", "0", "1"
    zepc_raw = str(live.get("ZEPC", "0")).upper()
    zepc_on = ("ENABLED" in zepc_raw) or zepc_raw.strip() in ("1", "ON", "TRUE")
    # Temperatur: TEMPERATURE (Standard-Topic) oder TEMP (neuere Firmware)
    temp = float(live.get("TEMPERATURE", live.get("TEMP", 0)) or 0)
    return {
        "online": True,
        "soc": round(_trucki_soc_from_voltage(vbat, discharge_w), 1),
        "battery_voltage": round(vbat, 2),
        "battery_power": -round(meter, 1) if state_on else 0.0,
        "ac_output": state_on,
        "zepc": zepc_on,
        "target_w": float(live.get("TARGET", 0) or 0),
        "min_power_w": float(live.get("MINPOWER", 0) or 0),
        "max_power_w": float(live.get("MAXPOWER", live.get("POWERLIMIT", 0)) or 0),
        "ac_setpoint_w": float(live.get("ACSETPOINT", 0) or 0),
        "ac_display_w": float(live.get("ACDISPLAY", 0) or 0),
        "day_energy_kwh": float(live.get("DAYENERGY", 0) or 0),
        "total_energy_kwh": float(live.get("TOTALENERGY", 0) or 0),
        "temperature": temp,
        "_via_mqtt": True,
    }


def fetch_victron_from_mqtt(cfg_victron: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not cfg_victron.get("enabled"):
        return None
    instances = cfg_victron.get("instances", []) or []
    mppts = []
    total = 0.0
    any_data = False
    for inst in instances:
        st = _mqtt_data["victron"]["instances"].get(int(inst), {})
        if not st:
            mppts.append({
                "id": int(inst), "name": f"MPPT 150/35 [{inst}]",
                "pv_power": 0, "pv_voltage": 0, "battery_voltage": 0,
                "yield_today": 0, "state": "–",
            })
            continue
        any_data = True
        p = float(st.get("Yield/Power", 0) or 0)
        total += p
        state_code = st.get("State")
        try:
            state_name = _VICTRON_STATE_NAMES.get(int(state_code), str(state_code)) if state_code is not None else "–"
        except Exception:
            state_name = str(state_code or "–")
        mppts.append({
            "id": int(inst),
            "name": f"MPPT 150/35 [{inst}]",
            "pv_power": round(p, 1),
            "pv_voltage": round(float(st.get("Pv/V", 0) or 0), 1),
            "battery_voltage": round(float(st.get("Dc/0/Voltage", 0) or 0), 2),
            "yield_today": round(float(st.get("History/Daily/0/Yield", 0) or 0), 3),
            "state": state_name,
        })
    if not any_data:
        return None
    sys_pv = _mqtt_data["victron"]["system"].get("Dc/Pv/Power")
    return {
        "online": True,
        "_via_mqtt": True,
        "mppts": mppts,
        "total_power": round(float(sys_pv) if sys_pv is not None else total, 1),
    }


# ---------- Connection lifecycle ----------

def _mqtt_disconnect() -> None:
    cl = _mqtt_state.get("client")
    if cl:
        try:
            cl.loop_stop()
            cl.disconnect()
        except Exception:
            pass
    _mqtt_state["client"] = None
    _mqtt_state["connected"] = False


def _mqtt_setup(cfg_mqtt: Dict[str, Any], cfg_victron: Dict[str, Any]) -> None:
    _mqtt_disconnect()
    if mqtt is None or not cfg_mqtt.get("enabled"):
        return
    cl = mqtt.Client(client_id="solar-dashboard")
    if cfg_mqtt.get("username"):
        cl.username_pw_set(cfg_mqtt["username"], cfg_mqtt.get("password", ""))

    vrm_id = (cfg_victron or {}).get("vrm_id") or ""
    victron_enabled = bool((cfg_victron or {}).get("enabled") and vrm_id)

    def on_connect(client_, userdata, flags, rc):
        if rc == 0:
            _mqtt_state["connected"] = True
            _mqtt_state["last_error"] = None
            # Generic prefix (user-defined extra topics)
            prefix = cfg_mqtt.get("topic_prefix", "solar")
            if prefix:
                client_.subscribe(f"{prefix}/#")
            # Device topics seen in user's network
            client_.subscribe("venus/pv/ahoydtu/#")
            client_.subscribe("venus/grid/shellypro/#")
            client_.subscribe("Trucki/#")
            if victron_enabled:
                client_.subscribe(f"N/{vrm_id}/#")
                try:
                    client_.publish(f"R/{vrm_id}/keepalive", "", qos=0)
                except Exception:
                    pass
        else:
            _mqtt_state["connected"] = False
            _mqtt_state["last_error"] = f"rc={rc}"

    def on_message(client_, userdata, msg):
        _mqtt_state["messages"] += 1
        try:
            _dispatch_mqtt_message(msg.topic, msg.payload)
        except Exception as e:
            logger.debug(f"dispatch error topic={msg.topic}: {e}")

    def on_disconnect(client_, userdata, rc):
        _mqtt_state["connected"] = False

    cl.on_connect = on_connect
    cl.on_message = on_message
    cl.on_disconnect = on_disconnect
    try:
        cl.connect_async(cfg_mqtt.get("host", "127.0.0.1"), int(cfg_mqtt.get("port", 1883)), keepalive=30)
        cl.loop_start()
        _mqtt_state["client"] = cl
        _mqtt_state["vrm_id"] = vrm_id if victron_enabled else None
    except Exception as e:
        _mqtt_state["last_error"] = str(e)
