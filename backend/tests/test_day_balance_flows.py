# DayBalance regression: public identities, actual integration code and historical source attribution.
import ast
import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List

import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')


def load_function(name, rows=None):
    class Cursor:
        def find(self, *args): return self
        def sort(self, *args): return self
        def limit(self, *args): return self
        async def to_list(self, *args): return rows
    tree = ast.parse((Path(__file__).parents[1] / 'routes.py').read_text())
    helper_names = {'_safe_power', '_charge_w', '_discharge_w', '_flow_components', '_summarize_energy_rows'}
    helpers = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in helper_names]
    node = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name)
    node.decorator_list = []
    namespace = dict(datetime=datetime, timezone=timezone, timedelta=timedelta,
                     Dict=Dict, List=List, Any=Any, MAX_ENERGY_GAP_SECONDS=600,
                     db=SimpleNamespace(snapshots=Cursor()))
    body = helpers if name in helper_names else helpers + [node]
    exec(compile(ast.fix_missing_locations(ast.Module(body=body, type_ignores=[])), 'routes.py', 'exec'), namespace)
    return namespace[name]


def snapshot(seconds, pv=0, charge=0, discharge=0, grid=0, house=0):
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return dict(ts=(start + timedelta(seconds=seconds)).isoformat(), pv_power=pv,
                battery_charge_w=charge, battery_discharge_w=discharge,
                battery_power=charge-discharge, grid_power=grid, house_power=house)


def check_identities(d):
    tol = 0.0021
    assert d['pv_kwh'] == pytest.approx(d['pv_direct_kwh'] + d['battery_charge_kwh'] + d['pv_export_kwh'], abs=tol)
    assert d['consumption_kwh'] == pytest.approx(d['pv_direct_kwh'] + d['battery_to_house_kwh'] + d['grid_import_kwh'], abs=tol)
    assert d['grid_export_kwh'] == pytest.approx(d['pv_export_kwh'] + d['battery_export_kwh'], abs=tol)
    assert d['battery_discharge_kwh'] == pytest.approx(d['battery_to_house_kwh'] + d['battery_export_kwh'], abs=tol)
    assert d['self_consumption_kwh'] == pytest.approx(d['pv_direct_kwh'] + d['battery_charge_kwh'], abs=tol)
    assert d['round_trip_pct'] == d['battery_discharge_charge_pct']
    assert all(0 <= d[k] <= 100 for k in ('autarky_pct', 'self_consumption_pct', 'battery_discharge_charge_pct'))
    if d['consumption_kwh'] > 0.05:
        assert d['autarky_pct'] == pytest.approx((1-d['grid_import_kwh']/d['consumption_kwh'])*100, abs=0.5)
    if d['pv_kwh'] > 0.05:
        assert d['self_consumption_pct'] == pytest.approx(d['self_consumption_kwh']/d['pv_kwh']*100, abs=0.5)


@pytest.mark.parametrize('offset', [0, 1])
def test_public_daily_identities(offset):
    response = requests.get(f'{BASE_URL}/api/today', params={'day_offset': offset}, timeout=30)
    assert response.status_code == 200
    check_identities(response.json())
    print(offset, response.json())


@pytest.mark.parametrize('powers,expected', [
    ({'pv': 1000, 'house': 600, 'grid': -400}, (0.05, 0, 0.033)),
    ({'discharge': 1000, 'house': 600, 'grid': -400}, (0, 0.05, 0)),
    ({'grid': 1000, 'house': 1000}, (0, 0, 0)),
    ({'pv': 1200, 'charge': 200, 'discharge': 500, 'grid': -600, 'house': 900}, (0.05, 0.025, 0.033)),
    ({'pv': 1000, 'charge': 400, 'grid': 300, 'house': 900}, (0.05, 0, 0)),
])
def test_deterministic_source_split(powers, expected):
    data = asyncio.run(load_function('today', [snapshot(0, **powers), snapshot(300, **powers)])())
    check_identities(data)
    assert data['pv_direct_kwh'] == pytest.approx(expected[0], abs=0.001)
    assert data['battery_to_house_kwh'] == pytest.approx(expected[1], abs=0.001)
    assert data['pv_export_kwh'] == pytest.approx(expected[2], abs=0.001)


def test_actual_durations_gaps_and_nonpositive_intervals():
    rows = [snapshot(0, pv=1000, house=1000), snapshot(60, pv=2000, house=2000),
            snapshot(60, pv=2000, house=2000), snapshot(30, pv=2000, house=2000),
            snapshot(1000, pv=2000, house=2000), snapshot(1120, pv=1000, house=1000)]
    data = asyncio.run(load_function('today', rows)())
    assert data['pv_kwh'] == 0.075
    assert data['avg_pv_w'] == 1500
    assert data['avg_house_w'] == 1500
    check_identities(data)


@pytest.mark.parametrize('rows', [[], [snapshot(0, pv=1000)]])
def test_empty_or_single_snapshot(rows):
    data = asyncio.run(load_function('today', rows)())
    assert data['measurement_available'] is False
    assert data['sample_count'] == len(rows)
    assert all(v == 0 for k, v in data.items() if k not in {'measurement_available', 'sample_count'})


@pytest.mark.parametrize('charge,expected', [(500, 0), (510, 50), (1000, 50)])
def test_discharge_charge_threshold_and_alias(charge, expected):
    powers = dict(pv=charge, charge=charge, discharge=charge/2, house=charge/2)
    data = asyncio.run(load_function('today', [snapshot(0, **powers), snapshot(360, **powers)])())
    assert data['battery_discharge_charge_pct'] == expected
    assert data['round_trip_pct'] == expected


@pytest.mark.parametrize('period', ['day', 'month'])
def test_public_history_balance(period):
    response = requests.get(f'{BASE_URL}/api/energy/balance', params={'period': period, 'limit': 14}, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data['period'] == period
    assert isinstance(data['buckets'], list)
    for bucket in data['buckets']:
        assert 0 <= bucket['self_kwh'] <= bucket['pv_kwh']
        assert isinstance(bucket['period'], str)


def test_history_does_not_assign_night_battery_export_to_daytime_pv():
    # 1h PV directly used by house; separate 1h battery-only export: all PV stays local.
    start = snapshot(0, pv=12000, house=12000)
    pv_end = snapshot(300, pv=12000, house=12000)
    battery_start = snapshot(901, discharge=12000, grid=-12000)
    battery_end = snapshot(1201, discharge=12000, grid=-12000)
    data = load_function('_summarize_energy_rows')([start, pv_end, battery_start, battery_end])
    assert data['pv_kwh'] == 1
    assert data['grid_export_kwh'] == 1
    assert data['self_consumption_kwh'] == 1, 'Source shares must be integrated before temporal grouping'