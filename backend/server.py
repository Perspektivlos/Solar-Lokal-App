"""Solar Local Dashboard backend.

Aggregates data from Shelly Pro 3EM, Ahoy DTU (Hoymiles HM1500),
Trucki2Shelly Gateway and Victron MPPT (VenusOS). Provides live values,
history, daily totals, device control and integration (MQTT/InfluxDB).
"""

from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from pydantic import BaseModel
from typing import Any, AsyncIterator, Dict, Optional
from contextlib import asynccontextmanager

from mqtt_client import (
    _mqtt_data,
    _mqtt_state,
    _mqtt_setup,
    _mqtt_disconnect,
)
from collectors import collect_live

# Optional integrations - imported lazily inside functions where possible
try:
    from influxdb_client import InfluxDBClient, Point
    from influxdb_client.client.write_api import SYNCHRONOUS
except Exception:  # pragma: no cover
    InfluxDBClient = None

from mocks import (
    _sun_curve,
    mock_shelly,
    mock_ahoy,
    mock_trucki,
    mock_victron,
)
from influx_points import (
    _instant_ratios,
    _pt_solar,
    _pts_shelly,
    _pts_hoymiles,
    _pts_victron,
    _pt_trucki,
    _build_influx_points,
)
from alarms import evaluate_alarms, merge_thresholds

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # startup
    await get_config()
    # Index für schnelle History-Abfragen & Retention-Deletes
    try:
        await db.snapshots.create_index("ts")
    except Exception as e:
        logger.warning("snapshot index create failed: %s", e)
    global _poll_task, _keepalive_task, _retention_task
    _poll_task = asyncio.create_task(poller_loop())
    _keepalive_task = asyncio.create_task(victron_keepalive_loop())
    _retention_task = asyncio.create_task(retention_loop())  # noqa: F821 (late-bound below)
    await restart_integrations()
    logger.info("Solar dashboard started")
    yield
    # shutdown
    if _poll_task:
        _poll_task.cancel()
    if _keepalive_task:
        _keepalive_task.cancel()
    if _retention_task:
        _retention_task.cancel()
    _mqtt_disconnect()
    _influx_disconnect()
    client.close()


app = FastAPI(title="Solar Local Dashboard", lifespan=lifespan)

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
    "retention": {
        "enabled": True,
        "days": 30,
    },
    "alarms": {
        "enabled": True,
        "grid_voltage": {"under": 207.0, "over": 253.0, "under_crit": 195.0, "over_crit": 265.0},
        "phase_current": {"over": 25.0, "over_crit": 32.0},
        "battery_voltage": {"under": 48.0, "over": 56.0, "under_crit": 46.4, "over_crit": 57.6},
        "battery_soc": {"under": 15.0, "under_crit": 8.0},
    },
    "grafana_url": "http://192.168.0.202:3000",
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


# ---------- API Models ----------

class ConfigUpdate(BaseModel):
    demo_mode: Optional[bool] = None
    devices: Optional[Dict[str, Any]] = None
    mqtt: Optional[Dict[str, Any]] = None
    influx: Optional[Dict[str, Any]] = None
    victron_mqtt: Optional[Dict[str, Any]] = None
    retention: Optional[Dict[str, Any]] = None
    alarms: Optional[Dict[str, Any]] = None
    grafana_url: Optional[str] = None


class HoymilesControl(BaseModel):
    action: str  # limit | start | stop | power_on | power_off | restart
    value: Optional[int] = None


class TruckiControl(BaseModel):
    action: str  # limit | zepc_on | zepc_off | restart
    value: Optional[int] = None


# ---------- Background poller ----------

_poller_state = {"running": False, "last_write": None, "count": 0}
_retention_state: Dict[str, Any] = {"last_run": None, "last_deleted": 0, "total_deleted": 0, "last_error": None}
_influx_state: Dict[str, Any] = {"connected": False, "last_error": None, "writes": 0, "client": None, "write_api": None}
_poll_task: Optional[asyncio.Task] = None
_keepalive_task: Optional[asyncio.Task] = None
_retention_task: Optional[asyncio.Task] = None


async def poller_loop() -> None:
    _poller_state["running"] = True
    while True:
        try:
            cfg = await get_config()
            data = await collect_live(cfg)
            # Alarme auswerten und an data hängen (für InfluxDB-Zeitreihe)
            _ac = cfg.get("alarms") or {}
            if _ac.get("enabled", True) is False:
                data["alarms"] = []
            else:
                data["alarms"] = evaluate_alarms(
                    data,
                    mqtt_connected=bool(_mqtt_state.get("connected")),
                    mqtt_enabled=bool((cfg.get("mqtt") or {}).get("enabled")),
                    thresholds=merge_thresholds(_ac),
                )
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

def _influx_disconnect() -> None:
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


def _influx_setup(cfg_influx: Dict[str, Any]) -> None:
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


async def restart_integrations() -> None:
    cfg = await get_config()
    _mqtt_setup(cfg.get("mqtt", {}), cfg.get("victron_mqtt", {}))
    _influx_setup(cfg.get("influx", {}))


async def victron_keepalive_loop() -> None:
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


# ---------- Retention (auto cleanup of old snapshots) ----------

async def _cleanup_snapshots_once(days: int) -> int:
    """Delete snapshots older than `days`. Returns number of deleted docs."""
    if days <= 0:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    # Snapshots werden als ISO-String gespeichert (siehe poller_loop).
    # ISO 8601 ist lexikographisch sortierbar -> $lt String-Vergleich ist korrekt.
    result = await db.snapshots.delete_many({"ts": {"$lt": cutoff.isoformat()}})
    return int(result.deleted_count or 0)


async def retention_loop() -> None:
    """Hourly background task that thins out old snapshot data."""
    # Kurz warten, damit Startup nicht sofort I/O feuert
    await asyncio.sleep(60)
    while True:
        try:
            cfg = await get_config()
            ret = cfg.get("retention") or {}
            if ret.get("enabled", True):
                days = int(ret.get("days", 30))
                deleted = await _cleanup_snapshots_once(days)
                _retention_state["last_deleted"] = deleted
                _retention_state["total_deleted"] += deleted
                _retention_state["last_error"] = None
                if deleted:
                    logger.info("retention: %d alte Snapshots (>%dd) gelöscht", deleted, days)
            _retention_state["last_run"] = datetime.now(timezone.utc).isoformat()
        except Exception as e:
            _retention_state["last_error"] = str(e)
            logger.exception("retention error: %s", e)
        await asyncio.sleep(3600)  # stündlich prüfen


# ---------- App lifecycle ----------

from routes import api_router  # noqa: E402  (späte Bindung gegen Zirkularimport)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
