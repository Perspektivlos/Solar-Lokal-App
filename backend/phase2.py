"""Additives Phase-2-Quellenmodell: SmartShunt DC und Trucki/SUN AC."""
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


RANGE_MINUTES = {"1h": 60, "3h": 180, "6h": 360, "12h": 720, "24h": 1440}
MAX_GAP_SECONDS = 600


def _number(value: Any, digits: int = 2) -> Optional[float]:
    try:
        number = float(value)
        return round(number, digits) if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def build_phase2_model(data: Dict[str, Any]) -> Dict[str, Any]:
    smart = data.get("smartshunt") or {}
    trucki = data.get("trucki") or {}
    legacy = data.get("summary") or {}
    smart_visible = smart.get("status") in {"current", "stale"}
    dc_power = _number(smart.get("power_w"), 1) if smart_visible else None
    ac_display = _number(trucki.get("ac_display_w"), 1)
    if ac_display is None:
        legacy_trucki = _number(trucki.get("battery_power"), 1)
        ac_display = max(0.0, -legacy_trucki) if legacy_trucki is not None else None
    else:
        ac_display = max(0.0, ac_display)

    battery_dc = {
        "source": "smartshunt",
        "instance": 290,
        "status": smart.get("status") or "unavailable",
        "status_reason": smart.get("status_reason") or "nicht verfügbar",
        "last_update": smart.get("last_update"),
        "age_seconds": smart.get("age_seconds"),
        "power_w": dc_power,
        "charge_w": max(0.0, dc_power) if dc_power is not None else None,
        "discharge_w": max(0.0, -dc_power) if dc_power is not None else None,
        "voltage_v": _number(smart.get("voltage_v"), 2) if smart_visible else None,
        "current_a": _number(smart.get("current_a"), 2) if smart_visible else None,
        "soc_pct": _number(smart.get("soc_pct"), 1) if smart_visible else None,
        "time_to_go_s": _number(smart.get("time_to_go_s"), 0) if smart_visible else None,
        "consumed_ah": _number(smart.get("consumed_ah"), 2) if smart_visible else None,
        "optional": smart.get("optional") if smart_visible else {},
    }
    inverter_ac = {
        "source": "trucki-sun2000",
        "online": bool(trucki.get("online")),
        "output_w": ac_display,
        "setpoint_w": _number(trucki.get("target_w"), 1),
        "reported_setpoint_w": _number(trucki.get("ac_setpoint_w"), 1),
        "min_power_w": _number(trucki.get("min_power_w"), 1),
        "max_power_w": _number(trucki.get("max_power_w"), 1),
        "zepc": trucki.get("zepc"),
        "ac_output": trucki.get("ac_output"),
        "temperature_c": _number(trucki.get("temperature"), 1),
    }
    summary = {
        "pv_power": _number(legacy.get("pv_power"), 1),
        "pv_ac_power": _number(legacy.get("pv_ac_power"), 1),
        "pv_dc_power": _number(legacy.get("pv_dc_power"), 1),
        "grid_power": _number(legacy.get("grid_power"), 1),
        "house_power": _number(legacy.get("house_power"), 1),
        "battery_power": dc_power,
        "battery_charge_w": battery_dc["charge_w"],
        "battery_discharge_w": battery_dc["discharge_w"],
        "battery_soc": battery_dc["soc_pct"],
        "battery_voltage_v": battery_dc["voltage_v"],
        "battery_current_a": battery_dc["current_a"],
        "battery_data_status": battery_dc["status"],
        "inverter_ac_power_w": ac_display,
    }
    return {
        "preview": True,
        "battery_dc": battery_dc,
        "inverter_ac": inverter_ac,
        "summary": summary,
        "source_contract": {
            "battery": "SmartShunt DC · Instanz 290",
            "inverter": "Trucki/SUN-2000 AC",
            "house_balance": "Hoymiles AC + Trucki/SUN AC + Shelly Netz",
            "fallback": "Kein Trucki-Fallback für Batterie V/A/W/SoC",
        },
    }


