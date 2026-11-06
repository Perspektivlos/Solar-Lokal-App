"""Phase-2-Shadow-Modell: SmartShunt DC bleibt strikt von Trucki/SUN AC getrennt."""
import os
from datetime import datetime, timedelta, timezone

import requests

from phase2 import build_phase2_model, evaluate_phase2_battery_alarms, mock_phase2_history, summarize_phase2_points


def source_data(status="current", power=-220.0):
    return {
        "smartshunt": {
            "status": status, "status_reason": "ok", "last_update": "2026-11-05T20:00:00+00:00",
            "age_seconds": 2, "power_w": power, "voltage_v": 52.2, "current_a": -4.21,
            "soc_pct": 78.5, "time_to_go_s": 18000, "consumed_ah": -64,
            "optional": {"temperature_c": 24.5}, "alerts": [],
        },
        "trucki": {
            "online": True, "battery_power": -777, "battery_voltage": 49.0, "soc": 12,
            "ac_display_w": 204.0, "target_w": 220, "max_power_w": 800, "min_power_w": 50,
            "zepc": True, "ac_output": True, "temperature": 31,
        },
        "summary": {
            "pv_power": 900, "pv_ac_power": 400, "pv_dc_power": 500,
            "grid_power": 100, "house_power": 704, "battery_power": -777,
            "battery_soc": 12,
        },
    }


def test_phase2_uses_smartshunt_for_dc_and_trucki_for_ac():
    model = build_phase2_model(source_data())
    assert model["battery_dc"]["power_w"] == -220.0
    assert model["battery_dc"]["soc_pct"] == 78.5
    assert model["battery_dc"]["voltage_v"] == 52.2
    assert model["inverter_ac"]["output_w"] == 204.0
    assert model["summary"]["house_power"] == 704.0
    assert model["summary"]["battery_power"] == -220.0


def test_unavailable_smartshunt_never_falls_back_to_trucki_battery_values():
    model = build_phase2_model(source_data(status="unavailable"))
    assert model["battery_dc"]["power_w"] is None
    assert model["battery_dc"]["voltage_v"] is None
    assert model["battery_dc"]["soc_pct"] is None
    assert model["summary"]["battery_power"] is None
    assert model["inverter_ac"]["output_w"] == 204.0


def test_stale_values_remain_visible_but_are_labeled_stale():
    model = build_phase2_model(source_data(status="stale", power=125))
    assert model["battery_dc"]["status"] == "stale"
    assert model["battery_dc"]["charge_w"] == 125.0
    assert model["battery_dc"]["discharge_w"] == 0.0


def test_history_integration_keeps_dc_and_ac_separate():
    start = datetime(2026, 11, 5, 10, tzinfo=timezone.utc)
    points = []
    for index in range(13):
        points.append({
            "ts": (start + timedelta(minutes=5 * index)).isoformat(),
            "battery_dc_power_w": -1000, "inverter_ac_power_w": 900,
            "pv_ac_power_w": 500, "pv_dc_power_w": 600,
            "house_ac_power_w": 1200, "grid_power_w": -200,
        })
    out = summarize_phase2_points(points)
    assert out["battery_dc_discharge_kwh"] == 1.0
    assert out["inverter_ac_output_kwh"] == 0.9
    assert out["battery_dc_charge_kwh"] == 0.0
    assert out["house_ac_kwh"] == 1.2
    assert out["grid_export_kwh"] == 0.2


def test_large_history_gap_is_not_integrated():
    start = datetime(2026, 11, 5, 10, tzinfo=timezone.utc)
    points = [
        {"ts": start.isoformat(), "battery_dc_power_w": -1000},
        {"ts": (start + timedelta(minutes=11)).isoformat(), "battery_dc_power_w": -1000},
    ]
    out = summarize_phase2_points(points)
    assert out["measurement_available"] is False
    assert out["battery_dc_discharge_kwh"] == 0.0


def test_phase2_threshold_alarms_use_smartshunt_values():
    smart = source_data()["smartshunt"]
    smart.update({"voltage_v": 44.5, "soc_pct": 8})
    alarms = evaluate_phase2_battery_alarms(smart, {"battery_under_voltage": 46, "battery_over_voltage": 58, "soc_low": 15})
    assert {alarm["code"] for alarm in alarms} == {"smartshunt_voltage_low", "smartshunt_soc_low"}
    assert all(alarm["source"] == "smartshunt-threshold" for alarm in alarms)


def test_mock_history_is_ordered_and_integrable():
    points = mock_phase2_history("24h")
    assert 280 <= len(points) <= 600
    assert points[0]["ts"] < points[-1]["ts"]
    assert summarize_phase2_points(points)["measurement_available"] is True


def test_phase2_preview_api_contracts():
    base = os.environ.get("REACT_APP_BACKEND_URL")
    if not base:
        from dotenv import dotenv_values
        base = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
    live = requests.get(f"{base.rstrip('/')}/api/smartshunt-phase2/live", timeout=20)
    history = requests.get(f"{base.rstrip('/')}/api/smartshunt-phase2/history", params={"range": "12h"}, timeout=20)
    today = requests.get(f"{base.rstrip('/')}/api/smartshunt-phase2/today", timeout=20)
    assert live.status_code == history.status_code == today.status_code == 200
    payload = live.json()
    assert payload["preview"] is True
    assert payload["battery_dc"]["source"] == "smartshunt"
    assert payload["inverter_ac"]["source"] == "trucki-sun2000"
    assert payload["summary"]["house_power"] is not None
    assert history.json()["range"] == "12h"
    assert "battery_dc_charge_kwh" in today.json()