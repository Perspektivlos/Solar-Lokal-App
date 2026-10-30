"""API-Routen (FastAPI APIRouter) – ausgelagert aus server.py."""
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server import (
    get_config,
    save_config,
    restart_integrations,
    db,
    ConfigUpdate,
    HoymilesControl,
    TruckiControl,
    _mqtt_state,
    _mqtt_data,
    _influx_state,
    _poller_state,
    _retention_state,
    _cleanup_snapshots_once,
)
from collectors import collect_live
from alarms import evaluate_alarms, summarize_alarms, merge_thresholds
from discovery import discover_device, DEVICE_LABELS, annotate_changes

api_router = APIRouter(prefix="/api")


# ---------- Endpoints ----------

@api_router.get("/")
async def root() -> Dict[str, Any]:
    return {"service": "solar-local-dashboard", "status": "ok"}


def _alarm_state(cfg: Dict[str, Any]):
    mqtt_enabled = bool((cfg.get("mqtt") or {}).get("enabled"))
    mqtt_connected = bool(_mqtt_state.get("connected"))
    return mqtt_enabled, mqtt_connected


def _eval_alarms(cfg: Dict[str, Any], data: Dict[str, Any]):
    ac = cfg.get("alarms") or {}
    if ac.get("enabled", True) is False:
        return []
    mqtt_enabled, mqtt_connected = _alarm_state(cfg)
    thresholds = merge_thresholds(ac)
    return evaluate_alarms(data, mqtt_connected=mqtt_connected, mqtt_enabled=mqtt_enabled, thresholds=thresholds)


# ---------- Energiebilanz (kWh je Tag/Monat aus Snapshots) ----------

ENERGY_SAMPLE_SECONDS = 15  # Poller-Intervall (siehe server.poller_loop)


def _rows_to_balance(rows: List[Dict[str, Any]], sample_seconds: int = ENERGY_SAMPLE_SECONDS) -> List[Dict[str, Any]]:
    """Wandelt gruppierte Leistungs-Summen (W je Sample) in kWh je Bucket um.

    Energie ≈ Σ(Leistung[W]) · Sample-Intervall[h] / 1000 → kWh. Eigenverbrauch = PV − Einspeisung.
    """
    factor = sample_seconds / 3600.0 / 1000.0
    out: List[Dict[str, Any]] = []
    for r in rows:
        pv = round(float(r.get("pv", 0) or 0) * factor, 2)
        imp = round(float(r.get("imp", 0) or 0) * factor, 2)
        exp = round(float(r.get("exp", 0) or 0) * factor, 2)
        self_kwh = round(max(0.0, pv - exp), 2)
        out.append({
            "period": r["_id"],
            "pv_kwh": pv,
            "import_kwh": imp,
            "export_kwh": exp,
            "self_kwh": self_kwh,
        })
    return out


