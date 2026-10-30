# FlowSummary regression: real public daily metrics, demo counters and configured battery capacity.
import math
import os

import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')


def fetch(path):
    response = requests.get(f'{BASE_URL}/api/{path}', timeout=30)
    assert response.status_code == 200, response.text
    return response.json()


def test_today_metrics_contract():
    data = fetch('today')
    for key in ('pv_kwh', 'grid_import_kwh', 'consumption_kwh', 'autarky_pct'):
        assert isinstance(data[key], (int, float)) and math.isfinite(data[key])
        assert data[key] >= 0
    assert data['autarky_pct'] <= 100
    print('Today:', data)


def test_live_demo_and_battery_contract():
    data = fetch('live')
    assert isinstance(data['demo_mode'], bool)
    assert 0 <= data['summary']['battery_soc'] <= 100
    assert data['timestamp']
    assert isinstance(data['ahoy']['channels'], list)
    assert isinstance(data['victron']['mppts'], list)


def test_configured_battery_capacity():
    data = fetch('config')
    assert isinstance(data['display']['usable_kwh'], (int, float))
    assert data['display']['usable_kwh'] > 0


def test_demo_device_counters_are_not_integrated_yield():
    live = fetch('live')
    if not live['demo_mode']:
        pytest.skip('Only relevant in demo mode')
    counters = sum(c['yield_day'] for c in live['ahoy']['channels'])
    counters += sum(m['yield_today'] for m in live['victron']['mppts'])
    today = fetch('today')
    assert round(counters, 2) != round(today['pv_kwh'], 2)
    print('Demo counters:', counters, 'Integrated PV:', today['pv_kwh'])


def test_history_dashboard_seed_contract():
    data = fetch('history?range=1h')
    assert data['range'] == '1h'
    assert isinstance(data['points'], list) and data['points']
    assert all('_id' not in p for p in data['points'])
    assert all(k in data['points'][-1] for k in ('ts', 'pv_power', 'grid_power', 'house_power', 'battery_power'))


def test_autarky_represents_house_demand_without_grid_import():
    data = fetch('today')
    if data['consumption_kwh'] < 0.1:
        pytest.skip('Insufficient measured consumption for stable rounded calculation')
    expected = max(0, min(100, (1 - data['grid_import_kwh'] / data['consumption_kwh']) * 100))
    assert data['autarky_pct'] == pytest.approx(expected, abs=0.15), (
        f"autarky_pct={data['autarky_pct']}, household-based expected={expected:.1f}; {data}"
    )