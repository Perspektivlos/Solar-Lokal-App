"""SmartShunt Phase-1: MQTT-Normalisierung, Statusgrenzen und Preview-API."""
import importlib
import os
from datetime import datetime, timedelta, timezone

import requests

ss = importlib.import_module("smartshunt")
mc = importlib.import_module("mqtt_client")


def raw_state(now: datetime, **patch):
    raw = {
        "ProductName": "Victron SmartShunt IP65 300A",
        "DeviceInstance": 290,
        "Connected": 1,
        "Mgmt/Connection": "VE.Direct /dev/ttyUSB0",
        "Dc/0/Voltage": 52.64,
        "Dc/0/Current": 8.2,
        "Dc/0/Power": 431.6,
        "Soc": 76.4,
        "History/ChargeCycles": 204,
        "History/ChargedEnergy": 1200.5,
        "_telemetry_ts": now.isoformat(),
        "_ts": now.isoformat(),
    }
    raw.update(patch)
    return raw


def test_current_state_and_positive_charge_sign():
    now = datetime.now(timezone.utc)
    state = ss.build_smartshunt_state(raw_state(now), now=now)
    assert state["status"] == "current"
    assert state["identity"]["valid"] is True
    assert state["direction"] == "charging"
    assert state["power_w"] == 431.6
    assert state["current_a"] == 8.2


def test_negative_power_is_discharge():
    now = datetime.now(timezone.utc)
    state = ss.build_smartshunt_state(raw_state(now, **{"Dc/0/Power": -320, "Dc/0/Current": -6.08}), now=now)
    assert state["direction"] == "discharging"
    assert state["power_w"] == -320.0


def test_status_thresholds_at_90_and_180_seconds():
    now = datetime.now(timezone.utc)
    fresh = ss.build_smartshunt_state(raw_state(now, _telemetry_ts=(now - timedelta(seconds=90)).isoformat()), now=now)
    stale = ss.build_smartshunt_state(raw_state(now, _telemetry_ts=(now - timedelta(seconds=91)).isoformat()), now=now)
    edge = ss.build_smartshunt_state(raw_state(now, _telemetry_ts=(now - timedelta(seconds=180)).isoformat()), now=now)
    unavailable = ss.build_smartshunt_state(raw_state(now, _telemetry_ts=(now - timedelta(seconds=181)).isoformat()), now=now)
    assert fresh["status"] == "current"
    assert stale["status"] == "stale"
    assert edge["status"] == "stale"
    assert unavailable["status"] == "unavailable"
    assert unavailable["voltage_v"] is None


def test_connected_zero_or_wrong_identity_is_unavailable():
    now = datetime.now(timezone.utc)
    disconnected = ss.build_smartshunt_state(raw_state(now, Connected=0), now=now)
    wrong_product = ss.build_smartshunt_state(raw_state(now, ProductName="Lynx Smart BMS"), now=now)
    wrong_instance = ss.build_smartshunt_state(raw_state(now, DeviceInstance=291), now=now)
    assert disconnected["status"] == "unavailable"
    assert wrong_product["identity"]["valid"] is False
    assert wrong_instance["identity"]["checks"]["instance"] is False


def test_optional_values_only_exist_when_reported():
    now = datetime.now(timezone.utc)
    base = ss.build_smartshunt_state(raw_state(now), now=now)
    with_optional = ss.build_smartshunt_state(raw_state(now, **{"Dc/0/MidVoltage": 26.31, "Dc/0/Temperature": 24.5}), now=now)
    assert base["optional"] == {}
    assert with_optional["optional"] == {"midpoint_voltage_v": 26.31, "temperature_c": 24.5}


def test_native_device_history_is_passed_through():
    now = datetime.now(timezone.utc)
    state = ss.build_smartshunt_state(raw_state(now), now=now)
    assert state["device_history"]["charge_cycles"] == 204.0
    assert state["device_history"]["charged_energy_kwh"] == 1200.5


def test_mqtt_dispatch_stores_battery_instance_and_telemetry_timestamp():
    mc._mqtt_data["victron"]["batteries"] = {}
    mc._dispatch_mqtt_message("N/portal/battery/290/ProductName", b'{"value":"Victron SmartShunt IP65 300A"}')
    mc._dispatch_mqtt_message("N/portal/battery/290/Dc/0/Voltage", b'{"value":52.7}')
    raw = mc._mqtt_data["victron"]["batteries"][290]
    assert raw["ProductName"] == "Victron SmartShunt IP65 300A"
    assert raw["Dc/0/Voltage"] == 52.7
    assert raw["_telemetry_ts"] is not None


def test_demo_history_is_ordered_and_complete():
    points = ss.mock_smartshunt_history("6h")
    assert len(points) == 96
    assert points[0]["ts"] < points[-1]["ts"]
    assert all({"voltage_v", "current_a", "power_w", "soc_pct"}.issubset(point) for point in points)


def test_preview_endpoints_contract():
    base = os.environ.get("REACT_APP_BACKEND_URL")
    if not base:
        from dotenv import dotenv_values
        base = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
    preview = requests.get(f"{base.rstrip('/')}/api/smartshunt/preview", timeout=20)
    history = requests.get(f"{base.rstrip('/')}/api/smartshunt/history", params={"range": "3h"}, timeout=20)
    assert preview.status_code == 200
    assert history.status_code == 200
    payload = preview.json()
    assert payload["preview"] is True and payload["read_only"] is True
    assert payload["current"]["instance"] == 290
    assert payload["topic_base"].endswith("/battery/290/")
    assert history.json()["range"] == "3h"

    def has_object_id(value):
        if isinstance(value, dict):
            return "_id" in value or any(has_object_id(item) for item in value.values())
        if isinstance(value, list):
            return any(has_object_id(item) for item in value)
        return False

    assert not has_object_id(payload)
    assert not has_object_id(history.json())