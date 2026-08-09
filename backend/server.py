"""Solar Local Dashboard backend.

Aggregates data from Shelly Pro 3EM, Ahoy DTU (Hoymiles HM1500),
Trucki2Shelly Gateway and Victron MPPT (VenusOS). Provides live values,
history, daily totals, device control and integration (MQTT/InfluxDB).
"""

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import math
import random
import time
from pathlib import Path
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
import httpx

from mqtt_client import (
    _mqtt_data,
    _mqtt_state,
    fetch_shelly_from_mqtt,
    fetch_ahoy_from_mqtt,
    fetch_trucki_from_mqtt,
    fetch_victron_from_mqtt,
    _mqtt_setup,
    _mqtt_disconnect,
)

# Optional integrations - imported lazily inside functions where possible
try:
    from influxdb_client import InfluxDBClient, Point
    from influxdb_client.client.write_api import SYNCHRONOUS
except Exception:  # pragma: no cover
    InfluxDBClient = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Solar Local Dashboard")
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("solar")


# ---------- Config Models ----------

DEFAULT_CONFIG: Dict[str, Any] = {
    "demo_mode": True,
    "devices": {
        "shelly": {"ip": "192.168.0.100", "enabled": True},
        "ahoy": {"ip": "192.168.0.101", "enabled": True, "inverter_id": 0},
        "trucki": {"ip": "192.168.0.102", "enabled": True},
        "victron": {"ip": "192.168.0.111", "enabled": True},
    },
    "mqtt": {
        "enabled": False,
        "host": "192.168.0.201",
        "port": 1883,
        "username": "mqttvenus",
        "password": "mqttpw",
        "topic_prefix": "solar",
    },
    "victron_mqtt": {
        "enabled": True,
        "vrm_id": "b827eb79321c",
        "instances": [288, 289],
    },
    "influx": {
        "enabled": False,
        "url": "http://192.168.0.203:8086",
        "token": "",
        "org": "Solar Lokal",
        "bucket": "solar",
    },
}


async def get_config() -> Dict[str, Any]:
    doc = await db.config.find_one({"_id": "main"})
    if not doc:
        await db.config.insert_one({"_id": "main", **DEFAULT_CONFIG})
        return dict(DEFAULT_CONFIG)
    doc.pop("_id", None)
    # merge missing keys (robust: iteriere über DEFAULT_CONFIG, damit eine
    # Drift zwischen Config-Keys nie einen KeyError/Startup-Crash auslöst).
    cfg = {**DEFAULT_CONFIG, **doc}
    for k, default_val in DEFAULT_CONFIG.items():
        if isinstance(default_val, dict):
            cfg[k] = {**default_val, **(doc.get(k) or {})}
    return cfg


async def save_config(cfg: Dict[str, Any]) -> None:
    await db.config.update_one({"_id": "main"}, {"$set": cfg}, upsert=True)


# ---------- Mock generators ----------

def _sun_curve(now: datetime) -> float:
    """Returns 0..1 sun intensity based on hour of day."""
    h = now.hour + now.minute / 60.0
    if h < 5 or h > 21:
        return 0.0
    x = (h - 5) / 16.0  # 0..1 across day
    return max(0.0, math.sin(x * math.pi))


def mock_shelly() -> Dict[str, Any]:
    """Shelly Pro 3EM 3-phase. Positive total_act_power = consumption from grid."""
    now = datetime.now(timezone.utc)
    sun = _sun_curve(now)
    # House base load oscillates
    base = 350 + 200 * math.sin(time.time() / 60.0)
    pv = sun * 1450 + random.uniform(-30, 30)
    net = base - pv  # positive=import, negative=export
    # split across 3 phases unevenly
    phase_split = [0.42, 0.31, 0.27]
    phases = []
    for i, frac in enumerate(phase_split):
        p = net * frac
        voltage = 230.0 + random.uniform(-1.5, 1.5)
        current = abs(p) / voltage if voltage else 0
        phases.append({
            "phase": f"L{i+1}",
            "power": round(p, 1),
            "voltage": round(voltage, 1),
            "current": round(current, 3),
            "pf": round(0.93 + random.uniform(-0.05, 0.05), 2),
        })
    return {
        "online": True,
        "total_power": round(sum(ph["power"] for ph in phases), 1),
        "phases": phases,
    }


