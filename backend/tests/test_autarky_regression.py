# Daily autonomy regression: zeitgewichtete Flussintegration, clamps und Vortags-API.
from datetime import datetime, timezone, timedelta

import pytest
import server  # noqa: F401
import routes

from test_flow_summary import fetch


@pytest.mark.parametrize('house,grid,expected', [
    (1000, 500, 50.0), (1000, 0, 100.0),
    (1000, 1500, 0.0), (0, 0, 0.0), (1000, 333, 66.7),
])
def test_actual_today_route_autarky_bounds(house, grid, expected):
    now = datetime.now(timezone.utc)
    rows = [{'ts': (now - timedelta(minutes=n)).isoformat(),
             'pv_power': 100, 'house_power': house,
             'grid_power': grid, 'battery_power': -400} for n in (10, 5)]

    data = routes._summarize_energy_rows(rows)
    assert data['autarky_pct'] == expected
    assert 0 <= data['autarky_pct'] <= 100


def test_yesterday_household_autarky():
    data = fetch('today?day_offset=1')
    house = data['consumption_kwh']
    expected = max(0, min(100, (1 - data['grid_import_kwh'] / house) * 100)) if house else 0
    assert data['autarky_pct'] == pytest.approx(expected, abs=0.15)