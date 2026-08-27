"""API-Routen (FastAPI APIRouter) – ausgelagert aus server.py."""
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException

from server import (
    get_config,
    save_config,
    collect_live,
    restart_integrations,
    db,
    ConfigUpdate,
    HoymilesControl,
    TruckiControl,
    _mqtt_state,
    _mqtt_data,
    _influx_state,
    _poller_state,
)

api_router = APIRouter(prefix="/api")


# ---------- Endpoints ----------

@api_router.get("/")
async def root():
    return {"service": "solar-local-dashboard", "status": "ok"}


@api_router.get("/live")
async def live():
    return await collect_live()


@api_router.get("/config")
async def cfg_get():
    return await get_config()


@api_router.put("/config")
async def cfg_put(update: ConfigUpdate):
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


@api_router.get("/history")
async def history(range: str = "1h"):
    minutes = {"1h": 60, "6h": 360, "12h": 720, "24h": 1440}.get(range, 60)
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    cur = db.snapshots.find({"ts": {"$gte": since.isoformat()}}, {"_id": 0}).sort("ts", 1)
    rows = await cur.to_list(10000)
    # downsample if too many points
    if len(rows) > 600:
        step = max(1, len(rows) // 600)
        rows = rows[::step]
    return {"range": range, "points": rows}


@api_router.get("/today")
async def today():
    """Trapez-integration of power values from UTC midnight."""
    now = datetime.now(timezone.utc)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cur = db.snapshots.find({"ts": {"$gte": midnight.isoformat()}}, {"_id": 0}).sort("ts", 1)
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

    def trapez(values_a, values_b, t_a, t_b):
        dt_h = (t_b - t_a).total_seconds() / 3600.0
        return (values_a + values_b) / 2.0 * dt_h

    def charge_w(row):
        v = row.get("battery_charge_w")
        return v if v is not None else max(0, row.get("battery_power", 0))

    def discharge_w(row):
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
    autarky = (self_consumption_kwh / house_kwh * 100) if house_kwh > 0 else 0
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
async def control_hoymiles(cmd: HoymilesControl):
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
async def control_trucki(cmd: TruckiControl):
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
async def integrations_status():
    inst_summary = {}
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
async def diagnostics_run():
    """Runs a series of health checks against backend, MongoDB, MQTT,
    InfluxDB and each configured device. Returns one result per check."""
    cfg = await get_config()
    started = time.time()
    results: List[Dict[str, Any]] = []

    def add(name: str, ok: Optional[bool], detail: str, ms: Optional[int] = None):
        results.append({"name": name, "ok": ok, "detail": detail, "ms": ms})

    # 1. Backend itself
    add("Backend API", True, "läuft", 0)

    # 2. MongoDB
    t = time.time()
    try:
        await db.command("ping")
        snap_count = await db.snapshots.count_documents({})
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

    devs = cfg["devices"]
    await asyncio.gather(
        ping_http("Shelly Pro 3EM", devs["shelly"]["ip"], ["/rpc/EM.GetStatus?id=0", "/"], "shelly", _mqtt_data["shelly"]["_ts"]),
        ping_http("Ahoy DTU (Hoymiles)", devs["ahoy"]["ip"], ["/api/system", "/"], "ahoy", _mqtt_data["ahoy"]["_ts"]),
        ping_http("Trucki2Shelly", devs["trucki"]["ip"], ["/status", "/"], "trucki", _mqtt_data["trucki"]["_ts"]),
        ping_http("Victron VenusOS", devs["victron"]["ip"], ["/api/v1/system", "/"], "victron", _mqtt_data["victron"]["_ts"]),
    )

    # Summary
    n_pass = sum(1 for r in results if r["ok"] is True)
    n_fail = sum(1 for r in results if r["ok"] is False)
    n_skip = sum(1 for r in results if r["ok"] is None)
    return {
        "timestamp": now_dt.isoformat(),
        "duration_ms": int((time.time() - started) * 1000),
        "summary": {"pass": n_pass, "fail": n_fail, "skip": n_skip, "total": len(results)},
        "tests": results,
    }


@api_router.get("/diagnostics/raw")
async def diagnostics_raw():
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