def mock_ahoy() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    sun = _sun_curve(now)
    channels = []
    total = 0.0
    for ch in range(1, 5):
        p = sun * (350 + random.uniform(-15, 15))
        total += p
        channels.append({
            "ch": ch,
            "power": round(p, 1),
            "voltage": round(34 + random.uniform(-2, 2), 1),
            "current": round((p / 34) if p else 0, 2),
            "yield_day": round(sun * 0.9 + random.uniform(0, 0.05), 3),
        })
    return {
        "online": True,
        "total_power": round(total, 1),
        "limit_percent": 100,
        "channels": channels,
    }


def mock_trucki() -> Dict[str, Any]:
    # SoC slowly drifts depending on solar
    sun = _sun_curve(datetime.now(timezone.utc))
    soc = 35 + 50 * sun + 8 * math.sin(time.time() / 300.0)
    soc = max(5, min(98, soc))
    charging = sun > 0.4
    return {
        "online": True,
        "soc": round(soc, 1),
        "battery_voltage": round(52.4 + (soc - 50) * 0.04, 2),
        "battery_power": round((400 if charging else -180) + random.uniform(-30, 30), 1),
        "ac_output": True,
        "zepc": charging,
        "temperature": round(28 + 8 * sun + random.uniform(-1, 1), 1),
        "target_w": 15,
        "min_w": 0,
        "max_w": 300,
        "throughput_day": round(8 + sun * 6 + random.uniform(-0.2, 0.2), 2),
        "total_kwh": round(5063.0 + soc * 0.3, 1),
    }


def mock_victron() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    sun = _sun_curve(now)
    mppts = []
    for idx in range(1, 3):
        pv = sun * (700 + random.uniform(-25, 25))
        mppts.append({
            "id": idx,
            "name": f"MPPT 150/35 #{idx}",
            "pv_power": round(pv, 1),
            "pv_voltage": round(95 + random.uniform(-5, 5), 1),
            "battery_voltage": round(52.4 + random.uniform(-0.2, 0.2), 2),
            "yield_today": round(sun * 1.2 + random.uniform(0, 0.1), 3),
            "state": "Bulk" if sun > 0.6 else ("Absorption" if sun > 0.3 else "Float"),
        })
    return {"online": True, "mppts": mppts, "total_power": round(sum(m["pv_power"] for m in mppts), 1)}


# ---------- Real fetchers (best effort, short timeout) ----------

