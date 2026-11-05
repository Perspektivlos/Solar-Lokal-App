"""Tests für die aktuelle zeitgewichtete Energiebilanz-Integration."""
from datetime import datetime, timedelta, timezone

import server  # noqa: F401  (löst späte Bindung, verhindert Zirkularimport beim direkten routes-Import)
import routes


def test_rows_to_balance_kwh_conversion():
    start = datetime(2026, 6, 8, tzinfo=timezone.utc)
    rows = [{"ts": (start + timedelta(minutes=5 * index)).isoformat(), "pv_power": 1000,
             "house_power": 500, "grid_power": -500, "battery_power": 0}
            for index in range(13)]
    out = routes._summarize_energy_rows(rows)
    assert out["pv_kwh"] == 1.0
    assert out["grid_export_kwh"] == 0.5
    assert out["self_consumption_kwh"] == 0.5
    assert out["measurement_available"] is True


def test_self_consumption_never_negative():
    start = datetime(2026, 6, 8, tzinfo=timezone.utc)
    rows = [
        {"ts": start.isoformat(), "pv_power": 100, "house_power": 0, "grid_power": -1000, "battery_power": 0},
        {"ts": (start + timedelta(minutes=5)).isoformat(), "pv_power": 100, "house_power": 0, "grid_power": -1000, "battery_power": 0},
    ]
    out = routes._summarize_energy_rows(rows)
    assert out["self_consumption_kwh"] == 0.0


def test_empty_rows():
    out = routes._summarize_energy_rows([])
    assert out["measurement_available"] is False
    assert out["pv_kwh"] == 0.0
