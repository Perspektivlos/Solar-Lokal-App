"""Unit tests for the extracted mqtt_client module (pure parsing & SoC logic)."""

import importlib

mc = importlib.import_module("mqtt_client")


def _reset_store() -> None:
    mc._mqtt_data["shelly"] = {"phases": [], "total_power": 0.0, "online": False, "_ts": None}
    mc._mqtt_data["trucki"] = {"raw": {}, "_ts": None}
    mc._mqtt_data["ahoy"] = {"raw": {}, "_ts": None}


def test_parse_payload_json_value_unwrap() -> None:
    assert mc._parse_mqtt_payload(b'{"value": 42.5}') == 42.5


def test_parse_payload_plain_numbers() -> None:
    assert mc._parse_mqtt_payload(b"53.2") == 53.2
    assert mc._parse_mqtt_payload(b"7") == 7
    assert mc._parse_mqtt_payload(b"ON") == "ON"
    assert mc._parse_mqtt_payload(b"") is None


def test_trucki_soc_curve_bounds() -> None:
    assert mc._trucki_soc_from_voltage(47.0) == 0.0
    assert mc._trucki_soc_from_voltage(55.0) == 100.0
    mid = mc._trucki_soc_from_voltage(52.64)
    assert 49.0 <= mid <= 51.0  # ~50% anchor


def test_trucki_soc_load_compensation_raises_estimate() -> None:
    idle = mc._trucki_soc_from_voltage(52.0, discharge_w=0.0)
    loaded = mc._trucki_soc_from_voltage(52.0, discharge_w=500.0)
    assert loaded >= idle  # voltage sag is compensated upward


def test_dispatch_routes_trucki_and_shelly() -> None:
    _reset_store()
    mc._dispatch_mqtt_message("Trucki/VBAT", b"52.8")
    assert mc._mqtt_data["trucki"]["raw"]["VBAT"] == 52.8

    shelly_payload = b'{"a_act_power": 100, "b_act_power": 50, "c_act_power": 25, "total_act_power": 175}'
    mc._dispatch_mqtt_message("venus/grid/shellypro/status/em:0", shelly_payload)
    snap = mc.fetch_shelly_from_mqtt()
    assert snap is not None
    assert snap["total_power"] == 175.0
    assert len(snap["phases"]) == 3
    assert snap["_via_mqtt"] is True


def test_fetch_trucki_from_mqtt_discharging() -> None:
    _reset_store()
    mc._mqtt_data["trucki"]["raw"] = {"VBAT": 52.5, "METER": 300.0, "STATE": "ON", "ZEPC": "(ENABLED) 1"}
    res = mc.fetch_trucki_from_mqtt()
    assert res is not None
    assert res["ac_output"] is True
    assert res["zepc"] is True
    assert res["battery_power"] == -300.0  # discharging => negative
