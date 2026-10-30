# Daily autonomy regression: actual route formula, clamps and yesterday's public response.
import ast
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict

import pytest

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

    class Cursor:
        def find(self, *args):
            return self

        def sort(self, *args):
            return self

        def limit(self, *args):
            return self

        async def to_list(self, *args):
            return rows

    tree = ast.parse((Path(__file__).parents[1] / 'routes.py').read_text())
    route = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'today')
    route.decorator_list = []
    module = ast.fix_missing_locations(ast.Module(body=[route], type_ignores=[]))
    namespace = {'datetime': datetime, 'timezone': timezone, 'timedelta': timedelta,
                 'Dict': Dict, 'Any': Any, 'db': SimpleNamespace(snapshots=Cursor())}
    exec(compile(module, 'routes.py', 'exec'), namespace)
    data = asyncio.run(namespace['today']())
    assert data['autarky_pct'] == expected
    assert 0 <= data['autarky_pct'] <= 100


def test_yesterday_household_autarky():
    data = fetch('today?day_offset=1')
    house = data['consumption_kwh']
    expected = max(0, min(100, (1 - data['grid_import_kwh'] / house) * 100)) if house else 0
    assert data['autarky_pct'] == pytest.approx(expected, abs=0.15)