async def _http_get(url: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(url)
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.debug(f"GET {url} failed: {e}")
    return None


async def fetch_shelly(ip: str) -> Optional[Dict[str, Any]]:
    data = await _http_get(f"http://{ip}/rpc/EM.GetStatus?id=0")
    if not data:
        return None
    phases = []
    for i in range(3):
        key = f"{chr(ord('a')+i)}"
        phases.append({
            "phase": f"L{i+1}",
            "power": data.get(f"{key}_act_power", 0),
            "voltage": data.get(f"{key}_voltage", 0),
            "current": data.get(f"{key}_current", 0),
            "pf": data.get(f"{key}_pf", 0),
        })
    return {
        "online": True,
        "total_power": data.get("total_act_power", sum(p["power"] for p in phases)),
        "phases": phases,
    }


async def fetch_ahoy(ip: str, inverter_id: int = 0) -> Optional[Dict[str, Any]]:
    live = await _http_get(f"http://{ip}/api/live")
    inv = await _http_get(f"http://{ip}/api/inverter/id/{inverter_id}")
    if not (live or inv):
        return None
    channels = []
    total = 0.0
    if inv and "ch" in inv:
        for idx, ch in enumerate(inv.get("ch", [])[1:], start=1):
            # ch arrays usually: [U_dc, I_dc, P_dc, YieldDay, YieldTotal, Irradiation]
            p = ch[2] if len(ch) > 2 else 0
            total += p or 0
            channels.append({
                "ch": idx,
                "power": p,
                "voltage": ch[0] if len(ch) > 0 else 0,
                "current": ch[1] if len(ch) > 1 else 0,
                "yield_day": ch[3] if len(ch) > 3 else 0,
            })
    return {
        "online": True,
        "total_power": total,
        "limit_percent": (inv or {}).get("power_limit_read", 100),
        "channels": channels,
    }


async def fetch_trucki(ip: str) -> Optional[Dict[str, Any]]:
    data = await _http_get(f"http://{ip}/status")
    if not data:
        return None
    return {
        "online": True,
        "soc": data.get("soc", 0),
        "battery_voltage": data.get("battery_voltage", 0),
        "battery_power": data.get("battery_power", 0),
        "ac_output": bool(data.get("ac_output", False)),
        "zepc": bool(data.get("zepc", False)),
        "temperature": data.get("temperature"),
        "target_w": data.get("target_w"),
        "min_w": data.get("min_w"),
        "max_w": data.get("max_w"),
        "throughput_day": data.get("throughput_day"),
        "total_kwh": data.get("total_kwh"),
    }


async def fetch_victron(ip: str) -> Optional[Dict[str, Any]]:
    # VenusOS Large exposes various REST endpoints; placeholder using /api/v1/system
    data = await _http_get(f"http://{ip}/api/v1/system")
    if not data:
        return None
    # Real parsing depends on user setup - return raw under mppts list
    return {"online": True, "mppts": data.get("mppts", []), "total_power": data.get("pv_power", 0)}


# ---------- Aggregator ----------

async def collect_live() -> Dict[str, Any]:
    cfg = await get_config()
    demo = cfg.get("demo_mode", True)
    mqtt_enabled = bool((cfg.get("mqtt") or {}).get("enabled"))

    async def get_dev(mqtt_fn, http_factory, mock_fn, enabled):
        if not enabled:
            return {"online": False}
        if demo:
            return mock_fn()
        # 1. Prefer MQTT
        if mqtt_enabled:
            try:
                d = mqtt_fn()
                if d is not None:
                    return d
            except Exception as e:
                logger.debug(f"mqtt fetch error: {e}")
        # 2. HTTP fallback
        d = await http_factory()
        if d is None:
            mocked = mock_fn()
            mocked["online"] = False
            mocked["_fallback"] = True
            return mocked
        return d

    shelly, ahoy, trucki, victron = await asyncio.gather(
        get_dev(
            fetch_shelly_from_mqtt,
            lambda: fetch_shelly(cfg["devices"]["shelly"]["ip"]),
            mock_shelly,
            cfg["devices"]["shelly"]["enabled"],
        ),
        get_dev(
            fetch_ahoy_from_mqtt,
            lambda: fetch_ahoy(cfg["devices"]["ahoy"]["ip"], cfg["devices"]["ahoy"].get("inverter_id", 0)),
            mock_ahoy,
            cfg["devices"]["ahoy"]["enabled"],
        ),
        get_dev(
            fetch_trucki_from_mqtt,
            lambda: fetch_trucki(cfg["devices"]["trucki"]["ip"]),
            mock_trucki,
            cfg["devices"]["trucki"]["enabled"],
        ),
        get_dev(
            lambda: fetch_victron_from_mqtt(cfg.get("victron_mqtt") or {}),
            lambda: fetch_victron(cfg["devices"]["victron"]["ip"]),
            mock_victron,
            cfg["devices"]["victron"]["enabled"],
        ),
    )

    # DC-gekoppeltes System (vom Nutzer bestätigt):
    #  - Victron-MPPTs laden den Akku (DC), speisen NICHT direkt ins Haus.
    #  - Hoymiles HM1500 speist AC direkt ins Haus/Netz.
    #  - Trucki/SUN-Wechselrichter entlädt den Akku ins AC-Netz.
    #  - Shelly Pro 3EM misst am Netzanschluss (+Bezug / −Einspeisung).
    pv_ac_power = ahoy.get("total_power", 0) or 0       # Hoymiles AC → Haus
    pv_dc_power = victron.get("total_power", 0) or 0     # Victron MPPT → Akku (laden)
    pv_power = pv_ac_power + pv_dc_power                  # Gesamt-PV-Erzeugung (KPI)
    grid_power = shelly.get("total_power", 0) or 0       # >0 Bezug, <0 Einspeisung

    # Trucki/SUN: battery_power < 0 = entlädt (AC-Ausgang ins Haus)
    trucki_bp = trucki.get("battery_power", 0) or 0
    battery_discharge_w = max(0.0, -trucki_bp)           # SUN-Entladung → Haus (AC)
    battery_charge_w = max(0.0, pv_dc_power)             # MPPT-Ladung (DC) in den Akku
    # Netto-Akku: + = lädt netto, − = entlädt netto
    battery_net = battery_charge_w - battery_discharge_w

    # AC-Bus-Bilanz: Hausverbrauch = Hoymiles-AC + SUN-Entladung + Netzbezug
    house_power = pv_ac_power + battery_discharge_w + grid_power
    house_power = max(0.0, house_power)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "demo_mode": demo,
        "shelly": shelly,
        "ahoy": ahoy,
        "trucki": trucki,
        "victron": victron,
        "summary": {
            "pv_power": round(pv_power, 1),
            "pv_ac_power": round(pv_ac_power, 1),
            "pv_dc_power": round(pv_dc_power, 1),
            "grid_power": round(grid_power, 1),
            "battery_power": round(battery_net, 1),
            "battery_charge_w": round(battery_charge_w, 1),
            "battery_discharge_w": round(battery_discharge_w, 1),
            "house_power": round(max(0, house_power), 1),
            "battery_soc": trucki.get("soc", 0),
        },
    }


