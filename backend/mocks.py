"""Mock-Datengeneratoren für den Demo-Modus (reine Funktionen)."""
import math
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict


def _sun_curve(now: datetime) -> float:
    """
    Ermittelt die Sonnenintensität anhand der Tageszeit.
    
    Parameter:
        now (datetime): Zeitpunkt, dessen Uhrzeit für die Berechnung verwendet wird.
    
    Returns:
        float: Sonnenintensität zwischen 0 und 1.
    """
    h = now.hour + now.minute / 60.0
    if h < 5 or h > 21:
        return 0.0
    x = (h - 5) / 16.0  # 0..1 across day
    return max(0.0, math.sin(x * math.pi))


def mock_shelly() -> Dict[str, Any]:
    """
    Erzeugt simulierte Messdaten für einen dreiphasigen Shelly Pro 3EM.
    
    Returns:
    	dict[str, Any]: Messdaten mit Online-Status, Gesamtleistung und Werten für
    	die drei Phasen. Eine positive Gesamtleistung bezeichnet Netzbezug, eine
    	negative Gesamtleistung Einspeisung.
    """
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
    """
    Erzeugt simulierte Messdaten für vier PV-Kanäle.
    
    Returns:
    	dict[str, Any]: Messdaten mit Online-Status, Gesamtleistung, Leistungsbegrenzung und
    	Kanalwerten für Leistung, Spannung, Strom, Tagesertrag und Kanalnummer.
    """
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
    """
    Simuliert Mess- und Betriebsdaten eines Batteriespeichers.
    
    Returns:
        Dict[str, Any]: Simulierte Speicherwerte einschließlich Ladezustand,
        Leistung, Energiezähler, Temperatur und Betriebsstatus.
    """
    sun = _sun_curve(datetime.now(timezone.utc))
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
        "day_energy_kwh": round(1.5 + sun * 3.5, 2),
        "total_energy_kwh": round(842.5 + soc * 0.01, 1),
        "temperature": round(28 + sun * 8 + random.uniform(-1, 1), 0),
    }


def mock_victron() -> Dict[str, Any]:
    """
    Erzeugt simulierte Messdaten für zwei Victron-MPPT-Laderegler.
    
    Returns:
    	dict[str, Any]: Daten der beiden Laderegler mit Online-Status und aufsummierter PV-Leistung.
    """
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
