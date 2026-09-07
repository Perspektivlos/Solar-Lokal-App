"""Status-/Alarm-Engine (reine Funktionen, keine App/DB-Abhängigkeit).

Bewertet die aggregierten Live-Daten (Ergebnis von ``collect_live``) plus den
MQTT-Verbindungsstatus gegen feste Standard-Schwellwerte und liefert eine Liste
aktiver Alarme. Wird in ``/api/live`` (Feld ``alarms``) und ``/api/alarms``
verwendet.

Schweregrade: ``critical`` (rot) und ``warning`` (gelb/orange).
Geräte-Keys: shelly · ahoy · trucki · victron · system
"""
from typing import Any, Dict, List

# ---------- Feste Standard-Schwellwerte (Phase A: im Code, nicht konfigurierbar) ----------
DEFAULT_THRESHOLDS: Dict[str, Dict[str, float]] = {
    # Netz-/Phasenspannung (EN 50160: 230 V ±10 %)
    "grid_voltage": {"under": 207.0, "over": 253.0, "under_crit": 195.0, "over_crit": 265.0},
    # Phasenstrom (Shelly Pro 3EM) – Haushaltskontext
    "phase_current": {"over": 25.0, "over_crit": 32.0},
    # Akku-Spannung (16S LiFePO4: ~48–57 V)
    "battery_voltage": {"under": 48.0, "over": 56.0, "under_crit": 46.4, "over_crit": 57.6},
    # Akku-Ladezustand
    "battery_soc": {"under": 15.0, "under_crit": 8.0},
}

DEVICE_LABELS = {
    "shelly": "Shelly Pro 3EM",
    "ahoy": "Hoymiles / Ahoy DTU",
    "trucki": "Trucki-Speicher",
    "victron": "Victron MPPT",
    "system": "System",
}


def _fmt(v: float, digits: int = 1) -> str:
    """Deutsche Zahlenformatierung (Komma) ohne locale-Abhängigkeit."""
    s = f"{v:.{digits}f}"
    return s.replace(".", ",")


def _add(out: List[Dict[str, Any]], device: str, severity: str, code: str, message: str, value: Any = None) -> None:
    out.append({
        "id": f"{device}-{code}",
        "device": device,
        "device_label": DEVICE_LABELS.get(device, device),
        "severity": severity,
        "code": code,
        "message": message,
        "value": value,
    })


def _check_voltage(out, device, code_prefix, label, voltage, t):
    if voltage is None:
        return
    if voltage <= t["under_crit"]:
        _add(out, device, "critical", f"{code_prefix}-undervoltage", f"Kritische Unterspannung {label}: {_fmt(voltage)} V (< {_fmt(t['under_crit'])} V)", voltage)
    elif voltage < t["under"]:
        _add(out, device, "warning", f"{code_prefix}-undervoltage", f"Unterspannung {label}: {_fmt(voltage)} V (< {_fmt(t['under'])} V)", voltage)
    elif voltage >= t["over_crit"]:
        _add(out, device, "critical", f"{code_prefix}-overvoltage", f"Kritische Überspannung {label}: {_fmt(voltage)} V (> {_fmt(t['over_crit'])} V)", voltage)
    elif voltage > t["over"]:
        _add(out, device, "warning", f"{code_prefix}-overvoltage", f"Überspannung {label}: {_fmt(voltage)} V (> {_fmt(t['over'])} V)", voltage)


def evaluate_alarms(
    live: Dict[str, Any],
    mqtt_connected: bool = False,
    mqtt_enabled: bool = False,
    thresholds: Dict[str, Dict[str, float]] = None,
) -> List[Dict[str, Any]]:
    """Bewertet Live-Daten gegen Schwellwerte und Verbindungsstatus.

    Verbindungs-Alarme (nicht erreichbar / MQTT weg / kein Datenstrom) werden im
    Demo-Modus unterdrückt, Schwellwert-Alarme immer geprüft.
    """
    t = thresholds or DEFAULT_THRESHOLDS
    out: List[Dict[str, Any]] = []
    demo = bool(live.get("demo_mode"))

    shelly = live.get("shelly") or {}
    ahoy = live.get("ahoy") or {}
    trucki = live.get("trucki") or {}
    victron = live.get("victron") or {}

    # ---------- Schwellwerte ----------
    # Shelly Phasen: Spannung + Strom
    for ph in (shelly.get("phases") or []):
        label = ph.get("phase", "?")
        _check_voltage(out, "shelly", f"volt-{label}", label, ph.get("voltage"), t["grid_voltage"])
        cur = ph.get("current")
        if cur is not None:
            ct = t["phase_current"]
            if cur >= ct["over_crit"]:
                _add(out, "shelly", "critical", f"overcurrent-{label}", f"Kritischer Überstrom {label}: {_fmt(cur, 2)} A (> {_fmt(ct['over_crit'])} A)", cur)
            elif cur > ct["over"]:
                _add(out, "shelly", "warning", f"overcurrent-{label}", f"Überstrom {label}: {_fmt(cur, 2)} A (> {_fmt(ct['over'])} A)", cur)

    # Trucki: Akku-Spannung + SoC
    _check_voltage(out, "trucki", "batt", "Akku", trucki.get("battery_voltage"), t["battery_voltage"])
    soc = trucki.get("soc")
    if soc is not None:
        st = t["battery_soc"]
        if soc <= st["under_crit"]:
            _add(out, "trucki", "critical", "soc-low", f"Akku-Ladezustand kritisch: {_fmt(soc, 0)} % (< {_fmt(st['under_crit'], 0)} %)", soc)
        elif soc < st["under"]:
            _add(out, "trucki", "warning", "soc-low", f"Akku-Ladezustand niedrig: {_fmt(soc, 0)} % (< {_fmt(st['under'], 0)} %)", soc)

    # Victron MPPTs: Akku-Spannung je Regler
    for m in (victron.get("mppts") or []):
        name = m.get("name") or f"MPPT {m.get('id', '?')}"
        _check_voltage(out, "victron", f"batt-{m.get('id', '?')}", name, m.get("battery_voltage"), t["battery_voltage"])

    # ---------- Verbindung / Datenstrom (nur außerhalb Demo) ----------
    if not demo:
        # Gerät nicht erreichbar: online False + _fallback True (war aktiv, HTTP fehlgeschlagen)
        for key in ("shelly", "ahoy", "trucki", "victron"):
            d = live.get(key) or {}
            if d.get("online") is False and d.get("_fallback"):
                _add(out, key, "critical", "unreachable", f"{DEVICE_LABELS[key]} nicht erreichbar (keine MQTT-/HTTP-Antwort)")

        # AhoyDTU online, aber Wechselrichter sendet keine Daten
        if ahoy.get("online") is True and not (ahoy.get("channels") or []):
            _add(out, "ahoy", "warning", "inverter-no-data", "Ahoy DTU online, aber Wechselrichter sendet keine Daten")

        # MQTT-Broker verbindung
        if mqtt_enabled and not mqtt_connected:
            _add(out, "system", "warning", "mqtt-down", "MQTT-Broker nicht verbunden")

    return out


def summarize_alarms(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    crit = sum(1 for a in items if a["severity"] == "critical")
    warn = sum(1 for a in items if a["severity"] == "warning")
    level = "critical" if crit else ("warning" if warn else "ok")
    return {"count": len(items), "critical": crit, "warning": warn, "level": level, "alarms": items}