def mock_phase2_history(range_name: str, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    minutes = RANGE_MINUTES.get(range_name, 360)
    step_seconds = min(300.0, max(30.0, minutes * 60 / 95.0))
    count = int(minutes * 60 / step_seconds) + 1
    points = []
    for index in range(count):
        ts = now - timedelta(seconds=step_seconds * (count - 1 - index))
        phase = ts.timestamp() / 420.0
        solar = max(0.0, math.sin((ts.hour + ts.minute / 60 - 6) / 12 * math.pi))
        dc_power = 540.0 * math.sin(phase)
        voltage = 52.65 + 0.35 * math.sin(phase / 3.0)
        soc = max(8.0, min(98.0, 71.0 + 9.0 * math.sin(phase / 5.0)))
        inverter_ac = max(0.0, -dc_power * 0.93)
        pv_ac = 1250.0 * solar
        pv_dc = 2050.0 * solar
        house = 420.0 + 220.0 * (1 + math.sin(phase / 2.0)) + inverter_ac
        grid = house - pv_ac - inverter_ac
        points.append({
            "ts": ts.isoformat(), "status": "current",
            "battery_dc_power_w": round(dc_power, 1),
            "battery_voltage_v": round(voltage, 2),
            "battery_current_a": round(dc_power / voltage, 2),
            "battery_soc_pct": round(soc, 1),
            "inverter_ac_power_w": round(inverter_ac, 1),
            "pv_ac_power_w": round(pv_ac, 1), "pv_dc_power_w": round(pv_dc, 1),
            "house_ac_power_w": round(house, 1), "grid_power_w": round(grid, 1),
        })
    return points


def summarize_phase2_points(points: List[Dict[str, Any]]) -> Dict[str, Any]:
    keys = {
        "battery_dc_charge_kwh": ("battery_dc_power_w", lambda value: max(0.0, value), "battery_dc"),
        "battery_dc_discharge_kwh": ("battery_dc_power_w", lambda value: max(0.0, -value), "battery_dc"),
        "inverter_ac_output_kwh": ("inverter_ac_power_w", lambda value: max(0.0, value), "inverter_ac"),
        "pv_ac_kwh": ("pv_ac_power_w", lambda value: max(0.0, value), "pv_ac"),
        "mppt_dc_kwh": ("pv_dc_power_w", lambda value: max(0.0, value), "mppt_dc"),
        "house_ac_kwh": ("house_ac_power_w", lambda value: max(0.0, value), "house_ac"),
        "grid_import_kwh": ("grid_power_w", lambda value: max(0.0, value), "grid"),
        "grid_export_kwh": ("grid_power_w", lambda value: max(0.0, -value), "grid"),
    }
    totals = {key: 0.0 for key in keys}
    durations = {domain: 0.0 for _, _, domain in keys.values()}
    for previous, current in zip(points, points[1:]):
        try:
            seconds = (datetime.fromisoformat(current["ts"]) - datetime.fromisoformat(previous["ts"])).total_seconds()
        except (KeyError, TypeError, ValueError):
            continue
        if seconds <= 0 or seconds > MAX_GAP_SECONDS:
            continue
        hours = seconds / 3600.0
        counted_domains = set()
        for key, (field, transform, domain) in keys.items():
            previous_value = _number(previous.get(field))
            current_value = _number(current.get(field))
            if previous_value is None or current_value is None:
                continue
            totals[key] += (transform(previous_value) + transform(current_value)) / 2.0 * hours / 1000.0
            counted_domains.add(domain)
        for domain in counted_domains:
            durations[domain] += seconds
    measured_duration = max(durations.values(), default=0.0)
    return {
        **{key: round(value, 3) for key, value in totals.items()},
        "measurement_available": measured_duration > 0,
        "measured_duration_s": round(measured_duration, 1),
        "battery_dc_measurement_available": durations["battery_dc"] > 0,
        "battery_dc_measured_duration_s": round(durations["battery_dc"], 1),
        "inverter_ac_measurement_available": durations["inverter_ac"] > 0,
        "pv_ac_measurement_available": durations["pv_ac"] > 0,
        "mppt_dc_measurement_available": durations["mppt_dc"] > 0,
        "house_ac_measurement_available": durations["house_ac"] > 0,
        "grid_measurement_available": durations["grid"] > 0,
        "sample_count": len(points),
        "source_note": "SmartShunt DC und Trucki/SUN AC getrennt integriert",
    }


def evaluate_phase2_battery_alarms(smartshunt: Dict[str, Any], thresholds: Dict[str, Any]) -> List[Dict[str, Any]]:
    alarms = [dict(item) for item in (smartshunt.get("alerts") or [])]
    if smartshunt.get("status") not in {"current", "stale"}:
        return alarms
    voltage = _number(smartshunt.get("voltage_v"))
    soc = _number(smartshunt.get("soc_pct"))
    voltage_cfg = thresholds.get("battery_voltage") or {
        "under": thresholds.get("battery_under_voltage"),
        "over": thresholds.get("battery_over_voltage"),
    }
    soc_cfg = thresholds.get("battery_soc") or {"under": thresholds.get("soc_low")}
    checks = [
        ("smartshunt_voltage_low", voltage, voltage_cfg.get("under"), voltage_cfg.get("under_crit"), "under", "Batteriespannung niedrig"),
        ("smartshunt_voltage_high", voltage, voltage_cfg.get("over"), voltage_cfg.get("over_crit"), "over", "Batteriespannung hoch"),
        ("smartshunt_soc_low", soc, soc_cfg.get("under"), soc_cfg.get("under_crit"), "under", "Ladezustand niedrig"),
    ]
    existing = {alarm.get("code") for alarm in alarms}
    for code, value, threshold, critical_threshold, direction, label in checks:
        limit = _number(threshold)
        critical_limit = _number(critical_threshold)
        tripped = value is not None and limit is not None and (value < limit if direction == "under" else value > limit)
        if code not in existing and tripped:
            critical = critical_limit is not None and (value <= critical_limit if direction == "under" else value >= critical_limit)
            alarms.append({
                "code": code, "label": label, "severity": "critical" if critical else "warning", "source": "smartshunt-threshold",
                "value": value, "threshold": limit,
            })
    return alarms