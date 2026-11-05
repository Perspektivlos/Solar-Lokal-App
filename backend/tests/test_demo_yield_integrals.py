# Demo cumulative counters, shared collection clock/location, real adapters and public polling.
import asyncio
import math
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

import collectors
import mocks
import mqtt_client
from sun import sun_times, sun_intensity

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
DAY = datetime(2026, 6, 21, tzinfo=timezone.utc)


def counters(now, lat=51.1657, lon=10.4515):
    a = mocks.mock_ahoy(now=now, lat=lat, lon=lon)
    v = mocks.mock_victron(now=now, lat=lat, lon=lon)
    t = mocks.mock_trucki(now=now, lat=lat, lon=lon)
    return [c['yield_day'] for c in a['channels']] + [m['yield_today'] for m in v['mppts']] + [t['day_energy_kwh'], t['total_energy_kwh']]


def test_same_timestamp_deterministic_and_live_power_varies():
    now = DAY.replace(hour=11)
    assert all(counters(now) == counters(now) for _ in range(8))
    assert len({mocks.mock_ahoy(now=now)['total_power'] for _ in range(8)}) > 1
    assert len({mocks.mock_victron(now=now)['total_power'] for _ in range(8)}) > 1
    assert len({mocks.mock_trucki(now=now)['battery_power'] for _ in range(8)}) > 1


def test_counters_monotonic_whole_day():
    previous = counters(DAY)
    for minute in list(range(5, 1440, 5)) + [1439]:
        now = DAY + timedelta(minutes=minute)
        current = counters(now)
        assert all(b >= a for a, b in zip(previous, current)), (now, previous, current)
        previous = current


def test_solar_zero_before_dawn_constant_after_dusk():
    for hour in (0, 1, 2):
        assert counters(DAY.replace(hour=hour))[:6] == [0] * 6
    assert counters(DAY.replace(hour=21))[:6] == counters(DAY.replace(hour=23, minute=59))[:6]


def test_solar_units_and_integral_match_1400w_sine():
    now = DAY.replace(hour=23)
    sunrise, sunset = sun_times(51.1657, 10.4515, now)
    expected = 1.4 * (sunset-sunrise).total_seconds()/3600 * 2/math.pi
    c = counters(now)
    assert sum(c[:4]) == pytest.approx(expected, abs=0.003)
    assert sum(c[4:6]) == pytest.approx(expected, abs=0.002)
    assert 10 < expected < 20


def test_trucki_integral_and_midnight_reset():
    now = DAY.replace(hour=23, minute=59)
    # Independent one-minute midpoint integral of the nominal SUN discharge curve.
    wh = sum(max(0, 260-210*mocks._sun_curve(DAY+timedelta(seconds=30+60*i))) / 60 for i in range(1439))
    assert mocks.mock_trucki(now=now)['day_energy_kwh'] == pytest.approx(wh/1000, abs=0.011)
    midnight = DAY + timedelta(days=1)
    before, after = counters(now), counters(midnight)
    assert after[:7] == [0]*7
    assert after[7] >= before[7]
    assert counters(midnight+timedelta(seconds=1))[:6] == [0]*6


def test_collect_live_shared_clock_and_location(monkeypatch):
    observed = []
    for name in ('ahoy', 'victron', 'trucki'):
        original = getattr(collectors, 'mock_'+name)
        def spy(intensity, now, lat, lon, original=original):
            observed.append((now, lat, lon, intensity))
            return original(intensity, now, lat, lon)
        monkeypatch.setattr(collectors, 'mock_'+name, spy)
    cfg = {'demo_mode': True, 'location': {'lat': 40, 'lon': -3}, 'devices': {name: {'enabled': True} for name in ('ahoy', 'victron', 'trucki')}}
    data = asyncio.run(collectors.collect_live(cfg))
    assert len(observed) == 3
    assert all(x == observed[0] for x in observed)
    assert observed[0][1:3] == (40, -3)
    assert data['sun']['sunrise'] == sun_times(40, -3, observed[0][0])[0].isoformat()
    assert counters(DAY.replace(hour=12), 40, -3)[:6] != counters(DAY.replace(hour=12), 51, 10)[:6]


def test_dusk_counter_boundary_diagnostics():
    for h, m, s in [(23, 55, 0), (23, 58, 50), (23, 58, 51), (23, 59, 0)]:
        now = DAY.replace(hour=h, minute=m, second=s)
        print(now.isoformat(), 'sun window', sun_times(51.1657, 10.4515, now), 'counters', counters(now))
    assert counters(DAY.replace(hour=23, minute=59))[:6] == counters(DAY.replace(hour=23, minute=55))[:6]


