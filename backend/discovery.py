"""Geräte-Erkennung / Anlagendokumentation (Phase 1).

Ruft die Identitäts-/Typenschild-Daten pro Gerät ab. Im Demo-Modus werden
plausible Mock-Werte geliefert, im Live-Betrieb best-effort HTTP-Abfragen im
lokalen Netz. Felder, die ein Gerät nicht liefert, werden als "n/a" dargestellt.

Reine Sammel-Logik – importiert nur aus ``mqtt_client`` (kein ``server``),
daher kein Zirkularimport.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from mqtt_client import _mqtt_data

logger = logging.getLogger("solar.discovery")

NA = "n/a"

DEVICE_LABELS = {
    "shelly": "Shelly Pro 3EM",
    "ahoy": "Ahoy DTU (Hoymiles HM1500)",
    "trucki": "Trucki2Shelly Gateway",
    "victron": "Victron VenusOS Large",
}

# Aktuell bekannte (empfohlene) Firmware-Stände je Gerät (Stand 2026).
# Wird gegen die erkannte Version verglichen, um Update-Empfehlungen zu geben.
LATEST_FIRMWARE = {
    "shelly": "1.4.4",
    "ahoy": "0.8.150",
    "trucki": "2.3",
    "victron": "3.50",
}

# Welches Doku-Feld je Gerät die Firmware-/Versionsangabe enthält.
FW_FIELD_LABELS = {
    "shelly": "Firmware-Version",
    "ahoy": "Firmware-Version",
    "trucki": "Firmware/Version",
    "victron": "VenusOS-Version",
}


def _field(label: str, value: Any) -> Dict[str, str]:
    return {"label": label, "value": str(value) if value not in (None, "") else NA}


def _parse_version(text: Any) -> Optional[Tuple[int, ...]]:
    """Extrahiert eine Versions-Nummer (z. B. '1.4.4', '0.8.145', '3.40') aus
    einem beliebigen String und gibt sie als Tupel zurück."""
    if text is None:
        return None
    m = re.search(r"(\d+(?:\.\d+)+)", str(text))
    if not m:
        return None
    try:
        return tuple(int(p) for p in m.group(1).split("."))
    except ValueError:
        return None


def _cmp_versions(cur: Tuple[int, ...], latest: Tuple[int, ...]) -> int:
    n = max(len(cur), len(latest))
    cur = cur + (0,) * (n - len(cur))
    latest = latest + (0,) * (n - len(latest))
    if cur < latest:
        return -1
    if cur > latest:
        return 1
    return 0


def _annotate_firmware(key: str, fields: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], Optional[Dict[str, str]]]:
    """Markiert das Firmware-Feld mit einem Status (current/outdated/unknown)
    und liefert eine kompakte Zusammenfassung für die Karten-Ansicht."""
    label = FW_FIELD_LABELS.get(key)
    latest = LATEST_FIRMWARE.get(key)
    summary: Optional[Dict[str, str]] = None
    if not (label and latest):
        return fields, summary
    latest_v = _parse_version(latest)
    for f in fields:
        if f["label"] != label:
            continue
        cur_v = _parse_version(f["value"])
        f["fw_latest"] = latest
        if cur_v is None or latest_v is None:
            f["fw_status"] = "unknown"
        elif _cmp_versions(cur_v, latest_v) < 0:
            f["fw_status"] = "outdated"
            f["fw_hint"] = f"Update verfügbar → v{latest}"
        else:
            f["fw_status"] = "current"
        summary = {"status": f["fw_status"], "current": f["value"], "latest": latest}
        break
    return fields, summary


async def _http_get_json(url: str, timeout: float = 2.0) -> Optional[Any]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(url)
            if r.status_code == 200:
                try:
                    return r.json()
                except Exception:
                    return None
    except Exception as e:
        logger.debug("discovery GET %s failed: %s", url, e)
    return None


# ---------- Mock (Demo-Modus) ----------

def mock_discover_shelly() -> List[Dict[str, str]]:
    return [
        _field("Modellkennung", "SPEM-003CEBEU"),
        _field("Firmware-Version", "1.4.4"),
        _field("MAC-Adresse", "A4:E5:7C:B2:1F:90"),
        _field("Geräte-ID", "shellypro3em-a4e57cb21f90"),
        _field("Phasen-Profil", "triphase (3-phasig)"),
    ]


def mock_discover_ahoy() -> List[Dict[str, str]]:
    return [
        _field("Wechselrichter-Name", "HM-1500"),
        _field("Seriennummer", "114182920147"),
        _field("Firmware-Version", "AhoyDTU 0.8.145"),
        _field("Max. Leistung", "1500 W"),
        _field("Anzahl Kanäle", "4"),
    ]


def mock_discover_trucki() -> List[Dict[str, str]]:
    return [
        _field("Firmware/Version", "Trucki2Shelly v2.3"),
        _field("Leistungsgrenzen", "0 – 800 W"),
        _field("SoC-Quelle", "Batteriespannung (16S LiFePO4)"),
    ]


def mock_discover_victron() -> List[Dict[str, str]]:
    return [
        _field("VenusOS-Version", "v3.40 (large)"),
        _field("MPPT-Modelle", "2× SmartSolar MPPT 150/35"),
        _field("Anzahl Tracker", "2"),
    ]


MOCK_FNS = {
    "shelly": mock_discover_shelly,
    "ahoy": mock_discover_ahoy,
    "trucki": mock_discover_trucki,
    "victron": mock_discover_victron,
}


# ---------- Live (lokales Netz, best effort) ----------

async def live_discover_shelly(ip: str) -> Optional[List[Dict[str, str]]]:
    data = await _http_get_json(f"http://{ip}/rpc/Shelly.GetDeviceInfo")
    if not isinstance(data, dict):
        return None
    return [
        _field("Modellkennung", data.get("model") or data.get("app")),
        _field("Firmware-Version", data.get("ver")),
        _field("MAC-Adresse", data.get("mac")),
        _field("Geräte-ID", data.get("id")),
        _field("Phasen-Profil", data.get("profile")),
    ]


async def live_discover_ahoy(ip: str, inverter_id: int = 0) -> Optional[List[Dict[str, str]]]:
    inv = await _http_get_json(f"http://{ip}/api/inverter/id/{inverter_id}")
    info = await _http_get_json(f"http://{ip}/api/record/info")
    if info is None:
        info = await _http_get_json(f"http://{ip}/api/system")
    if not (isinstance(inv, dict) or isinstance(info, dict)):
        return None
    inv = inv if isinstance(inv, dict) else {}
    fw = None
    if isinstance(info, dict):
        gen = info.get("generic") if isinstance(info.get("generic"), dict) else {}
        fw = info.get("version") or info.get("build") or gen.get("version")
    ch = inv.get("ch")
    n_ch = (len(ch) - 1) if isinstance(ch, list) and len(ch) > 1 else inv.get("channels")
    max_pwr = inv.get("max_pwr") or inv.get("max_power")
    return [
        _field("Wechselrichter-Name", inv.get("name")),
        _field("Seriennummer", inv.get("serial")),
        _field("Firmware-Version", fw),
        _field("Max. Leistung", f"{max_pwr} W" if max_pwr else None),
        _field("Anzahl Kanäle", n_ch),
    ]


async def live_discover_trucki(ip: str) -> Optional[List[Dict[str, str]]]:
    data = await _http_get_json(f"http://{ip}/status")
    if not isinstance(data, dict):
        return None
    fw = data.get("version") or data.get("fw") or data.get("firmware")
    minp = data.get("min_power_w", data.get("MINPOWER"))
    maxp = data.get("max_power_w", data.get("MAXPOWER", data.get("POWERLIMIT")))
    limits = None
    if minp is not None or maxp is not None:
        limits = f"{int(minp or 0)} – {int(maxp or 0)} W"
    return [
        _field("Firmware/Version", fw),
        _field("Leistungsgrenzen", limits),
        _field("SoC-Quelle", "Batteriespannung (16S LiFePO4)"),
    ]


async def live_discover_victron(ip: str, cfg_victron: Dict[str, Any]) -> Optional[List[Dict[str, str]]]:
    sys = await _http_get_json(f"http://{ip}/api/v1/system")
    venus_version = None
    mppt_models = None
    tracker_count = None
    if isinstance(sys, dict):
        venus_version = sys.get("venus_version") or sys.get("version")
        mppts = sys.get("mppts")
        if isinstance(mppts, list) and mppts:
            tracker_count = len(mppts)
            names = [m.get("name") or m.get("product") for m in mppts if isinstance(m, dict)]
            names = [n for n in names if n]
            if names:
                mppt_models = ", ".join(names)

    # MQTT-Fallback: ProductName je solarcharger-Instanz
    instances = (cfg_victron or {}).get("instances") or []
    inst_data = _mqtt_data["victron"]["instances"]
    mqtt_names = []
    for inst in instances:
        try:
            st = inst_data.get(int(inst))
        except (TypeError, ValueError):
            st = None
        if st and st.get("ProductName"):
            mqtt_names.append(str(st["ProductName"]))
    if not mppt_models and mqtt_names:
        mppt_models = ", ".join(mqtt_names)
    if tracker_count is None and instances:
        tracker_count = len(instances)

    if not (isinstance(sys, dict) or mqtt_names or instances):
        return None
    return [
        _field("VenusOS-Version", venus_version),
        _field("MPPT-Modelle", mppt_models),
        _field("Anzahl Tracker", tracker_count),
    ]


# ---------- Orchestrator ----------

async def discover_device(cfg: Dict[str, Any], key: str) -> Dict[str, Any]:
    """Erkennt die Kenndaten eines Geräts. Liefert ein normalisiertes Ergebnis
    mit status ``demo`` | ``ok`` | ``error``."""
    label = DEVICE_LABELS.get(key, key)
    now = datetime.now(timezone.utc).isoformat()
    base = {"device": key, "device_label": label, "detected_at": now}

    if key not in MOCK_FNS:
        return {**base, "status": "error", "fields": [], "firmware": None, "error": f"Unbekanntes Gerät: {key}", "ip": ""}

    demo = bool(cfg.get("demo_mode"))
    devs = cfg.get("devices")
    dcfg = devs.get(key) if isinstance(devs, dict) and isinstance(devs.get(key), dict) else {}
    ip = dcfg.get("ip", "")

    if demo:
        fields, fw = _annotate_firmware(key, MOCK_FNS[key]())
        return {**base, "status": "demo", "fields": fields, "firmware": fw, "error": None, "ip": ip}

    try:
        if key == "shelly":
            fields = await live_discover_shelly(ip)
        elif key == "ahoy":
            fields = await live_discover_ahoy(ip, dcfg.get("inverter_id", 0))
        elif key == "trucki":
            fields = await live_discover_trucki(ip)
        else:
            fields = await live_discover_victron(ip, cfg.get("victron_mqtt") or {})
    except Exception as e:
        logger.debug("discover %s error: %s", key, e)
        fields = None

    if not fields:
        return {**base, "status": "error", "fields": [], "firmware": None,
                "error": f"{label} nicht erreichbar ({ip or 'keine IP'})", "ip": ip}
    fields, fw = _annotate_firmware(key, fields)
    return {**base, "status": "ok", "fields": fields, "firmware": fw, "error": None, "ip": ip}
