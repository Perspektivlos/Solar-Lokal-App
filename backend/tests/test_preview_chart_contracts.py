"""Public API contracts for preview daily grouped bars and battery SoC curves."""
import os
import math
from datetime import date

import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')


def test_daily_balance_chart_contract():
    response = requests.get(f'{BASE_URL}/api/energy/balance', params={'period': 'day', 'limit': 14}, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data['period'] == 'day'
    rows = data['buckets']
    assert isinstance(rows, list) and 0 < len(rows) <= 14
    assert [r['period'] for r in rows] == sorted(r['period'] for r in rows)
    for row in rows:
        date.fromisoformat(row['period'])
        assert set(row) == {'period', 'pv_kwh', 'self_kwh', 'import_kwh', 'export_kwh'}
        for field in ['pv_kwh', 'self_kwh', 'import_kwh', 'export_kwh']:
            assert isinstance(row[field], (float, int)) and math.isfinite(row[field]) and row[field] >= 0
        assert row['self_kwh'] == round(max(0, row['pv_kwh'] - row['export_kwh']), 2)
    print('daily chart API values:', rows)


def test_balance_rejects_non_integer_limit():
    response = requests.get(f'{BASE_URL}/api/energy/balance', params={'period': 'day', 'limit': 'invalid'}, timeout=30)
    assert response.status_code == 422
    assert response.json()['detail'][0]['loc'] == ['query', 'limit']


def test_battery_soc_history_contract():
    response = requests.get(f'{BASE_URL}/api/history', params={'range': '24h'}, timeout=30)
    assert response.status_code == 200
    points = response.json()['points']
    assert points
    for point in points:
        assert isinstance(point['battery_power'], (float, int))
        assert isinstance(point['battery_soc'], (float, int)) and 0 <= point['battery_soc'] <= 100