def test_direct_mock_power_uses_requested_location(monkeypatch):
    monkeypatch.setattr(mocks.random, 'uniform', lambda a, b: 0)
    now = DAY.replace(hour=7)
    lat, lon = 40, -100
    rise, setting = sun_times(lat, lon, now)
    expected = sun_intensity(now, rise, setting)
    assert mocks.mock_ahoy(now=now, lat=lat, lon=lon)['total_power'] == pytest.approx(1400*expected, abs=0.1)


def test_real_mqtt_energy_passthrough(monkeypatch):
    monkeypatch.setitem(mqtt_client._mqtt_data, 'ahoy', {'raw': {'HM1500/available': 1, 'HM1500/total': {'YieldDay': 1234}, 'HM1500/ch1': {'YieldDay': 321}}})
    monkeypatch.setitem(mqtt_client._mqtt_data, 'trucki', {'raw': {'DAYENERGY': 4.56, 'TOTALENERGY': 1234.5}})
    monkeypatch.setitem(mqtt_client._mqtt_data, 'victron', {'instances': {288: {'History/Daily/0/Yield': 3.456}}, 'system': {}})
    assert mqtt_client.fetch_ahoy_from_mqtt()['yield_day_kwh'] == 1.234
    assert mqtt_client.fetch_ahoy_from_mqtt()['channels'][0]['yield_day'] == 0.321
    assert mqtt_client.fetch_trucki_from_mqtt()['day_energy_kwh'] == 4.56
    assert mqtt_client.fetch_trucki_from_mqtt()['total_energy_kwh'] == 1234.5
    assert mqtt_client.fetch_victron_from_mqtt({'enabled': True, 'instances': [288]})['mppts'][0]['yield_today'] == 3.456


def test_real_http_energy_passthrough(monkeypatch):
    async def response(url, **kwargs):
        if '/api/inverter/' in url:
            return {'ch': [[], [34, 2, 68, 1.234]]}
        if '/status' in url:
            return {'soc': 50, 'day_energy_kwh': 4.56, 'total_energy_kwh': 1234.5}
        if '/api/v1/system' in url:
            return {'mppts': [{'id': 1, 'yield_today': 3.456}]}
        return {}
    monkeypatch.setattr(collectors, '_http_get', response)
    assert asyncio.run(collectors.fetch_ahoy('TEST_DEVICE'))['channels'][0]['yield_day'] == 1.234
    assert asyncio.run(collectors.fetch_victron('TEST_DEVICE'))['mppts'][0]['yield_today'] == 3.456
    trucki = asyncio.run(collectors.fetch_trucki('TEST_DEVICE'))
    assert trucki.get('day_energy_kwh') == 4.56, trucki
    assert trucki.get('total_energy_kwh') == 1234.5


def test_real_collectors_do_not_overwrite_mqtt_counters(monkeypatch):
    values = {'ahoy': {'online': True, 'channels': [{'yield_day': 1.234}]}, 'victron': {'online': True, 'mppts': [{'yield_today': 3.456}]}, 'trucki': {'online': True, 'day_energy_kwh': 4.56}}
    for name, data in values.items():
        monkeypatch.setattr(collectors, 'fetch_'+name+'_from_mqtt', lambda *args, data=data: data)
        def forbidden(*args):
            raise AssertionError('Demo calculation invoked for real MQTT data')
        monkeypatch.setattr(collectors, 'mock_'+name, forbidden)
    cfg = {'demo_mode': False, 'mqtt': {'enabled': True}, 'devices': {name: {'enabled': True} for name in values}}
    result = asyncio.run(collectors.collect_live(cfg))
    for name, data in values.items():
        assert result[name] == data


def test_public_live_poll_counters_monotonic():
    samples = []
    for _ in range(4):
        r = requests.get(f'{BASE_URL}/api/live', timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        samples.append(([c['yield_day'] for c in d['ahoy']['channels']] + [m['yield_today'] for m in d['victron']['mppts']] + [d['trucki']['day_energy_kwh'], d['trucki']['total_energy_kwh']], d))
        time.sleep(3.2)
    for (previous, _), (current, _) in zip(samples, samples[1:]):
        assert all(math.isfinite(b) and b >= a for a, b in zip(previous, current))
    assert len({d['trucki']['battery_power'] for _, d in samples}) > 1
    print('Public poll counters:', [x[0] for x in samples])