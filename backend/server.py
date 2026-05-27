"""Solar Local Dashboard backend.

Aggregates data from Shelly Pro 3EM, Ahoy DTU (Hoymiles HM1500),
Trucki2Shelly Gateway and Victron MPPT (VenusOS). Provides live values,
history, daily totals, device control and integration (MQTT/InfluxDB).
"""

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import math
import random
import time
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
import httpx

# Optional integrations - imported lazily inside functions where possible
try:
    import paho.mqtt.client as mqtt
except Exception:  # pragma: no cover
    mqtt = None

try:
    from influxdb_client import InfluxDBClient, Point, WriteOptions
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
        "username": "",
        "password": "",
        "topic_prefix": "solar",
    },
    "influx": {
        "enabled": False,
        "url": "http://192.168.0.203:8086",
        "token": "",
        "org": "home",
        "bucket": "solar",
    },
}


async def get_config() -> Dict[str, Any]:
    doc = await db.config.find_one({"_id": "main"})
    if not doc:
        await db.config.insert_one({"_id": "main", **DEFAULT_CONFIG})
        return dict(DEFAULT_CONFIG)
    doc.pop("_id", None)
    # merge missing keys
    cfg = {**DEFAULT_CONFIG, **doc}
    for k in ["devices", "mqtt", "influx"]:
        cfg[k] = {**DEFAULT_CONFIG[k], **(doc.get(k) or {})}
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
        "total_power": round(sum(p["power"] for p in phases), 1),
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

async def _http_get(url: str, timeout: float = 1.5) -> Optional[Dict[str, Any]]:
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

    async def safe(real_factory, mock_fn, enabled):
        if not enabled:
            return {"online": False}
        if demo:
            return mock_fn()
        data = await real_factory()
        if data is None:
            mocked = mock_fn()
            mocked["online"] = False
            mocked["_fallback"] = True
            return mocked
        return data

    shelly_task = safe(lambda: fetch_shelly(cfg["devices"]["shelly"]["ip"]), mock_shelly, cfg["devices"]["shelly"]["enabled"])
    ahoy_task = safe(
        lambda: fetch_ahoy(cfg["devices"]["ahoy"]["ip"], cfg["devices"]["ahoy"].get("inverter_id", 0)),
        mock_ahoy,
        cfg["devices"]["ahoy"]["enabled"],
    )
    trucki_task = safe(lambda: fetch_trucki(cfg["devices"]["trucki"]["ip"]), mock_trucki, cfg["devices"]["trucki"]["enabled"])
    victron_task = safe(lambda: fetch_victron(cfg["devices"]["victron"]["ip"]), mock_victron, cfg["devices"]["victron"]["enabled"])

    shelly, ahoy, trucki, victron = await asyncio.gather(shelly_task, ahoy_task, trucki_task, victron_task)

    pv_power = (ahoy.get("total_power", 0) or 0) + (victron.get("total_power", 0) or 0)
    grid_power = shelly.get("total_power", 0) or 0  # >0 import, <0 export
    battery_power = trucki.get("battery_power", 0) or 0  # >0 charging
    house_power = pv_power - grid_power - battery_power
    if grid_power < 0:
        house_power = pv_power + grid_power - battery_power

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "demo_mode": demo,
        "shelly": shelly,
        "ahoy": ahoy,
        "trucki": trucki,
        "victron": victron,
        "summary": {
            "pv_power": round(pv_power, 1),
            "grid_power": round(grid_power, 1),
            "battery_power": round(battery_power, 1),
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
    # Restart integrations
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
        }

    def trapez(values_a, values_b, t_a, t_b):
        dt_h = (t_b - t_a).total_seconds() / 3600.0
        return (values_a + values_b) / 2.0 * dt_h

    pv_wh = grid_imp_wh = grid_exp_wh = house_wh = 0.0
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
    ip = cfg["devices"]["trucki"]["ip"]
    # Trucki2Shelly HTTP endpoints
    if cmd.action == "limit":
        if cmd.value is None:
            raise HTTPException(400, "value (W) erforderlich für limit")
        url = f"http://{ip}/Limit?L={int(cmd.value)}"
    else:
        endpoint_map = {
            "zepc_on": "/zepc/on",
            "zepc_off": "/zepc/off",
            "restart": "/restart",
        }
        if cmd.action not in endpoint_map:
            raise HTTPException(400, f"Unknown action {cmd.action}")
        url = f"http://{ip}{endpoint_map[cmd.action]}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(url)
            return {"ok": r.status_code == 200, "response": r.text}
    except Exception as e:
        raise HTTPException(502, f"Trucki unreachable: {e}")