# ---------- API Models ----------

class ConfigUpdate(BaseModel):
    demo_mode: Optional[bool] = None
    devices: Optional[Dict[str, Any]] = None
    mqtt: Optional[Dict[str, Any]] = None
    influx: Optional[Dict[str, Any]] = None
    victron_mqtt: Optional[Dict[str, Any]] = None


class HoymilesControl(BaseModel):
    action: str  # limit | start | stop | power_on | power_off | restart
    value: Optional[int] = None


class TruckiControl(BaseModel):
    action: str  # limit | zepc_on | zepc_off | restart
    value: Optional[int] = None


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


# ---------- Background poller ----------

_poller_state = {"running": False, "last_write": None, "count": 0}
_influx_state: Dict[str, Any] = {"connected": False, "last_error": None, "writes": 0, "client": None, "write_api": None}
_poll_task: Optional[asyncio.Task] = None
_keepalive_task: Optional[asyncio.Task] = None


def _instant_ratios(summary: Dict[str, Any]) -> tuple:
    """Momentane Autarkie & Eigenverbrauch in % aus der Live-Summary."""
    hp = float(summary.get("house_power", 0) or 0)
    gp = float(summary.get("grid_power", 0) or 0)
    pv = float(summary.get("pv_power", 0) or 0)
    grid_imp = max(0.0, gp)
    grid_exp = max(0.0, -gp)
    autarky = (hp - grid_imp) / hp * 100.0 if hp > 0 else 0.0
    self_cons = (pv - grid_exp) / pv * 100.0 if pv > 0 else 0.0
    return (max(0.0, min(100.0, autarky)), max(0.0, min(100.0, self_cons)))


def _pt_solar(summary: Dict[str, Any]) -> "Point":
    """Summary-Measurement inkl. momentaner Autarkie/Eigenverbrauch."""
    def f(k: str) -> float:
        return float(summary.get(k, 0) or 0)
    autarky, self_cons = _instant_ratios(summary)
    return (
        Point("solar")
        .field("pv_power", f("pv_power"))
        .field("pv_ac_power", f("pv_ac_power"))
        .field("pv_dc_power", f("pv_dc_power"))
        .field("grid_power", f("grid_power"))
        .field("battery_power", f("battery_power"))
        .field("battery_charge_w", f("battery_charge_w"))
        .field("battery_discharge_w", f("battery_discharge_w"))
        .field("house_power", f("house_power"))
        .field("battery_soc", f("battery_soc"))
        .field("autarky_pct", round(autarky, 1))
        .field("self_consumption_pct", round(self_cons, 1))
    )


