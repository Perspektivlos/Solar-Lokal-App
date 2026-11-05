"""Mock-Datengeneratoren für den Demo-Modus (reine Funktionen)."""
import math
import random
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

from sun import sun_times, sun_intensity, DEFAULT_LAT, DEFAULT_LON
from smartshunt import mock_smartshunt


def _sun_curve(now: datetime, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> float:
    """0..1 Sonnenintensität aus realen Auf-/Untergangszeiten (standortabhängig)."""
    t = sun_times(lat, lon, now)
    if not t:
        return 0.0
    return sun_intensity(now, t[0], t[1])


def _solar_hours_today(now: datetime, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> float:
    """Zeitintegral der Sonnenintensität seit Sonnenaufgang; steigt tagsüber nur an."""
    times = sun_times(lat, lon, now)
    if not times or now <= times[0]:
        return 0.0
    start, end = times[0], min(now, times[1])
    if end <= start:
        return 0.0
    total = 0.0
    cursor = start
    step = timedelta(minutes=5)
    while cursor < end:
        nxt = min(cursor + step, end)
        midpoint = cursor + (nxt - cursor) / 2
        total += sun_intensity(midpoint, times[0], times[1]) * (nxt - cursor).total_seconds() / 3600.0
        cursor = nxt
    return total


def _trucki_energy_today(now: datetime, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> float:
    """Deterministisches Tagesintegral des simulierten SUN-2000-Ausgangs."""
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    total_wh = 0.0
    cursor = start
    step = timedelta(minutes=10)
    while cursor < now:
        nxt = min(cursor + step, now)
        midpoint = cursor + (nxt - cursor) / 2
        discharge_w = max(0.0, 260 - _sun_curve(midpoint, lat, lon) * 210)
        total_wh += discharge_w * (nxt - cursor).total_seconds() / 3600.0
        cursor = nxt
    return total_wh / 1000.0


def mock_shelly(intensity=None) -> Dict[str, Any]:
    """Shelly Pro 3EM 3-phase. Positive total_act_power = consumption from grid."""
    now = datetime.now(timezone.utc)
    sun = _sun_curve(now) if intensity is None else intensity
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


def mock_ahoy(intensity=None, now=None, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    sun = _sun_curve(now, lat, lon) if intensity is None else intensity
    solar_hours = _solar_hours_today(now, lat, lon)
    channel_factors = (0.98, 1.01, 0.99, 1.02)
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
            "yield_day": round(0.35 * solar_hours * channel_factors[ch - 1], 3),
        })
    return {
        "online": True,
        "total_power": round(total, 1),
        "max_power_w": 1500,
        "limit_percent": 100,
        "channels": channels,
    }


def mock_trucki(intensity=None, now=None, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> Dict[str, Any]:
    # SoC slowly drifts depending on solar
    now = now or datetime.now(timezone.utc)
    sun = _sun_curve(now, lat, lon) if intensity is None else intensity
    soc = 35 + 50 * sun + 8 * math.sin(time.time() / 300.0)
    soc = max(5, min(98, soc))
    # Trucki/SUN entlädt den Akku ins AC-Netz (DC-gekoppelt: nur Entladung,
    # nie Ladung). Tagsüber deckt PV mehr Last → weniger Entladung.
    discharge = max(0.0, 260 - sun * 210 + random.uniform(-25, 25))
    battery_power = -round(discharge, 1)  # negativ = entlädt (SUN → Haus)
    return {
        "online": True,
        "soc": round(soc, 1),
        "battery_voltage": round(52.4 + (soc - 50) * 0.04, 2),
        "battery_power": battery_power,
        "ac_output": True,
        "zepc": sun > 0.4,
        "ac_setpoint_w": round(discharge, 0),
        "ac_display_w": round(discharge, 0),
        "target_w": round(discharge, 0),
        "min_power_w": 0,
        "max_power_w": 800,
        "day_energy_kwh": round(_trucki_energy_today(now, lat, lon), 2),
        "total_energy_kwh": round(842.5 + max(0.0, (now - datetime(2026, 1, 1, tzinfo=timezone.utc)).total_seconds()) / 86400.0 * 0.12, 1),
        "temperature": round(28 + sun * 8 + random.uniform(-1, 1), 0),
    }


def mock_victron(intensity=None, now=None, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    sun = _sun_curve(now, lat, lon) if intensity is None else intensity
    solar_hours = _solar_hours_today(now, lat, lon)
    mppts = []
    for idx in range(1, 3):
        pv = sun * (700 + random.uniform(-25, 25))
        mppts.append({
            "id": idx,
            "name": f"MPPT 150/35 #{idx}",
            "pv_power": round(pv, 1),
            "pv_voltage": round(95 + random.uniform(-5, 5), 1),
            "battery_voltage": round(52.4 + random.uniform(-0.2, 0.2), 2),
            "yield_today": round(0.70 * solar_hours * (0.99 if idx == 1 else 1.01), 3),
            "state": "Bulk" if sun > 0.6 else ("Absorption" if sun > 0.3 else "Float"),
        })
    return {"online": True, "mppts": mppts, "total_power": round(sum(m["pv_power"] for m in mppts), 1)}
