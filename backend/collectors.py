"""Device fetchers and live-data aggregator – extracted from server.py.

Pure collection logic, no app/DB dependencies.  ``collect_live`` receives the
config dict so that this module never imports from ``server`` (avoids circular
imports).
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from mqtt_client import (
    fetch_shelly_from_mqtt,
    fetch_ahoy_from_mqtt,
    fetch_trucki_from_mqtt,
    fetch_victron_from_mqtt,
)
from mocks import mock_shelly, mock_ahoy, mock_trucki, mock_victron
from sun import event_times, sun_times, sun_intensity, DEFAULT_LAT, DEFAULT_LON

logger = logging.getLogger("solar")


# ---------- HTTP helper ----------

async def _http_get(url: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(url)
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.debug(f"GET {url} failed: {e}")
    return None


# ---------- Real device fetchers (best effort, short timeout) ----------

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
        "max_power_w": (inv or {}).get("max_power_w") or (inv or {}).get("max_power"),
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
        "max_power_w": data.get("max_power_w", data.get("max_power")),
        "ac_output": bool(data.get("ac_output", False)),
        "zepc": bool(data.get("zepc", False)),
    }


async def fetch_victron(ip: str) -> Optional[Dict[str, Any]]:
    data = await _http_get(f"http://{ip}/api/v1/system")
    if not data:
        return None
    return {"online": True, "mppts": data.get("mppts", []), "total_power": data.get("pv_power", 0)}


# ---------- Live-data aggregator ----------

async def collect_live(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Collect live data from all devices.  *cfg* is the full config dict
    (previously obtained via ``get_config()``).
    """
    demo = cfg.get("demo_mode", True)
    mqtt_enabled = bool((cfg.get("mqtt") or {}).get("enabled"))

    # Realistische Sonnenzeiten aus Standort (für Demo-Intensität + Payload).
    loc = cfg.get("location") or {}
    lat = loc.get("lat", DEFAULT_LAT)
    lon = loc.get("lon", DEFAULT_LON)
    now_dt = datetime.now(timezone.utc)
    st = sun_times(lat, lon, now_dt)
    sunrise_dt, sunset_dt = st if st else (None, None)
    intensity = sun_intensity(now_dt, sunrise_dt, sunset_dt)
    civil = event_times(lat, lon, now_dt, -6.0)       # blaue Stunde / bürgerliche Dämmerung
    astro = event_times(lat, lon, now_dt, -18.0)       # astronomische Dämmerung (Nacht)
    golden = event_times(lat, lon, now_dt, 6.0)        # goldene Stunde (Sonne bis 6°)
    _iso = lambda d: d.isoformat() if d else None
    sun_payload = {
        "sunrise": _iso(sunrise_dt),
        "sunset": _iso(sunset_dt),
        "civil_dawn": _iso(civil[0]) if civil else None,
        "civil_dusk": _iso(civil[1]) if civil else None,
        "astro_dawn": _iso(astro[0]) if astro else None,
        "astro_dusk": _iso(astro[1]) if astro else None,
        "golden_morning_end": _iso(golden[0]) if golden else None,
        "golden_evening_start": _iso(golden[1]) if golden else None,
    }

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

    devs = cfg.get("devices")
    if not isinstance(devs, dict):
        devs = {}

    def dcfg(name):
        v = devs.get(name)
        return v if isinstance(v, dict) else {}

    shelly, ahoy, trucki, victron = await asyncio.gather(
        get_dev(
            fetch_shelly_from_mqtt,
            lambda: fetch_shelly(dcfg("shelly").get("ip", "")),
            lambda: mock_shelly(intensity),
            dcfg("shelly").get("enabled", False),
        ),
        get_dev(
            fetch_ahoy_from_mqtt,
            lambda: fetch_ahoy(dcfg("ahoy").get("ip", ""), dcfg("ahoy").get("inverter_id", 0)),
            lambda: mock_ahoy(intensity),
            dcfg("ahoy").get("enabled", False),
        ),
        get_dev(
            fetch_trucki_from_mqtt,
            lambda: fetch_trucki(dcfg("trucki").get("ip", "")),
            lambda: mock_trucki(intensity),
            dcfg("trucki").get("enabled", False),
        ),
        get_dev(
            lambda: fetch_victron_from_mqtt(cfg.get("victron_mqtt") or {}),
            lambda: fetch_victron(dcfg("victron").get("ip", "")),
            lambda: mock_victron(intensity),
            dcfg("victron").get("enabled", False),
        ),
    )

    # DC-gekoppeltes System (vom Nutzer bestätigt):
    #  - Victron-MPPTs laden den Akku (DC), speisen NICHT direkt ins Haus.
    #  - Hoymiles HM1500 speist AC direkt ins Haus/Netz.
    #  - Trucki/SUN-Wechselrichter entlädt den Akku ins AC-Netz.
    #  - Shelly Pro 3EM misst am Netzanschluss (+Bezug / −Einspeisung).
    pv_ac_power = ahoy.get("total_power", 0) or 0
    pv_dc_power = victron.get("total_power", 0) or 0
    pv_power = pv_ac_power + pv_dc_power
    grid_power = shelly.get("total_power", 0) or 0

    trucki_bp = trucki.get("battery_power", 0) or 0
    battery_discharge_w = max(0.0, -trucki_bp)
    battery_charge_w = max(0.0, pv_dc_power)
    battery_net = battery_charge_w - battery_discharge_w

    house_power = pv_ac_power + battery_discharge_w + grid_power
    house_power = max(0.0, house_power)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "demo_mode": demo,
        "sun": {
            "sunrise": sunrise_dt.isoformat() if sunrise_dt else None,
            "sunset": sunset_dt.isoformat() if sunset_dt else None,
            **sun_payload,
        },
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
