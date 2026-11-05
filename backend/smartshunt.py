"""Normalisierung des Victron SmartShunt aus lokalen Venus-OS-MQTT-Werten."""
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


SMARTSHUNT_INSTANCE = 290
STALE_SECONDS = 90
UNAVAILABLE_SECONDS = 180

TELEMETRY_PATHS = {
    "Dc/0/Voltage", "Dc/0/Current", "Dc/0/Power", "Soc", "TimeToGo",
    "ConsumedAmphours", "Dc/0/MidVoltage", "Dc/0/MidVoltageDeviation",
    "Dc/0/Temperature", "Dc/1/Voltage",
}

COUNTER_PATHS = {
    "charged_energy_kwh": "History/ChargedEnergy",
    "discharged_energy_kwh": "History/DischargedEnergy",
    "charge_cycles": "History/ChargeCycles",
    "deepest_discharge_ah": "History/DeepestDischarge",
    "last_discharge_ah": "History/LastDischarge",
    "average_discharge_ah": "History/AverageDischarge",
    "total_ah_drawn": "History/TotalAhDrawn",
    "minimum_voltage_v": "History/MinimumVoltage",
    "maximum_voltage_v": "History/MaximumVoltage",
    "time_since_full_charge_s": "History/TimeSinceLastFullCharge",
    "automatic_syncs": "History/AutomaticSyncs",
    "low_voltage_alarms": "History/LowVoltageAlarms",
    "high_voltage_alarms": "History/HighVoltageAlarms",
}

ALARM_PATHS = {
    "Alarms/LowVoltage": ("low_voltage", "Unterspannung", "critical"),
    "Alarms/HighVoltage": ("high_voltage", "Überspannung", "critical"),
    "Alarms/LowSoc": ("low_soc", "Niedriger Ladezustand", "warning"),
    "Alarms/LowStarterVoltage": ("low_starter_voltage", "Starterspannung niedrig", "warning"),
    "Alarms/HighStarterVoltage": ("high_starter_voltage", "Starterspannung hoch", "warning"),
    "Alarms/LowTemperature": ("low_temperature", "Temperatur niedrig", "warning"),
    "Alarms/HighTemperature": ("high_temperature", "Temperatur hoch", "critical"),
    "Alarms/MidVoltage": ("mid_voltage", "Mittelpunktabweichung", "warning"),
    "Alarms/LowFuse": ("low_fuse", "Sicherung / Hilfseingang", "critical"),
}


def _number(value: Any, digits: int = 2) -> Optional[float]:
    try:
        number = float(value)
        if not math.isfinite(number):
            return None
        return round(number, digits)
    except (TypeError, ValueError):
        return None


def is_valid_telemetry_value(value: Any) -> bool:
    return _number(value) is not None


def ingest_smartshunt_value(raw: Dict[str, Any], path: str, value: Any, now_iso: str) -> None:
    raw["_ts"] = now_iso
    if path in TELEMETRY_PATHS and is_valid_telemetry_value(value):
        raw[path] = value
        raw.setdefault("_field_ts", {})[path] = now_iso
        raw["_telemetry_ts"] = now_iso
    elif path not in TELEMETRY_PATHS:
        raw[path] = value


def _integer(value: Any) -> Optional[int]:
    number = _number(value, 0)
    return int(number) if number is not None else None


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _age_seconds(ts: Any, now: datetime) -> Optional[float]:
    parsed = _parse_ts(ts)
    return max(0.0, round((now - parsed).total_seconds(), 1)) if parsed else None


