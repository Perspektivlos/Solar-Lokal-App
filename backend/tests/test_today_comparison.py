# Tagesvergleich: public today API compatibility and isolated UTC boundary/integration checks.
import ast
import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict
from types import SimpleNamespace

import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
FIELDS = {'pv_kwh', 'consumption_kwh', 'grid_import_kwh', 'grid_export_kwh',
          'self_consumption_kwh', 'autarky_pct', 'self_consumption_pct',
          'avg_pv_w', 'avg_house_w', 'battery_charge_kwh',
          'battery_discharge_kwh', 'round_trip_pct'}


@pytest.mark.parametrize('params', [{}, {'day_offset': 0}, {'day_offset': 1}])
def test_today_public_contract(params):
    response = requests.get(f'{BASE_URL}/api/today', params=params, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert set(data) == FIELDS
    assert all(isinstance(v, (int, float)) and v >= 0 for v in data.values())
    print(params, data)


def test_today_public_default_matches_zero():
    default = requests.get(f'{BASE_URL}/api/today', timeout=30).json()
    explicit = requests.get(f'{BASE_URL}/api/today', params={'day_offset': 0}, timeout=30).json()
    assert set(default) == set(explicit) == FIELDS
    # Poller can add one snapshot between requests; allow only one sample's drift.
    for field in FIELDS:
        assert abs(default[field] - explicit[field]) <= (5 if field.endswith('_w') else 1)


@pytest.mark.parametrize('offset', [0, 1])
def test_today_utc_boundaries_and_energy(offset):
    # Execute the actual route body with a deterministic in-memory cursor; no API is mocked.
    now = datetime(2026, 2, 18, 12, 0, tzinfo=timezone.utc)
    start = now.replace(hour=0) - timedelta(days=offset)
    end = now if offset == 0 else start + timedelta(days=1)

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    def row(ts, power):
        return {'ts': ts.isoformat(), 'pv_power': power, 'house_power': power / 2,
                'grid_power': power / 4, 'battery_power': power / 8}

    rows = [row(start - timedelta(seconds=1), 999999), row(start, 1000),
            row(start + timedelta(minutes=5), 1000), row(end, 999999)]

    class Cursor:
        def find(self, query, projection):
            assert query == {'ts': {'$gte': start.isoformat(), '$lt': end.isoformat()}}
            assert projection == {'_id': 0}
            self.selected = [r for r in rows if query['ts']['$gte'] <= r['ts'] < query['ts']['$lt']]
            return self

        def sort(self, key, direction):
            assert (key, direction) == ('ts', 1)
            return self

        def limit(self, count):
            return self

        async def to_list(self, count):
            return self.selected

    tree = ast.parse((Path(__file__).parents[1] / 'routes.py').read_text())
    route = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'today')
    route.decorator_list = []
    module = ast.fix_missing_locations(ast.Module(body=[route], type_ignores=[]))
    namespace = {'datetime': FrozenDatetime, 'timezone': timezone, 'timedelta': timedelta,
                 'Dict': Dict, 'Any': Any, 'db': SimpleNamespace(snapshots=Cursor())}
    exec(compile(module, 'routes.py', 'exec'), namespace)
    actual = asyncio.run(namespace['today'](offset))
    assert set(actual) == FIELDS
    assert actual['pv_kwh'] == pytest.approx(0.083, abs=0.001)
    assert actual['consumption_kwh'] == pytest.approx(0.042, abs=0.001)
    assert actual['battery_charge_kwh'] == pytest.approx(0.010, abs=0.001)
    assert actual['battery_discharge_kwh'] == 0