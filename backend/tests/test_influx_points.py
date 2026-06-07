"""Tests für den reichen InfluxDB-Punkte-Builder (_build_influx_points)."""

import server


def _sample_payload() -> dict:
    return {
        "timestamp": "2026-06-07T10:00:00+00:00",
        "summary": {
            "pv_power": 2000.0, "grid_power": -500.0, "battery_power": -300.0,
            "house_power": 1200.0, "battery_soc": 75.0,
        },
        "shelly": {
            "online": True, "total_power": -500.0,
            "phases": [
                {"phase": "L1", "power": -200.0, "voltage": 230.0, "current": 0.9, "pf": 0.95},
                {"phase": "L2", "power": -150.0, "voltage": 231.0, "current": 0.7, "pf": 0.93},
                {"phase": "L3", "power": -150.0, "voltage": 229.0, "current": 0.6, "pf": 0.92},
            ],
        },
        "ahoy": {
            "online": True, "total_power": 1400.0, "limit_percent": 100,
            "channels": [
                {"ch": 1, "power": 350.0, "voltage": 34.0, "current": 10.0, "yield_day": 0.9},
                {"ch": 2, "power": 350.0, "voltage": 34.0, "current": 10.0, "yield_day": 0.9},
            ],
        },
        "victron": {
            "online": True, "total_power": 600.0,
            "mppts": [
                {"id": 288, "pv_power": 300.0, "pv_voltage": 95.0, "battery_voltage": 52.4, "yield_today": 1.2, "state": "Bulk"},
                {"id": 289, "pv_power": 300.0, "pv_voltage": 96.0, "battery_voltage": 52.4, "yield_today": 1.1, "state": "Bulk"},
            ],
        },
        "trucki": {
            "online": True, "soc": 75.0, "battery_voltage": 52.5, "battery_power": -300.0,
            "zepc": True, "temperature": 32.5, "ac_setpoint_w": 320.0, "ac_display_w": 305.0,
            "day_energy_kwh": 2.3, "total_energy_kwh": 410.0,
        },
    }


def _measurements(points) -> list:
    # InfluxDB Point speichert das Measurement intern als _name.
    return [p._name for p in points]


def test_builds_all_device_measurements() -> None:
    pts = server._build_influx_points(_sample_payload())
    names = _measurements(pts)
    assert "solar" in names
    assert names.count("shelly_phase") == 3
    assert "shelly" in names
    assert "hoymiles" in names
    assert names.count("hoymiles_ch") == 2
    assert "victron" in names
    assert names.count("victron_mppt") == 2
    assert "trucki" in names


def test_instant_ratios_self_sufficiency() -> None:
    # house=1200, grid=-500 (export) -> import=0 -> autarky=100%
    autarky, self_cons = server._instant_ratios(
        {"house_power": 1200.0, "grid_power": -500.0, "pv_power": 2000.0}
    )
    assert autarky == 100.0
    # pv=2000, export=500 -> self_cons = (2000-500)/2000*100 = 75%
    assert round(self_cons, 1) == 75.0


def test_instant_ratios_partial_grid_import() -> None:
    # house=1000, grid=+400 (import) -> autarky=(1000-400)/1000=60%
    autarky, _ = server._instant_ratios(
        {"house_power": 1000.0, "grid_power": 400.0, "pv_power": 600.0}
    )
    assert round(autarky, 1) == 60.0


def test_offline_trucki_skipped() -> None:
    payload = _sample_payload()
    payload["trucki"]["online"] = False
    names = _measurements(server._build_influx_points(payload))
    assert "trucki" not in names


def test_summary_point_has_autarky_field() -> None:
    pts = server._build_influx_points(_sample_payload())
    solar = next(p for p in pts if p._name == "solar")
    assert "autarky_pct" in solar._fields
    assert "self_consumption_pct" in solar._fields