@api_router.get("/integrations/status")
async def integrations_status():
    return {
        "mqtt": {"connected": _mqtt_state["connected"], "last_error": _mqtt_state["last_error"], "messages": _mqtt_state["messages"]},
        "influx": {"connected": _influx_state["connected"], "last_error": _influx_state["last_error"], "writes": _influx_state["writes"]},
        "poller": {"running": _poller_state["running"], "last_write": _poller_state["last_write"], "count": _poller_state["count"]},
    }


# ---------- Background poller ----------

_poller_state = {"running": False, "last_write": None, "count": 0}
_mqtt_state: Dict[str, Any] = {"connected": False, "last_error": None, "messages": 0, "client": None}
_influx_state: Dict[str, Any] = {"connected": False, "last_error": None, "writes": 0, "client": None, "write_api": None}
_poll_task: Optional[asyncio.Task] = None


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
                "house_power": data["summary"]["house_power"],
                "battery_soc": data["summary"]["battery_soc"],
            }
            await db.snapshots.insert_one(snap)
            _poller_state["last_write"] = snap["ts"]
            _poller_state["count"] += 1
            # InfluxDB optional write
            if _influx_state["write_api"] is not None:
                try:
                    p = (
                        Point("solar")
                        .field("pv_power", float(snap["pv_power"]))
                        .field("grid_power", float(snap["grid_power"]))
                        .field("battery_power", float(snap["battery_power"]))
                        .field("house_power", float(snap["house_power"]))
                        .field("battery_soc", float(snap["battery_soc"]))
                    )
                    _influx_state["write_api"].write(bucket=_influx_state["bucket"], record=p)
                    _influx_state["writes"] += 1
                except Exception as e:
                    _influx_state["last_error"] = str(e)
        except Exception as e:
            logger.exception("poller error: %s", e)
        await asyncio.sleep(15)


# ---------- MQTT subscriber ----------

def _mqtt_disconnect():
    cl = _mqtt_state.get("client")
    if cl:
        try:
            cl.loop_stop()
            cl.disconnect()
        except Exception:
            pass
    _mqtt_state["client"] = None
    _mqtt_state["connected"] = False


def _mqtt_setup(cfg_mqtt: Dict[str, Any]):
    _mqtt_disconnect()
    if mqtt is None or not cfg_mqtt.get("enabled"):
        return
    cl = mqtt.Client(client_id="solar-dashboard")
    if cfg_mqtt.get("username"):
        cl.username_pw_set(cfg_mqtt["username"], cfg_mqtt.get("password", ""))

    def on_connect(client_, userdata, flags, rc):
        if rc == 0:
            _mqtt_state["connected"] = True
            _mqtt_state["last_error"] = None
            prefix = cfg_mqtt.get("topic_prefix", "solar")
            client_.subscribe(f"{prefix}/#")
        else:
            _mqtt_state["connected"] = False
            _mqtt_state["last_error"] = f"rc={rc}"

    def on_message(client_, userdata, msg):
        _mqtt_state["messages"] += 1

    def on_disconnect(client_, userdata, rc):
        _mqtt_state["connected"] = False

    cl.on_connect = on_connect
    cl.on_message = on_message
    cl.on_disconnect = on_disconnect
    try:
        cl.connect_async(cfg_mqtt.get("host", "127.0.0.1"), int(cfg_mqtt.get("port", 1883)), keepalive=30)
        cl.loop_start()
        _mqtt_state["client"] = cl
    except Exception as e:
        _mqtt_state["last_error"] = str(e)


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
    _mqtt_setup(cfg.get("mqtt", {}))
    _influx_setup(cfg.get("influx", {}))


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
    global _poll_task
    _poll_task = asyncio.create_task(poller_loop())
    await restart_integrations()
    logger.info("Solar dashboard started")


@app.on_event("shutdown")
async def on_shutdown():
    if _poll_task:
        _poll_task.cancel()
    _mqtt_disconnect()
    _influx_disconnect()
    client.close()
