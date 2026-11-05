"""Probe contract, read-only safety, error cleanup, and adversarial acceptance tests."""
import json
import os
import threading
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import requests
import smartshunt_probe as probe
from smartshunt import ingest_smartshunt_value
from test_smartshunt_probe import DummySocket, FakeClient

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
VALUES = {'ProductName': 'Victron SmartShunt IP65 300A', 'DeviceInstance': 290,
          'Connected': 1, 'Mgmt/Connection': 'VE.Direct /dev/ttyUSB0',
          'Dc/0/Voltage': 52.7, 'Dc/0/Current': -4.2, 'Dc/0/Power': -221.3,
          'Soc': 73.4, 'History/ChargeCycles': 222}


@pytest.fixture
def fake_probe(monkeypatch):
    class Client(FakeClient):
        values = dict(VALUES)
        def loop_start(self):
            for path, value in self.values.items():
                self.on_message(self, None, SimpleNamespace(
                    topic=f'N/portal/battery/290/{path}', payload=json.dumps({'value': value}).encode()))
    monkeypatch.setattr(probe.socket, 'create_connection', lambda *a, **k: DummySocket())
    monkeypatch.setattr(probe.mqtt, 'Client', Client)
    return Client


def run():
    return probe.probe_smartshunt({'host': 'TEST_private_host', 'username': 'TEST_user', 'password': 'TEST_secret'}, 'portal', .01)


def test_public_probe_contract_and_cloud_failure():
    response = requests.post(f'{BASE_URL}/api/smartshunt/probe', timeout=25)
    assert response.status_code == 200
    data = response.json()
    assert data['passed'] is False and data['read_only'] is True and data['instance'] == 290
    assert data['message_count'] == data['field_count'] == 0
    assert data['current']['status'] == 'unavailable' and data['current']['demo'] is False
    assert data['probe_id'] and datetime.fromisoformat(data['tested_at'])
    assert any(c['id'] == 'broker' and c['ok'] is False for c in data['checks'])
    assert any(c['id'] == 'read-only' and c['ok'] is True for c in data['checks'])


def test_valid_fake_broker_full_contract(fake_probe):
    data = run()
    assert data['passed'] is True and len(data['checks']) == 11
    assert data['message_count'] == data['field_count'] == 9
    assert data['current']['device_history']['charge_cycles'] == 222
    assert data['current']['demo'] is False and data['current']['age_seconds'] <= 1
    assert not any(secret in str(data) for secret in ('TEST_private_host', 'TEST_user', 'TEST_secret'))


@pytest.mark.parametrize('field,value', [('ProductName','Battery monitor'), ('DeviceInstance',291),
    ('Mgmt/Connection','Bluetooth'), ('Connected',0), ('Soc',None), ('Soc','bad'),
    ('History/ChargeCycles',None)])
def test_invalid_required_fields_fail(fake_probe, field, value):
    fake_probe.values[field] = value
    assert run()['passed'] is False


@pytest.mark.parametrize('power', ['missing', None, 'bad'])
def test_power_must_be_received_not_calculated(fake_probe, power):
    if power == 'missing':
        fake_probe.values.pop('Dc/0/Power')
    else:
        fake_probe.values['Dc/0/Power'] = power
    data = run()
    assert data['passed'] is False, f'Missing/invalid required Power must fail; got {data["current"]["power_w"]}'


def test_invalid_telemetry_does_not_refresh_timestamp():
    raw = {}
    old = '2020-01-01T00:00:00+00:00'
    ingest_smartshunt_value(raw, 'Soc', 60, old)
    ingest_smartshunt_value(raw, 'Soc', None, datetime.now(timezone.utc).isoformat())
    assert raw['_telemetry_ts'] == old and raw['_field_ts']['Soc'] == old


def test_missing_portal_returns_explanatory_checks(fake_probe):
    data = probe.probe_smartshunt({'host':'TEST_host'}, '', .01)
    assert data['passed'] is False
    assert data['checks'], 'Missing portal failure must include an explanatory check in visible protocol'


def test_connect_error_structured_and_lock_released(fake_probe):
    def fail(self, *args, **kwargs):
        raise OSError('TEST_secret connection failed')
    fake_probe.connect = fail
    try:
        data = run()
        assert data['passed'] is False and data['checks']
        assert 'TEST_secret' not in str(data)
    finally:
        assert not probe._probe_lock.locked(), 'Lock must release even on connection exception'


def test_concurrent_probe_rejected_and_first_releases(fake_probe, monkeypatch):
    started, release = threading.Event(), threading.Event()
    def slow_socket(*args, **kwargs):
        started.set()
        assert release.wait(5)
        return DummySocket()
    monkeypatch.setattr(probe.socket, 'create_connection', slow_socket)
    results = []
    worker = threading.Thread(target=lambda: results.append(run()))
    worker.start()
    try:
        assert started.wait(2)
        second = run()
        assert second['passed'] is False and 'bereits aktiv' in second['current']['status_reason']
    finally:
        release.set()
        worker.join(5)
    assert results[0]['passed'] is True and not probe._probe_lock.locked()


def test_other_topics_ignored(fake_probe):
    original = fake_probe.loop_start
    def emit(self):
        self.on_message(self, None, SimpleNamespace(topic='N/portal/battery/291/Soc', payload=b'{"value":5}'))
        original(self)
    fake_probe.loop_start = emit
    data = run()
    assert data['message_count'] == 9 and data['current']['soc_pct'] == 73.4


@pytest.mark.parametrize('scenario', ['success', 'connect_error', 'missing_portal', 'auth_rejected'])
def test_route_returns_structured_200_for_mqtt_outcomes(fake_probe, monkeypatch, scenario):
    # In-process ASGI only; fake config/client, no lifespan, database writes, or actual broker.
    import server
    import smartshunt_routes as routes
    from fastapi.testclient import TestClient
    async def config():
        return {'mqtt': {'host': 'TEST_private_host'},
                'victron_mqtt': {'vrm_id': '' if scenario == 'missing_portal' else 'portal'}}
    monkeypatch.setattr(routes, 'get_config', config)
    if scenario == 'connect_error':
        def fail(self, *args, **kwargs):
            raise OSError('TEST_private_host')
        fake_probe.connect = fail
    elif scenario == 'auth_rejected':
        fake_probe.connect = lambda self, *a, **k: self.on_connect(self, None, None, 5)
        fake_probe.loop_start = lambda self: None
    client = TestClient(server.app, base_url=BASE_URL, raise_server_exceptions=False)
    response = client.post('/api/smartshunt/probe')
    assert response.status_code == 200, f'{scenario}: {response.status_code} {response.text}'
    data = response.json()
    assert data['passed'] is (scenario == 'success') and data['read_only'] is True
    assert data['checks'], f'{scenario}: explanatory checks required'
    assert 'TEST_private_host' not in str(data)