def _pts_shelly(shelly: Dict[str, Any]) -> list:
    pts = [
        Point("shelly_phase")
        .tag("phase", str(ph.get("phase", "?")))
        .field("power", float(ph.get("power", 0) or 0))
        .field("voltage", float(ph.get("voltage", 0) or 0))
        .field("current", float(ph.get("current", 0) or 0))
        .field("pf", float(ph.get("pf", 0) or 0))
        for ph in (shelly.get("phases") or [])
    ]
    if shelly.get("total_power") is not None:
        pts.append(Point("shelly").field("total_power", float(shelly.get("total_power", 0) or 0)))
    return pts


def _pts_hoymiles(ahoy: Dict[str, Any]) -> list:
    pts = []
    if ahoy.get("total_power") is not None:
        pts.append(
            Point("hoymiles")
            .field("total_power", float(ahoy.get("total_power", 0) or 0))
            .field("limit_percent", float(ahoy.get("limit_percent", 0) or 0))
        )
    pts.extend(
        Point("hoymiles_ch")
        .tag("ch", str(ch.get("ch", "?")))
        .field("power", float(ch.get("power", 0) or 0))
        .field("voltage", float(ch.get("voltage", 0) or 0))
        .field("current", float(ch.get("current", 0) or 0))
        .field("yield_day", float(ch.get("yield_day", 0) or 0))
        for ch in (ahoy.get("channels") or [])
    )
    return pts


def _pts_victron(victron: Dict[str, Any]) -> list:
    pts = []
    if victron.get("total_power") is not None:
        pts.append(Point("victron").field("total_power", float(victron.get("total_power", 0) or 0)))
    for m in (victron.get("mppts") or []):
        vp = (
            Point("victron_mppt")
            .tag("mppt", str(m.get("id", "?")))
            .field("pv_power", float(m.get("pv_power", 0) or 0))
            .field("pv_voltage", float(m.get("pv_voltage", 0) or 0))
            .field("battery_voltage", float(m.get("battery_voltage", 0) or 0))
            .field("yield_today", float(m.get("yield_today", 0) or 0))
        )
        if m.get("state") is not None:
            vp = vp.field("state", str(m.get("state")))
        pts.append(vp)
    return pts


def _pt_trucki(trucki: Dict[str, Any]) -> Optional["Point"]:
    if not trucki.get("online"):
        return None
    tp = (
        Point("trucki")
        .field("vbat", float(trucki.get("battery_voltage", 0) or 0))
        .field("ac_power", float(trucki.get("battery_power", 0) or 0))
        .field("soc", float(trucki.get("soc", 0) or 0))
        .field("zepc", 1 if trucki.get("zepc") else 0)
    )
    for src, dst in [
        ("temperature", "temperature"),
        ("ac_setpoint_w", "ac_setpoint"),
        ("ac_display_w", "ac_display"),
        ("day_energy_kwh", "day_energy"),
        ("total_energy_kwh", "total_energy"),
    ]:
        if trucki.get(src) is not None:
            tp = tp.field(dst, float(trucki.get(src, 0) or 0))
    return tp


def _build_influx_points(data: Dict[str, Any]) -> list:
    """Erzeugt einen reichen Satz InfluxDB-Punkte aus einer collect_live()-Payload.

    Measurements:
      - solar        : Summary (pv/grid/battery/house/soc + autarky/self-consumption %)
      - shelly_phase : pro Phase (tag phase=L1..L3) power/voltage/current/pf
      - shelly       : total_power
      - hoymiles     : total_power, limit_percent
      - hoymiles_ch  : pro Kanal (tag ch=1..4) power/voltage/current/yield_day
      - victron      : total_power
      - victron_mppt : pro MPPT (tag mppt=<instanz>) pv_power/pv_voltage/battery_voltage/yield_today/state
      - trucki       : vbat/ac_power/soc/zepc/temperature/ac_setpoint/ac_display/day_energy/total_energy
    """
    pts: list = [_pt_solar(data.get("summary") or {})]
    pts += _pts_shelly(data.get("shelly") or {})
    pts += _pts_hoymiles(data.get("ahoy") or {})
    pts += _pts_victron(data.get("victron") or {})
    trucki_pt = _pt_trucki(data.get("trucki") or {})
    if trucki_pt is not None:
        pts.append(trucki_pt)
    return pts


