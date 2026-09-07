"""Tests für die Alarm-/Status-Engine (backend/alarms.py)."""
from alarms import evaluate_alarms, summarize_alarms


def _base_live(demo=True):
    return {
        "demo_mode": demo,
        "shelly": {"online": True, "total_power": 100, "phases": [
            {"phase": "L1", "voltage": 230.0, "current": 5.0, "power": 100},
            {"phase": "L2", "voltage": 230.0, "current": 4.0, "power": 80},
            {"phase": "L3", "voltage": 230.0, "current": 3.0, "power": 60},
        ]},
        "ahoy": {"online": True, "total_power": 500, "channels": [{"ch": 1, "power": 500, "voltage": 34, "current": 14}]},
        "trucki": {"online": True, "soc": 50.0, "battery_voltage": 52.4, "battery_power": -100},
        "victron": {"online": True, "total_power": 700, "mppts": [
            {"id": 1, "name": "MPPT #1", "battery_voltage": 52.4},
            {"id": 2, "name": "MPPT #2", "battery_voltage": 52.4},
        ]},
    }


def test_no_alarms_in_healthy_demo():
    items = evaluate_alarms(_base_live(demo=True))
    assert items == []
    s = summarize_alarms(items)
    assert s["level"] == "ok" and s["count"] == 0


def test_overvoltage_warning_and_critical():
    live = _base_live()
    live["shelly"]["phases"][0]["voltage"] = 255.0  # > 253 warn
    live["shelly"]["phases"][1]["voltage"] = 268.0  # > 265 crit
    items = evaluate_alarms(live)
    codes = {a["code"]: a["severity"] for a in items}
    assert codes.get("volt-L1-overvoltage") == "warning"
    assert codes.get("volt-L2-overvoltage") == "critical"


def test_undervoltage():
    live = _base_live()
    live["shelly"]["phases"][0]["voltage"] = 200.0  # < 207 warn
    items = evaluate_alarms(live)
    assert any(a["code"] == "volt-L1-undervoltage" and a["severity"] == "warning" for a in items)


def test_overcurrent():
    live = _base_live()
    live["shelly"]["phases"][0]["current"] = 26.0  # > 25 warn
    live["shelly"]["phases"][1]["current"] = 35.0  # > 32 crit
    items = evaluate_alarms(live)
    codes = {a["code"]: a["severity"] for a in items}
    assert codes.get("overcurrent-L1") == "warning"
    assert codes.get("overcurrent-L2") == "critical"


def test_battery_soc_and_voltage():
    live = _base_live()
    live["trucki"]["soc"] = 10.0            # < 15 warn
    live["trucki"]["battery_voltage"] = 47.0  # < 48 warn
    items = evaluate_alarms(live)
    codes = {a["code"] for a in items}
    assert "soc-low" in codes
    assert "batt-undervoltage" in codes


def test_battery_soc_critical():
    live = _base_live()
    live["trucki"]["soc"] = 5.0  # < 8 crit
    items = evaluate_alarms(live)
    assert any(a["code"] == "soc-low" and a["severity"] == "critical" for a in items)


def test_connectivity_suppressed_in_demo():
    live = _base_live(demo=True)
    live["shelly"] = {"online": False, "_fallback": True}
    items = evaluate_alarms(live, mqtt_enabled=True, mqtt_connected=False)
    # Im Demo-Modus keine Verbindungs-Alarme
    assert not any(a["code"] == "unreachable" for a in items)
    assert not any(a["code"] == "mqtt-down" for a in items)


def test_device_unreachable_live():
    live = _base_live(demo=False)
    live["shelly"] = {"online": False, "_fallback": True}
    items = evaluate_alarms(live)
    assert any(a["device"] == "shelly" and a["code"] == "unreachable" and a["severity"] == "critical" for a in items)


def test_disabled_device_not_flagged():
    live = _base_live(demo=False)
    live["trucki"] = {"online": False}  # deaktiviert (kein _fallback)
    items = evaluate_alarms(live)
    assert not any(a["device"] == "trucki" and a["code"] == "unreachable" for a in items)


def test_ahoy_online_but_no_data():
    live = _base_live(demo=False)
    live["ahoy"] = {"online": True, "total_power": 0, "channels": []}
    items = evaluate_alarms(live)
    assert any(a["code"] == "inverter-no-data" and a["severity"] == "warning" for a in items)


def test_mqtt_down_live():
    live = _base_live(demo=False)
    items = evaluate_alarms(live, mqtt_enabled=True, mqtt_connected=False)
    assert any(a["code"] == "mqtt-down" and a["device"] == "system" for a in items)


def test_summary_levels():
    live = _base_live()
    live["shelly"]["phases"][0]["voltage"] = 255.0  # warn
    live["trucki"]["soc"] = 5.0                      # crit
    s = summarize_alarms(evaluate_alarms(live))
    assert s["level"] == "critical"
    assert s["critical"] >= 1 and s["warning"] >= 1
