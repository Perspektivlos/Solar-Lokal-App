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

logger = logging.getLogger("solar")


# ---------- HTTP helper ----------

async def _http_get(url: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
    """
    Führt eine HTTP-GET-Anfrage aus und gibt die JSON-Antwort bei erfolgreicher Ausführung zurück.
    
    Parameters:
    	url (str): Die abzurufende URL.
    	timeout (float): Maximale Wartezeit für die Anfrage in Sekunden.
    
    Returns:
    	Optional[Dict[str, Any]]: Die geparsten JSON-Daten bei HTTP-Status 200, andernfalls `None`.
    """
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
    """
    Ruft den Shelly-Energiestatus ab und strukturiert die Messwerte der drei Phasen.
    
    Parameters:
    	ip (str): IP-Adresse des Shelly-Geräts.
    
    Returns:
    	Optional[Dict[str, Any]]: Status mit Online-Kennzeichnung, Gesamtleistung und Phasenmesswerten; `None`, wenn keine Daten verfügbar sind.
    """
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
    """
    Ruft Live- und Wechselrichterdaten von Ahoy ab und strukturiert die Kanal- sowie Gesamtleistungswerte.
    
    Parameter:
    	ip (str): IP-Adresse des Ahoy-Geräts.
    	inverter_id (int): ID des abzurufenden Wechselrichters.
    
    Returns:
    	(Optional[Dict[str, Any]]): Gerätedaten mit Online-Status, Gesamtleistung, Leistungsbegrenzung und Kanalwerten; `None`, wenn keine Daten verfügbar sind.
    """
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
        "limit_percent": (inv or {}).get("power_limit_read", 100),
        "channels": channels,
    }


async def fetch_trucki(ip: str) -> Optional[Dict[str, Any]]:
    """
    Ruft den Trucki-Status ab und wandelt ihn in strukturierte Batteriekennzahlen um.
    
    Parameter:
    	ip (str): IP-Adresse oder Hostname des Trucki-Geräts.
    
    Returns:
    	Optional[Dict[str, Any]]: Statusdaten mit Online-Status, Ladezustand, Batteriespannung, Batterieleistung sowie AC-Ausgangs- und Zepc-Status; `None`, wenn keine Daten verfügbar sind.
    """
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
    """
    Ruft Systemdaten eines Victron-Geräts ab.
    
    Parameter:
    	ip (str): IP-Adresse des Victron-Geräts.
    
    Returns:
    	Optional[Dict[str, Any]]: Ein Dictionary mit Online-Status, MPPT-Daten und PV-Gesamtleistung oder `None`, wenn keine Daten verfügbar sind.
    """
    data = await _http_get(f"http://{ip}/api/v1/system")
    if not data:
        return None
    return {"online": True, "mppts": data.get("mppts", []), "total_power": data.get("pv_power", 0)}


# ---------- Live-data aggregator ----------

async def collect_live(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sammelt Live-Daten aller aktivierten Geräte und berechnet zusammengefasste Energiekennzahlen.
    
    Parameters:
    	cfg (Dict[str, Any]): Vollständige Konfiguration mit Geräte-, MQTT- und Demo-Einstellungen.
    
    Returns:
    	Dict[str, Any]: Ergebnis mit UTC-Zeitstempel, Demo-Modus, Gerätedaten und gerundeten
    	Leistungs- und Batteriekennzahlen.
    """
    demo = cfg.get("demo_mode", True)
    mqtt_enabled = bool((cfg.get("mqtt") or {}).get("enabled"))
    devices = cfg.get("devices") or {}
    shelly_cfg = devices.get("shelly") or {}
    ahoy_cfg = devices.get("ahoy") or {}
    trucki_cfg = devices.get("trucki") or {}
    victron_cfg = devices.get("victron") or {}

    async def get_dev(mqtt_fn, http_factory, mock_fn, enabled):
        """
        Ermittelt die Gerätedaten anhand der konfigurierten Abrufstrategie.
        
        Parameters:
            mqtt_fn: Funktion zum Abrufen der Gerätedaten über MQTT.
            http_factory: Asynchrone Funktion zum Abrufen der Gerätedaten über HTTP.
            mock_fn: Funktion zur Erzeugung von Ersatz- oder Demodaten.
            enabled (bool): Gibt an, ob das Gerät aktiviert ist.
        
        Returns:
            Ein Dictionary mit den Gerätedaten. Deaktivierte oder nicht erreichbare Geräte
            werden als offline gekennzeichnet; bei einem HTTP-Ausfall enthält das Ergebnis
            zusätzlich das Flag `_fallback`.
        """
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
            lambda: fetch_shelly(shelly_cfg.get("ip", "")),
            mock_shelly,
            shelly_cfg.get("enabled", False),
        ),
        get_dev(
            fetch_ahoy_from_mqtt,
            lambda: fetch_ahoy(ahoy_cfg.get("ip", ""), ahoy_cfg.get("inverter_id", 0)),
            mock_ahoy,
            ahoy_cfg.get("enabled", False),
        ),
        get_dev(
            fetch_trucki_from_mqtt,
            lambda: fetch_trucki(trucki_cfg.get("ip", "")),
            mock_trucki,
            trucki_cfg.get("enabled", False),
        ),
        get_dev(
            lambda: fetch_victron_from_mqtt(cfg.get("victron_mqtt") or {}),
            lambda: fetch_victron(victron_cfg.get("ip", "")),
            mock_victron,
            victron_cfg.get("enabled", False),
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