async def poller_loop():
    _poller_state["running"] = True
    while True:
        try:
            data = await collect_live()
            snap = {
                "ts": data["timestamp"],
                "pv_power": data["summary"]["pv_power"],
                "grid_power": data["summary"]["grid_power"],
                "battery_power": data["summary"]["battery_power"],
                "battery_charge_w": data["summary"]["battery_charge_w"],
                "battery_discharge_w": data["summary"]["battery_discharge_w"],
                "house_power": data["summary"]["house_power"],
                "battery_soc": data["summary"]["battery_soc"],
            }
            await db.snapshots.insert_one(snap)
            _poller_state["last_write"] = snap["ts"]
            _poller_state["count"] += 1
            # InfluxDB optional write (reicher Punkte-Satz pro Gerät)
            if _influx_state["write_api"] is not None:
                try:
                    points = _build_influx_points(data)
                    _influx_state["write_api"].write(bucket=_influx_state["bucket"], record=points)
                    _influx_state["writes"] += 1
                except Exception as e:
                    _influx_state["last_error"] = str(e)
        except Exception as e:
            logger.exception("poller error: %s", e)
        await asyncio.sleep(15)


# ---------- Influx setup ----------

def _influx_disconnect():
    try:
        wa = _influx_state.get("write_api")
        cl = _influx_state.get("client")
        if wa:
            wa.close()
        if cl:
            cl.close()
    except Exception:
        pass
    _influx_state["write_api"] = None
    _influx_state["client"] = None
    _influx_state["connected"] = False


def _influx_setup(cfg_influx: Dict[str, Any]):
    _influx_disconnect()
    if InfluxDBClient is None or not cfg_influx.get("enabled"):
        return
    try:
        cl = InfluxDBClient(url=cfg_influx["url"], token=cfg_influx["token"], org=cfg_influx.get("org"))
        # ping check
        ready = cl.ready()
        wa = cl.write_api(write_options=SYNCHRONOUS)
        _influx_state["client"] = cl
        _influx_state["write_api"] = wa
        _influx_state["bucket"] = cfg_influx.get("bucket")
        _influx_state["connected"] = bool(ready)
        _influx_state["last_error"] = None
    except Exception as e:
        _influx_state["last_error"] = str(e)
        _influx_state["connected"] = False


async def restart_integrations():
    cfg = await get_config()
    _mqtt_setup(cfg.get("mqtt", {}), cfg.get("victron_mqtt", {}))
    _influx_setup(cfg.get("influx", {}))


async def victron_keepalive_loop():
    """VenusOS only publishes data while it receives periodic keep-alive messages."""
    while True:
        try:
            cfg = await get_config()
            vmq = cfg.get("victron_mqtt") or {}
            cl = _mqtt_state.get("client")
            if vmq.get("enabled") and vmq.get("vrm_id") and cl and _mqtt_state.get("connected"):
                try:
                    cl.publish(f"R/{vmq['vrm_id']}/keepalive", "", qos=0)
                except Exception as e:
                    logger.debug(f"keepalive publish error: {e}")
        except Exception:
            pass
        await asyncio.sleep(30)


# ---------- App lifecycle ----------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await get_config()
    global _poll_task, _keepalive_task
    _poll_task = asyncio.create_task(poller_loop())
    _keepalive_task = asyncio.create_task(victron_keepalive_loop())
    await restart_integrations()
    logger.info("Solar dashboard started")


@app.on_event("shutdown")
async def on_shutdown():
    if _poll_task:
        _poll_task.cancel()
    if _keepalive_task:
        _keepalive_task.cancel()
    _mqtt_disconnect()
    _influx_disconnect()
    client.close()