@api_router.get("/energy/balance")
async def energy_balance(period: str = "day", limit: int = 14) -> Dict[str, Any]:
    period = "month" if period == "month" else "day"
    limit = max(1, min(int(limit), 60))
    if period == "day":
        start = (datetime.now(timezone.utc) - timedelta(days=limit)).isoformat()
        bucket = {"$substr": ["$ts", 0, 10]}
    else:
        start = (datetime.now(timezone.utc) - timedelta(days=limit * 31)).isoformat()
        bucket = {"$substr": ["$ts", 0, 7]}
    pipeline = [
        {"$match": {"ts": {"$gte": start}}},
        {"$group": {
            "_id": bucket,
            "pv": {"$sum": "$pv_power"},
            "imp": {"$sum": {"$cond": [{"$gt": ["$grid_power", 0]}, "$grid_power", 0]}},
            "exp": {"$sum": {"$cond": [{"$lt": ["$grid_power", 0]}, {"$multiply": ["$grid_power", -1]}, 0]}},
            "n": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.snapshots.aggregate(pipeline).to_list(1000)
    buckets = _rows_to_balance(rows)[-limit:]
    return {"period": period, "buckets": buckets}


@api_router.get("/live")
async def live() -> Dict[str, Any]:
    cfg = await get_config()
    data = await collect_live(cfg)
    data["alarms"] = _eval_alarms(cfg, data)
    return data


@api_router.get("/alarms/history")
async def alarms_history(limit: int = 50) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 200))
    cur = db.alarm_events.find({}, {"_id": 0}).sort("ts", -1).limit(limit)
    rows = await cur.to_list(limit)
    return {"events": rows, "count": len(rows)}


@api_router.get("/alarms")
async def alarms() -> Dict[str, Any]:
    cfg = await get_config()
    data = await collect_live(cfg)
    items = _eval_alarms(cfg, data)
    summary = summarize_alarms(items)
    summary["timestamp"] = data.get("timestamp")
    return summary


@api_router.get("/config")
async def cfg_get() -> Dict[str, Any]:
    return await get_config()


@api_router.put("/config")
async def cfg_put(update: ConfigUpdate) -> Dict[str, Any]:
    current = await get_config()
    payload = update.model_dump(exclude_none=True)
    for key, val in payload.items():
        if isinstance(val, dict) and isinstance(current.get(key), dict):
            current[key] = {**current[key], **val}
        else:
            current[key] = val
    await save_config(current)
    # Restart integrations only when connection-relevant keys changed.
    integration_keys = {"demo_mode", "devices", "mqtt", "victron_mqtt", "influx"}
    if integration_keys & set(payload.keys()):
        await restart_integrations()
    return current


# ---------- Roadmap (editierbar, lokal persistiert) ----------

# Startinhalt: vollständiger tatsächlicher Projektstand. Wird beim ersten Abruf
# in db.roadmap gespeichert; danach zählt ausschließlich der gespeicherte Stand.
DEFAULT_ROADMAP = [
    {"id": "live-dashboard", "status": "done", "date": "2026-06", "title": "Live-Dashboard mit animiertem Energiefluss"},
    {"id": "scada-design", "status": "done", "date": "2026-06", "title": "SCADA-Control-Room-Design (DSEG7-LCD, Sora, Neon-Akzente)"},
    {"id": "device-control", "status": "done", "date": "2026-06", "title": "Geräte-Steuerung: Hoymiles-Limit & Trucki/SUN"},
    {"id": "alarms", "status": "done", "date": "2026-06", "title": "Status-Alarme + konfigurierbare Schwellwerte"},
    {"id": "diagnose", "status": "done", "date": "2026-06", "title": "Diagnose / Geräte-Selbsttest"},
    {"id": "discovery", "status": "done", "date": "2026-06", "title": "Geräte-Erkennung + Firmware-Vergleich"},
    {"id": "integrations", "status": "done", "date": "2026-06", "title": "Integrationen: Mosquitto MQTT & InfluxDB"},
    {"id": "local-start", "status": "done", "date": "2026-06", "title": "Lokaler Start ohne MongoDB + DB-Retention"},
    {"id": "grafana", "status": "done", "date": "2026-10", "title": "Grafana Auto-Provisioning (Datasource + 42-Panel-Dashboard)"},
    {"id": "scadavis", "status": "done", "date": "2026-10-07", "title": "SCADAvis-Synoptik-Vorschau + Grafana-Panel"},
    {"id": "suntimeline", "status": "done", "date": "2026-10-07", "title": "Sonnen-Tagesverlauf (Balken & Bogen umschaltbar)"},
    {"id": "favorites", "status": "done", "date": "2026-10-07", "title": "Favoriten aufs Dashboard pinnen (inkl. MPPT-Strings & Phasen)"},
    {"id": "favorites-dnd", "status": "done", "date": "2026-10-07", "title": "Favoriten per Drag-&-Drop sortieren"},
    {"id": "device-cards", "status": "done", "date": "2026-10-29", "title": "Vier große Geräte-KPI-Karten"},
    {"id": "flow-rework", "status": "done", "date": "2026-10-29", "title": "Energiefluss: Kompakt (5) / Detail (6) / Auto"},
    {"id": "flow-controls", "status": "done", "date": "2026-10-29", "title": "Fluss an/aus + Tempo-Regler (1x / 1.5x / 2x)"},
    {"id": "flow-mobile", "status": "done", "date": "2026-10-29", "title": "Hochkant-Energiefluss auf Mobilgeräten"},
    {"id": "display-settings", "status": "done", "date": "2026-10-29", "title": "Einstellungen: Akkukapazität & Karten-Beschriftungen"},
    {"id": "docs-footer", "status": "done", "date": "2026-10-29", "title": "Versions-Fußleiste, In-App-Roadmap & Anleitung"},
    {"id": "roadmap-edit", "status": "done", "date": "2026-10-29", "title": "Roadmap bearbeiten & „Was ist neu?\"-Fenster"},
    {"id": "report-page", "status": "done", "date": "2026-10-29", "title": "Projektbericht mit Zeitachse & Vorher/Nachher-Vorschau"},
    {"id": "changelog-auto", "status": "done", "date": "2026-10-29", "title": "Bericht-Änderungsliste automatisch aus der Roadmap"},
    {"id": "report-print", "status": "done", "date": "2026-10-29", "title": "Projektbericht drucken / als PDF (hell & dunkel)"},
    {"id": "sparklines", "status": "planned", "date": "Phase 2", "title": "Mini-Sparklines (15-Min-Trend) in den Geräte-Karten"},
    {"id": "roadmap-extra", "status": "planned", "date": "Phase 2", "title": "Roadmap: Notizen, Links, Tags & Filter je Punkt"},
    {"id": "threshold-alarms", "status": "planned", "date": "Phase 3", "title": "Schwellwert-Farbalarme je Karte / Kachel"},
    {"id": "alarm-push", "status": "planned", "date": "Phase 3", "title": "Akustische / Push-Benachrichtigung bei kritischen Alarmen"},
    {"id": "docs-pdf", "status": "planned", "date": "Phase 3", "title": "Anleitung / Roadmap als Druck- / PDF-Ansicht exportieren"},
    {"id": "more-device-texts", "status": "planned", "date": "Phase 3", "title": "Weitere Gerätetexte in den Einstellungen editierbar"},
    {"id": "synoptic-svg", "status": "planned", "date": "Phase 3", "title": "Eigenes Synoptik-SVG final ins Grafana-Panel einhängen"},
]


class RoadmapUpdate(BaseModel):
    items: List[Dict[str, Any]]


@api_router.get("/roadmap")
async def roadmap_get() -> Dict[str, Any]:
    doc = await db.roadmap.find_one({"_id": "main"})
    if not doc or not doc.get("items"):
        await db.roadmap.update_one({"_id": "main"}, {"$set": {"items": DEFAULT_ROADMAP}}, upsert=True)
        return {"items": DEFAULT_ROADMAP}
    return {"items": doc["items"]}


@api_router.put("/roadmap")
async def roadmap_put(update: RoadmapUpdate) -> Dict[str, Any]:
    items = [
        {
            "id": str(it.get("id") or ""),
            "title": str(it.get("title") or "").strip(),
            "status": it.get("status") if it.get("status") in ("done", "wip", "planned") else "planned",
            "date": str(it.get("date") or ""),
        }
        for it in update.items
        if str(it.get("title") or "").strip()
    ]
    await db.roadmap.update_one({"_id": "main"}, {"$set": {"items": items}}, upsert=True)
    return {"items": items}


# ---------- Geräte-Erkennung / Anlagendokumentation ----------

async def _save_device_info(result: Dict[str, Any]) -> Dict[str, Any]:
    """Persistiert das Erkennungs-Ergebnis als Doku. Bei Fehlern bleiben die
    zuletzt erfolgreich erkannten Kenndaten erhalten (Plan: auch offline sichtbar)."""
    key = result["device"]
    existing = await db.device_info.find_one({"_id": key}) or {}
    if result["status"] == "error":
        doc = {
            "device": key,
            "device_label": result["device_label"],
            "status": "error",
            "error": result.get("error"),
            "ip": result.get("ip"),
            "last_attempt_at": result["detected_at"],
            "fields": existing.get("fields", []),
            "firmware": existing.get("firmware"),
            "detected_at": existing.get("detected_at"),
            "changed_count": 0,
            "prev_detected_at": existing.get("prev_detected_at"),
        }
    else:
        prev_fields = {f["label"]: f["value"] for f in (existing.get("fields") or [])}
        changed = annotate_changes(result["fields"], prev_fields)
        doc = {
            "device": key,
            "device_label": result["device_label"],
            "status": result["status"],
            "error": None,
            "fields": result["fields"],
            "firmware": result.get("firmware"),
            "ip": result.get("ip"),
            "detected_at": result["detected_at"],
            "last_attempt_at": result["detected_at"],
            "changed_count": changed,
            "prev_detected_at": existing.get("detected_at"),
        }
    await db.device_info.update_one({"_id": key}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/devices/info")
async def devices_info() -> Dict[str, Any]:
    cur = db.device_info.find({}, {"_id": 0})
    rows = await cur.to_list(50)
    return {"devices": rows}


@api_router.post("/devices/discover-all")
async def devices_discover_all() -> Dict[str, Any]:
    cfg = await get_config()
    keys = list(DEVICE_LABELS.keys())
    results = await asyncio.gather(*[discover_device(cfg, k) for k in keys])
    docs = [await _save_device_info(r) for r in results]
    return {"devices": docs}


@api_router.post("/devices/{key}/discover")
async def devices_discover(key: str) -> Dict[str, Any]:
    if key not in DEVICE_LABELS:
        raise HTTPException(404, f"Unbekanntes Gerät: {key}")
    cfg = await get_config()
    result = await discover_device(cfg, key)
    return await _save_device_info(result)


@api_router.get("/history")
async def history(range: str = "1h") -> Dict[str, Any]:
    minutes = {"1h": 60, "3h": 180, "6h": 360, "12h": 720, "24h": 1440}.get(range, 60)
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    cur = db.snapshots.find({"ts": {"$gte": since.isoformat()}}, {"_id": 0}).sort("ts", -1).limit(10000)
    rows = (await cur.to_list(10000))[::-1]  # neueste behalten, dann chronologisch
    # downsample if too many points
    if len(rows) > 600:
        step = max(1, len(rows) // 600)
        rows = rows[::step]
    return {"range": range, "points": rows}


@api_router.get("/today")
async def today(day_offset: int = 0) -> Dict[str, Any]:
    """Trapez-integration for one UTC day; day_offset=1 returns yesterday."""
    day_offset = max(0, min(int(day_offset), 3650))
    now = datetime.now(timezone.utc)
    today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_start = today_midnight - timedelta(days=day_offset)
    day_end = min(now, day_start + timedelta(days=1)) if day_offset == 0 else day_start + timedelta(days=1)
    cur = db.snapshots.find(
        {"ts": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}},
        {"_id": 0},
    ).sort("ts", 1).limit(20000)
    rows = await cur.to_list(20000)
    if not rows:
        return {
            "pv_kwh": 0, "consumption_kwh": 0, "grid_import_kwh": 0,
            "grid_export_kwh": 0, "self_consumption_kwh": 0,
            "autarky_pct": 0, "self_consumption_pct": 0,
            "avg_pv_w": 0, "avg_house_w": 0,
            "battery_charge_kwh": 0, "battery_discharge_kwh": 0,
            "round_trip_pct": 0,
        }

    def trapez(values_a: float, values_b: float, t_a: datetime, t_b: datetime) -> float:
        dt_h = (t_b - t_a).total_seconds() / 3600.0
        return (values_a + values_b) / 2.0 * dt_h

    def charge_w(row: Dict[str, Any]) -> float:
        v = row.get("battery_charge_w")
        return v if v is not None else max(0, row.get("battery_power", 0))

    def discharge_w(row: Dict[str, Any]) -> float:
        v = row.get("battery_discharge_w")
        return v if v is not None else max(0, -row.get("battery_power", 0))

    pv_wh = grid_imp_wh = grid_exp_wh = house_wh = 0.0
    bat_charge_wh = bat_discharge_wh = 0.0
    for prev, cur_row in zip(rows, rows[1:]):
        ta = datetime.fromisoformat(prev["ts"])
        tb = datetime.fromisoformat(cur_row["ts"])
        if (tb - ta).total_seconds() > 600:
            continue  # large gap, skip
        pv_a, pv_b = prev["pv_power"], cur_row["pv_power"]
        gp_a, gp_b = prev["grid_power"], cur_row["grid_power"]
        hp_a, hp_b = prev["house_power"], cur_row["house_power"]
        pv_wh += trapez(pv_a, pv_b, ta, tb)
        house_wh += trapez(hp_a, hp_b, ta, tb)
        grid_imp_wh += trapez(max(0, gp_a), max(0, gp_b), ta, tb)
        grid_exp_wh += trapez(max(0, -gp_a), max(0, -gp_b), ta, tb)
        bat_charge_wh += trapez(charge_w(prev), charge_w(cur_row), ta, tb)
        bat_discharge_wh += trapez(discharge_w(prev), discharge_w(cur_row), ta, tb)

    pv_kwh = pv_wh / 1000.0
    house_kwh = house_wh / 1000.0
    imp_kwh = grid_imp_wh / 1000.0
    exp_kwh = grid_exp_wh / 1000.0
    self_consumption_kwh = max(0, pv_kwh - exp_kwh)
    # Autarkie = Anteil des Hausbedarfs, der ohne Netzbezug gedeckt wurde.
    # PV-Eigenverbrauch ist hier ungeeignet, weil DC-Ladung und Akku-Entladung
    # Erzeugung und tatsächliche Hausdeckung zeitlich voneinander entkoppeln.
    autarky = ((house_kwh - imp_kwh) / house_kwh * 100) if house_kwh > 0 else 0
    autarky = max(0.0, min(100.0, autarky))
    self_cons_pct = (self_consumption_kwh / pv_kwh * 100) if pv_kwh > 0 else 0
    self_cons_pct = max(0.0, min(100.0, self_cons_pct))

    duration_h = (datetime.fromisoformat(rows[-1]["ts"]) - datetime.fromisoformat(rows[0]["ts"])).total_seconds() / 3600.0
    avg_pv = (pv_wh / duration_h) if duration_h > 0 else 0
    avg_house = (house_wh / duration_h) if duration_h > 0 else 0

    bat_charge_kwh = bat_charge_wh / 1000.0
    bat_discharge_kwh = bat_discharge_wh / 1000.0
    # Round-Trip-Wirkungsgrad = AC-Entladeenergie / DC-Ladeenergie.
    # Erst ab einer Mindest-Ladeenergie aussagekräftig (Rauschen vermeiden).
    round_trip = (bat_discharge_kwh / bat_charge_kwh * 100) if bat_charge_kwh > 0.05 else 0
    round_trip = max(0.0, min(100.0, round_trip))

    return {
        "pv_kwh": round(pv_kwh, 3),
        "consumption_kwh": round(house_kwh, 3),
        "grid_import_kwh": round(imp_kwh, 3),
        "grid_export_kwh": round(exp_kwh, 3),
        "self_consumption_kwh": round(self_consumption_kwh, 3),
        "autarky_pct": round(autarky, 1),
        "self_consumption_pct": round(self_cons_pct, 1),
        "avg_pv_w": round(avg_pv, 1),
        "avg_house_w": round(avg_house, 1),
        "battery_charge_kwh": round(bat_charge_kwh, 3),
        "battery_discharge_kwh": round(bat_discharge_kwh, 3),
        "round_trip_pct": round(round_trip, 1),
    }


@api_router.post("/control/hoymiles")
async def control_hoymiles(cmd: HoymilesControl) -> Dict[str, Any]:
    cfg = await get_config()
    if cfg.get("demo_mode"):
        return {"ok": True, "demo": True, "response": {"action": cmd.action, "value": cmd.value, "result": "Simuliert"}}
    ip = cfg["devices"]["ahoy"]["ip"]
    inv = cfg["devices"]["ahoy"].get("inverter_id", 0)
    cmd_map = {
        "limit": {"cmd": "limit_nonpersistent_absolute", "val": cmd.value or 100},
        "start": {"cmd": "power", "val": 1},
        "stop": {"cmd": "power", "val": 0},
        "power_on": {"cmd": "power", "val": 1},
        "power_off": {"cmd": "power", "val": 0},
        "restart": {"cmd": "restart", "val": 0},
    }
    if cmd.action not in cmd_map:
        raise HTTPException(400, f"Unknown action {cmd.action}")
    payload = {"id": inv, **cmd_map[cmd.action]}
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.post(f"http://{ip}/api/ctrl", json=payload)
            return {"ok": r.status_code == 200, "response": r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text}
    except Exception as e:
        raise HTTPException(502, f"Ahoy DTU unreachable: {e}")


@api_router.post("/control/trucki")
async def control_trucki(cmd: TruckiControl) -> Dict[str, Any]:
    cfg = await get_config()
    if cfg.get("demo_mode"):
        return {"ok": True, "demo": True, "response": {"action": cmd.action, "value": cmd.value, "result": "Simuliert"}}

    # Neue Trucki-Firmware: Steuerung via MQTT-OVR-Topics statt HTTP
    topic_map = {
        "limit":    ("Trucki/ACSETPOINTOVR", str(int(cmd.value or 0))),
        "zepc_on":  ("Trucki/ZEPCOVR",       "1"),
        "zepc_off": ("Trucki/ZEPCOVR",       "0"),
        "restart":  ("Trucki/REBOOTOVR",     "1"),
        "max":      ("Trucki/MAXPOWEROVR",   str(int(cmd.value or 0))),
        "min":      ("Trucki/MINPOWEROVR",   str(int(cmd.value or 0))),
        "target":   ("Trucki/TARGETOVR",     str(int(cmd.value or 0))),
    }
    if cmd.action == "limit" and cmd.value is None:
        raise HTTPException(400, "value (W) erforderlich für limit")
    if cmd.action not in topic_map:
        raise HTTPException(400, f"Unknown action {cmd.action}")

    mqtt_cl = _mqtt_state.get("client")
    if mqtt_cl and _mqtt_state.get("connected"):
        topic, payload = topic_map[cmd.action]
        try:
            info = mqtt_cl.publish(topic, payload, qos=0, retain=False)
            return {"ok": True, "via": "mqtt", "response": {"topic": topic, "payload": payload, "mid": info.mid}}
        except Exception as e:
            raise HTTPException(502, f"MQTT publish failed: {e}")

    # Fallback: alte HTTP-Firmware (Legacy)
    ip = cfg["devices"]["trucki"]["ip"]
    if cmd.action == "limit":
        url = f"http://{ip}/Limit?L={int(cmd.value)}"
    elif cmd.action in ("zepc_on", "zepc_off"):
        url = f"http://{ip}/{cmd.action.replace('_', '/')}"
    elif cmd.action == "restart":
        url = f"http://{ip}/restart"
    else:
        raise HTTPException(400, f"Action {cmd.action} requires MQTT (not connected)")
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(url)
            return {"ok": r.status_code == 200, "via": "http", "response": r.text}
    except Exception as e:
        raise HTTPException(502, f"Trucki unreachable: {e}")


@api_router.get("/integrations/status")
async def integrations_status() -> Dict[str, Any]:
    inst_summary: Dict[str, Any] = {}
    for inst, st in _mqtt_data["victron"]["instances"].items():
        inst_summary[str(inst)] = {
            "fields": len([k for k in st.keys() if not k.startswith("_")]),
            "last_msg": st.get("_ts"),
            "pv_power": st.get("Yield/Power"),
            "pv_voltage": st.get("Pv/V"),
            "battery_voltage": st.get("Dc/0/Voltage"),
            "state": st.get("State"),
        }
    return {
        "mqtt": {"connected": _mqtt_state["connected"], "last_error": _mqtt_state["last_error"], "messages": _mqtt_state["messages"]},
        "influx": {"connected": _influx_state["connected"], "last_error": _influx_state["last_error"], "writes": _influx_state["writes"]},
        "poller": {"running": _poller_state["running"], "last_write": _poller_state["last_write"], "count": _poller_state["count"]},
        "device_mqtt": {
            "ahoy_last": _mqtt_data["ahoy"]["_ts"],
            "shelly_last": _mqtt_data["shelly"]["_ts"],
            "trucki_last": _mqtt_data["trucki"]["_ts"],
            "victron_last": _mqtt_data["victron"]["_ts"],
            "trucki_keys": list((_mqtt_data["trucki"]["raw"] or {}).keys()),
        },
        "victron_mqtt": {
            "last_msg": _mqtt_data["victron"]["_ts"],
            "system_pv_power": _mqtt_data["victron"]["system"].get("Dc/Pv/Power"),
            "instances": inst_summary,
        },
    }


# ---------- Diagnostics / Self-Test ----------

@api_router.post("/diagnostics/run")
async def diagnostics_run() -> Dict[str, Any]:
    """Runs a series of health checks against backend, MongoDB, MQTT,
    InfluxDB and each configured device. Returns one result per check."""
    cfg = await get_config()
    started = time.time()
    results: List[Dict[str, Any]] = []

    def add(name: str, ok: Optional[bool], detail: str, ms: Optional[int] = None) -> None:
        results.append({"name": name, "ok": ok, "detail": detail, "ms": ms})

    # 1. Backend itself
    add("Backend API", True, "läuft", 0)

    # 2. MongoDB
    t = time.time()
    try:
        await db.command("ping")
        snap_count = await db.snapshots.estimated_document_count()
        add("MongoDB", True, f"Ping OK · {snap_count} Snapshots gespeichert", int((time.time() - t) * 1000))
    except Exception as e:
        add("MongoDB", False, f"{type(e).__name__}: {e}", int((time.time() - t) * 1000))

    # 3. Poller
    add("Snapshot-Poller", bool(_poller_state.get("running")),
        f"{_poller_state.get('count', 0)} Snapshots · letzter Schreibvorgang: {_poller_state.get('last_write') or '–'}")

    # 4. MQTT
    mq_cfg = cfg.get("mqtt") or {}
    if not mq_cfg.get("enabled"):
        add("MQTT", None, "deaktiviert in Config")
    else:
        ok = bool(_mqtt_state.get("connected"))
        detail = (f"verbunden mit {mq_cfg.get('host')}:{mq_cfg.get('port')} · "
                  f"{_mqtt_state.get('messages', 0)} Nachrichten") if ok else \
                 f"{mq_cfg.get('host')}:{mq_cfg.get('port')} – {_mqtt_state.get('last_error') or 'nicht verbunden'}"
        add("MQTT (Mosquitto)", ok, detail)

    # 5. InfluxDB
    inf_cfg = cfg.get("influx") or {}
    if not inf_cfg.get("enabled"):
        add("InfluxDB", None, "deaktiviert in Config")
    else:
        ok = bool(_influx_state.get("connected"))
        detail = (f"verbunden · {_influx_state.get('writes', 0)} Writes") if ok else \
                 f"{inf_cfg.get('url')} – {_influx_state.get('last_error') or 'nicht verbunden'}"
        add("InfluxDB", ok, detail)

    # 5b. Retention
    ret_cfg = cfg.get("retention") or {}
    if not ret_cfg.get("enabled", True):
        add("DB-Retention", None, "deaktiviert in Config")
    else:
        days = int(ret_cfg.get("days", 30))
        last_run = _retention_state.get("last_run") or "–"
        total = _retention_state.get("total_deleted", 0)
        err = _retention_state.get("last_error")
        detail = f"behält {days} Tage · letzter Lauf: {last_run} · gelöscht gesamt: {total}"
        add("DB-Retention", err is None, detail if not err else f"{detail} · Fehler: {err}")

    # 6. Devices — check MQTT freshness first, else HTTP ping
    fresh_window_s = 90  # data younger than this counts as live
    now_dt = datetime.now(timezone.utc)
    demo = bool(cfg.get("demo_mode"))

    def is_fresh(ts: Optional[str]) -> bool:
        if not ts:
            return False
        try:
            return (now_dt - datetime.fromisoformat(ts)).total_seconds() < fresh_window_s
        except Exception:
            return False

    async def ping_http(label: str, ip: str, paths: List[str], key: str, mqtt_ts: Optional[str], extra: str = ""):
        if not cfg["devices"][key]["enabled"]:
            add(label, None, "deaktiviert in Config")
            return
        if demo:
            add(label, None, f"Demo-Modus aktiv · Mock-Werte für {ip}")
            return
        if is_fresh(mqtt_ts):
            add(label, True, f"MQTT-Daten frisch · zuletzt {mqtt_ts}{extra}")
            return
        # try HTTP
        last_err = ""
        for p in paths:
            url = f"http://{ip}{p}"
            t0 = time.time()
            try:
                async with httpx.AsyncClient(timeout=1.5) as c:
                    r = await c.get(url)
                    ms = int((time.time() - t0) * 1000)
                    if r.status_code < 500:
                        add(label, True, f"HTTP {r.status_code} · {ip}{p}{extra}", ms)
                        return
                    last_err = f"HTTP {r.status_code} bei {p}"
            except Exception as e:
                last_err = f"{type(e).__name__}: {str(e)[:60]}"
        add(label, False, f"{ip} nicht erreichbar – {last_err}{extra}")

    devs = cfg.get("devices")
    if not isinstance(devs, dict):
        devs = {}

    def _d(name: str) -> Dict[str, Any]:
        v = devs.get(name)
        return v if isinstance(v, dict) else {}

    await asyncio.gather(
        ping_http("Shelly Pro 3EM", _d("shelly").get("ip", ""), ["/rpc/EM.GetStatus?id=0", "/"], "shelly", _mqtt_data["shelly"]["_ts"]),
        ping_http("Ahoy DTU (Hoymiles)", _d("ahoy").get("ip", ""), ["/api/system", "/"], "ahoy", _mqtt_data["ahoy"]["_ts"]),
        ping_http("Trucki2Shelly", _d("trucki").get("ip", ""), ["/status", "/"], "trucki", _mqtt_data["trucki"]["_ts"]),
        ping_http("Victron VenusOS", _d("victron").get("ip", ""), ["/api/v1/system", "/"], "victron", _mqtt_data["victron"]["_ts"]),
    )

    # Summary
    n_pass = sum(1 for r in results if r["ok"] is True)
    n_fail = sum(1 for r in results if r["ok"] is False)
    n_skip = sum(1 for r in results if r["ok"] is None)
    run = {
        "timestamp": now_dt.isoformat(),
        "duration_ms": int((time.time() - started) * 1000),
        "summary": {"pass": n_pass, "fail": n_fail, "skip": n_skip, "total": len(results)},
        "tests": results,
    }
    # Verlauf: nur manuelle Läufe, die letzten SELFTEST_KEEP behalten
    await db.selftest_runs.insert_one(dict(run))
    old = await db.selftest_runs.find({}, {"_id": 1}).sort("timestamp", -1).skip(SELFTEST_KEEP).to_list(None)
    if old:
        await db.selftest_runs.delete_many({"_id": {"$in": [o["_id"] for o in old]}})
    return run


SELFTEST_KEEP = 50


@api_router.get("/diagnostics/history")
async def diagnostics_history() -> Dict[str, Any]:
    """Letzte Selbst-Test-Läufe + je Prüfung: letzter Status, zuletzt OK, zuletzt ausgefallen."""
    runs = await db.selftest_runs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(SELFTEST_KEEP)
    checks: Dict[str, Dict[str, Any]] = {}
    for r in runs:  # neueste zuerst
        for t in r.get("tests", []):
            c = checks.setdefault(t["name"], {"name": t["name"], "last_status": t.get("ok"), "last_ok": None,
                                              "last_fail": None, "last_fail_detail": None, "fails": 0, "runs": 0})
            c["runs"] += 1
            if t.get("ok") is True and not c["last_ok"]:
                c["last_ok"] = r["timestamp"]
            if t.get("ok") is False:
                c["fails"] += 1
                if not c["last_fail"]:
                    c["last_fail"] = r["timestamp"]
                    c["last_fail_detail"] = t.get("detail")
    return {
        "runs": [{"timestamp": r["timestamp"], "duration_ms": r.get("duration_ms"), "summary": r.get("summary")} for r in runs],
        "checks": list(checks.values()),
        "keep": SELFTEST_KEEP,
    }


@api_router.get("/diagnostics/raw")
async def diagnostics_raw() -> Dict[str, Any]:
    """Returns all raw MQTT-collected state for the deep-inspection view."""
    return {
        "ahoy": {"_ts": _mqtt_data["ahoy"]["_ts"], "raw": _mqtt_data["ahoy"]["raw"]},
        "shelly": {
            "_ts": _mqtt_data["shelly"]["_ts"],
            "online": _mqtt_data["shelly"]["online"],
            "total_power": _mqtt_data["shelly"]["total_power"],
            "phases": _mqtt_data["shelly"]["phases"],
        },
        "trucki": {
            "_ts": _mqtt_data["trucki"]["_ts"],
            "raw": {k: v for k, v in _mqtt_data["trucki"]["raw"].items() if "OVR" not in k},
            "settings": {k: v for k, v in _mqtt_data["trucki"]["raw"].items() if "OVR" in k},
        },
        "victron": {
            "_ts": _mqtt_data["victron"]["_ts"],
            "system": _mqtt_data["victron"]["system"],
            "grid": _mqtt_data["victron"]["grid"],
            "instances": {str(k): v for k, v in _mqtt_data["victron"]["instances"].items()},
        },
    }