def _is_alarm(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    return str(value or "").strip().lower() in {"1", "true", "on", "alarm", "active"}


def build_smartshunt_state(
    raw: Dict[str, Any],
    instance: int = SMARTSHUNT_INSTANCE,
    now: Optional[datetime] = None,
    mqtt_connected: bool = True,
    demo: bool = False,
) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    product_name = str(raw.get("ProductName") or "")
    connection = str(raw.get("Mgmt/Connection") or "")
    device_instance = _integer(raw.get("DeviceInstance"))
    connected = _integer(raw.get("Connected"))
    telemetry_ts = raw.get("_telemetry_ts")
    field_ts = raw.get("_field_ts") if isinstance(raw.get("_field_ts"), dict) else {}
    has_valid_telemetry = any(is_valid_telemetry_value(raw.get(path)) for path in TELEMETRY_PATHS)
    age = _age_seconds(telemetry_ts, now) if has_valid_telemetry else None

    product_ok = "smartshunt" in product_name.lower()
    instance_ok = device_instance == int(instance)
    connection_text = connection.lower().replace(" ", "")
    connection_ok = "ve.direct" in connection_text or "vedirect" in connection_text or "usb" in connection_text
    identity_match = product_ok and instance_ok and connection_ok
    identity_valid = identity_match and connected == 1

    if not mqtt_connected and not demo:
        status, reason = "unavailable", "MQTT nicht verbunden"
    elif not identity_match:
        status, reason = "unavailable", "Geräteidentität stimmt nicht vollständig überein"
    elif connected != 1:
        status, reason = "unavailable", "SmartShunt meldet Connected=0"
    elif age is None:
        status, reason = "unavailable", "Noch keine Telemetrie empfangen"
    elif age > UNAVAILABLE_SECONDS:
        status, reason = "unavailable", f"Letzter gültiger Wert vor {int(age)} s"
    elif age > STALE_SECONDS:
        status, reason = "stale", f"Daten seit {int(age)} s nicht aktualisiert"
    else:
        status, reason = "current", "Messwerte aktuell"

    visible = status != "unavailable"

    def metric(path: str, digits: int) -> Optional[float]:
        if not visible:
            return None
        path_ts = field_ts.get(path) or telemetry_ts
        path_age = _age_seconds(path_ts, now)
        if path_age is None or path_age > UNAVAILABLE_SECONDS:
            return None
        return _number(raw.get(path), digits)

    power = metric("Dc/0/Power", 1)
    current = metric("Dc/0/Current", 2)
    if power is None and current is not None:
        voltage = metric("Dc/0/Voltage", 2)
        power = round(current * voltage, 1) if voltage is not None else None
    if (power or 0) > 1 or (current or 0) > 0.05:
        direction = "charging"
    elif (power or 0) < -1 or (current or 0) < -0.05:
        direction = "discharging"
    else:
        direction = "idle"

    optional_candidates = {
        "midpoint_voltage_v": metric("Dc/0/MidVoltage", 2),
        "midpoint_deviation_pct": metric("Dc/0/MidVoltageDeviation", 2),
        "temperature_c": metric("Dc/0/Temperature", 1),
        "starter_voltage_v": metric("Dc/1/Voltage", 2),
    }
    optional = {key: value for key, value in optional_candidates.items() if value is not None}
    counters = {
        key: _number(raw.get(path), 2)
        for key, path in COUNTER_PATHS.items()
        if _number(raw.get(path), 2) is not None
    }
    alerts: List[Dict[str, str]] = []
    for path, (code, label, severity) in ALARM_PATHS.items():
        if _is_alarm(raw.get(path)):
            alerts.append({"code": code, "label": label, "severity": severity, "source": "device"})
    if status == "stale":
        alerts.append({"code": "data_stale", "label": reason, "severity": "warning", "source": "data"})
    if status == "unavailable":
        alerts.append({"code": "data_unavailable", "label": reason, "severity": "critical", "source": "data"})

    return {
        "enabled": True,
        "online": status != "unavailable",
        "demo": demo,
        "read_only": True,
        "instance": int(instance),
        "status": status,
        "status_reason": reason,
        "last_update": telemetry_ts,
        "age_seconds": age,
        "direction": direction,
        "voltage_v": metric("Dc/0/Voltage", 2),
        "current_a": current,
        "power_w": power,
        "soc_pct": metric("Soc", 1),
        "time_to_go_s": metric("TimeToGo", 0),
        "consumed_ah": metric("ConsumedAmphours", 2),
        "identity": {
            "valid": identity_valid,
            "product_name": product_name or None,
            "device_instance": device_instance,
            "connection": connection or None,
            "connected": connected,
            "product_id": raw.get("ProductId"),
            "serial": raw.get("Serial"),
            "firmware": raw.get("FirmwareVersion"),
            "hardware": raw.get("HardwareVersion"),
            "checks": {
                "product": product_ok,
                "instance": instance_ok,
                "connection": connection_ok,
                "connected": connected == 1,
            },
        },
        "optional": optional,
        "device_history": counters,
        "alerts": alerts,
        "raw": {key: value for key, value in raw.items() if not key.startswith("_")},
        "field_age_seconds": {
            path: _age_seconds(field_ts.get(path) or telemetry_ts, now)
            for path in TELEMETRY_PATHS
            if raw.get(path) is not None
        },
        "_via_mqtt": not demo and bool(raw),
    }


def unavailable_smartshunt(reason: str, instance: int = SMARTSHUNT_INSTANCE) -> Dict[str, Any]:
    state = build_smartshunt_state({}, instance=instance, mqtt_connected=False)
    state["status_reason"] = reason
    state["alerts"] = [{"code": "data_unavailable", "label": reason, "severity": "critical", "source": "data"}]
    return state


def mock_smartshunt(now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    phase = now.timestamp() / 420.0
    power = 540.0 * math.sin(phase)
    voltage = 52.65 + 0.35 * math.sin(phase / 3.0)
    soc = max(8.0, min(98.0, 71.0 + 9.0 * math.sin(phase / 5.0)))
    raw = {
        "ProductName": "Victron SmartShunt IP65 300A",
        "ProductId": "0xA389",
        "DeviceInstance": SMARTSHUNT_INSTANCE,
        "Connected": 1,
        "Mgmt/Connection": "VE.Direct /dev/ttyUSB0",
        "FirmwareVersion": "v4.18",
        "HardwareVersion": "rev3",
        "Serial": "HQ-DEMO-290",
        "Dc/0/Voltage": round(voltage, 2),
        "Dc/0/Current": round(power / voltage, 2),
        "Dc/0/Power": round(power, 1),
        "Soc": round(soc, 1),
        "TimeToGo": round((soc - 8) / max(1.0, abs(power) / 9600.0 * 100) * 3600) if power < -25 else None,
        "ConsumedAmphours": round(-(100 - soc) * 6.0, 1),
        "Dc/0/MidVoltage": round(voltage / 2, 2),
        "Dc/0/MidVoltageDeviation": round(abs(math.sin(phase)) * 0.18, 2),
        "Dc/0/Temperature": round(24.0 + 2.5 * math.sin(phase / 2), 1),
        "History/ChargedEnergy": 1894.7,
        "History/DischargedEnergy": 1711.2,
        "History/ChargeCycles": 238,
        "History/DeepestDischarge": -487.4,
        "History/LastDischarge": -86.3,
        "History/AverageDischarge": -142.8,
        "History/TotalAhDrawn": -20186.4,
        "History/MinimumVoltage": 47.92,
        "History/MaximumVoltage": 55.14,
        "History/TimeSinceLastFullCharge": 39420,
        "History/AutomaticSyncs": 17,
        "History/LowVoltageAlarms": 2,
        "History/HighVoltageAlarms": 0,
        "_ts": now.isoformat(),
        "_telemetry_ts": now.isoformat(),
    }
    raw["_field_ts"] = {path: now.isoformat() for path in TELEMETRY_PATHS if raw.get(path) is not None}
    return build_smartshunt_state(raw, now=now, mqtt_connected=True, demo=True)


def mock_smartshunt_history(range_name: str, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    minutes = {"1h": 60, "3h": 180, "6h": 360, "12h": 720, "24h": 1440}.get(range_name, 6 * 60)
    count = 96
    step = minutes * 60 / (count - 1)
    points = []
    for index in range(count):
        ts = now - timedelta(seconds=step * (count - 1 - index))
        phase = ts.timestamp() / 420.0
        power = 540.0 * math.sin(phase)
        voltage = 52.65 + 0.35 * math.sin(phase / 3.0)
        soc = max(8.0, min(98.0, 71.0 + 9.0 * math.sin(phase / 5.0)))
        points.append({
            "ts": ts.isoformat(),
            "voltage_v": round(voltage, 2),
            "current_a": round(power / voltage, 2),
            "power_w": round(power, 1),
            "soc_pct": round(soc, 1),
            "status": "current",
        })
    return points