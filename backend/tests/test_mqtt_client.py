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
    # battery_power must come from ACDISPLAY (inverter output), NOT METER (grid).
    mc._mqtt_data["trucki"]["raw"] = {
        "VBAT": 52.5, "METER": 300.0, "ACDISPLAY": 420.0,
        "STATE": "ON", "ZEPC": "(ENABLED) 1",
    }
    res = mc.fetch_trucki_from_mqtt()
    assert res is not None
    assert res["ac_output"] is True
    assert res["zepc"] is True
    assert res["battery_power"] == -420.0  # discharging => negative, from ACDISPLAY
    assert res["grid_meter_w"] == 300.0    # METER kept separately, != battery


def test_fetch_trucki_battery_independent_of_grid_meter() -> None:
    _reset_store()
    # Regression: Netz (METER) and Akku (ACDISPLAY) must differ.
    mc._mqtt_data["trucki"]["raw"] = {
        "VBAT": 52.5, "METER": 0.0, "ACDISPLAY": 380.0, "STATE": "ON",
    }
    res = mc.fetch_trucki_from_mqtt()
    assert res["battery_power"] == -380.0
    assert res["grid_meter_w"] == 0.0


def test_fetch_trucki_acsetpoint_fallback() -> None:
    _reset_store()
    # No ACDISPLAY -> fall back to ACSETPOINT.
    mc._mqtt_data["trucki"]["raw"] = {"VBAT": 52.5, "ACSETPOINT": 250.0, "STATE": "ON"}
    res = mc.fetch_trucki_from_mqtt()
    assert res["battery_power"] == -250.0


def test_fetch_ahoy_parses_json_channel_objects() -> None:
    _reset_store()
    # AhoyDTU publiziert je Kanal ein JSON-Objekt unter HM1500/chN (nicht flach).
    mc._mqtt_data["ahoy"]["raw"] = {
        "HM1500/total": {"P_AC": 656.1, "YieldDay": 946, "P_DC": 690.7},
        "HM1500/ch0": {"P_AC": 656.1, "U_AC": 228.1, "YieldDay": 946},
        "HM1500/ch1": {"U_DC": 38.2, "I_DC": 5.4, "P_DC": 206.6, "YieldDay": 303},
        "HM1500/ch2": {"U_DC": 38.2, "I_DC": 0.03, "P_DC": 1, "YieldDay": 6},
        "HM1500/ch3": {"U_DC": 41.2, "I_DC": 6.8, "P_DC": 280, "YieldDay": 332},
        "HM1500/ch4": {"U_DC": 41.2, "I_DC": 4.93, "P_DC": 203.1, "YieldDay": 305},
        "HM1500/available": 2,
        "HM1500/ack_pwr_limit": 60.0,
    }
    res = mc.fetch_ahoy_from_mqtt()
    assert res is not None
    assert res["online"] is True
    assert res["total_power"] == 656.1
    assert res["limit_percent"] == 60          # aus ack_pwr_limit, nicht Default 100
    assert len(res["channels"]) == 4
    assert res["channels"][0]["power"] == 206.6   # CH1 P_DC (vorher 0!)
    assert res["channels"][2]["power"] == 280.0   # CH3 P_DC
    assert res["channels"][0]["voltage"] == 38.2
    assert res["channels"][0]["yield_day"] == 0.303  # Wh -> kWh


def test_fetch_ahoy_ac_falls_back_to_ch0() -> None:
    _reset_store()
    mc._mqtt_data["ahoy"]["raw"] = {
        "HM1500/ch0": {"P_AC": 542.8, "YieldDay": 899},
        "HM1500/available": 1,
    }
    res = mc.fetch_ahoy_from_mqtt()
    assert res["total_power"] == 542.8
    assert res["limit_percent"] == 100  # kein Limit-Topic -> Default

