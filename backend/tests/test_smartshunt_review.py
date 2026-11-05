"""SmartShunt public API contracts and adversarial read-only telemetry freshness regression."""
import copy
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
import mqtt_client as mc
import smartshunt as ss
from test_smartshunt import raw_state

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')


def get(path, **params):
    response = requests.get(f'{BASE_URL}/api/{path}', params=params, timeout=25)
    assert response.status_code == 200, response.text
    return response.json()


def test_public_preview_full_contract():
    data = get('smartshunt/preview')
    assert data['preview'] is True and data['read_only'] is True
    state = data['current']
    assert state['instance'] == 290 and state['read_only'] is True
    assert state['identity']['valid'] is True
    assert state['status'] == 'current' and state['demo'] is True
    assert state['device_history']['charge_cycles'] == state['raw']['History/ChargeCycles']
    assert len(data['diagnostics']['checks']) == 7
    assert isinstance(data['events'], list)
    assert '"_id"' not in str(data).replace("'", '"')


@pytest.mark.parametrize('range_name', ['1h', '3h', '6h', '12h', '24h'])
def test_public_history_ranges(range_name):
    data = get('smartshunt/history', range=range_name)
    assert data['range'] == range_name and data['demo'] is True
    points = data['points']
    assert len(points) == 96
    times = [datetime.fromisoformat(p['ts']) for p in points]
    assert times == sorted(times)
    assert (times[-1] - times[0]).total_seconds() == int(range_name[:-1]) * 3600
    assert all(isinstance(p['voltage_v'], float) and p['status'] == 'current' and '_id' not in p for p in points)


def test_public_history_invalid_range_fallback():
    data = get('smartshunt/history', range='bad')
    assert data['range'] == '6h' and len(data['points']) == 96


def test_public_trucki_demo_control_unchanged():
    if get('config')['demo_mode'] is not True:
        pytest.skip('Do not send physical control commands')
    response = requests.post(f'{BASE_URL}/api/control/trucki', json={'action':'limit','value':123}, timeout=25)
    assert response.status_code == 200
    data = response.json()
    assert data['ok'] is True and data['demo'] is True
    assert data['response']['action'] == 'limit' and data['response']['value'] == 123


def test_wrong_connection_and_missing_connected():
    now = datetime.now(timezone.utc)
    for patch in [{'Mgmt/Connection':'Bluetooth'}, {'Connected':None}]:
        state = ss.build_smartshunt_state(raw_state(now, **patch), now=now)
        assert state['status'] == 'unavailable' and state['power_w'] is None


def test_connected_zero_not_fully_verified_identity():
    now = datetime.now(timezone.utc)
    state = ss.build_smartshunt_state(raw_state(now, Connected=0), now=now)
    assert state['identity']['valid'] is False, 'Connected is required by the full identity verification'


def test_identity_messages_are_not_measurement_freshness():
    now = datetime.now(timezone.utc)
    raw = raw_state(now)
    raw.pop('_telemetry_ts')
    for key in ss.TELEMETRY_PATHS:
        raw.pop(key, None)
    state = ss.build_smartshunt_state(raw, now=now)
    assert state['status'] == 'unavailable', 'Identity-only _ts must not qualify as valid telemetry'


def test_invalid_telemetry_does_not_refresh_old_measurements():
    saved = copy.deepcopy(mc._mqtt_data['victron']['batteries'])
    try:
        old = (datetime.now(timezone.utc) - timedelta(seconds=240)).isoformat()
        mc._mqtt_data['victron']['batteries'] = {290:raw_state(datetime.now(timezone.utc), _telemetry_ts=old)}
        mc._dispatch_mqtt_message('N/portal/battery/290/Soc', b'{"value":null}')
        raw = mc._mqtt_data['victron']['batteries'][290]
        state = ss.build_smartshunt_state(raw)
        assert state['status'] == 'unavailable', 'A null sensor payload must not revive old voltage/current/power'
    finally:
        mc._mqtt_data['victron']['batteries'] = saved


def test_unavailable_optional_sensors_not_live_measurements():
    now = datetime.now(timezone.utc)
    state = ss.build_smartshunt_state(raw_state(now, Connected=0, **{'Dc/0/Temperature':24.5}), now=now)
    assert state['optional'] == {}, 'Disconnected optional sensors must not remain valid-looking live readings'


def test_nontelemetry_messages_do_not_reset_existing_age():
    saved = copy.deepcopy(mc._mqtt_data['victron']['batteries'])
    try:
        old = (datetime.now(timezone.utc) - timedelta(seconds=181)).isoformat()
        mc._mqtt_data['victron']['batteries'] = {290:raw_state(datetime.now(timezone.utc), _telemetry_ts=old)}
        mc._dispatch_mqtt_message('N/portal/battery/290/History/ChargeCycles', b'{"value":207}')
        raw = mc._mqtt_data['victron']['batteries'][290]
        assert raw['_telemetry_ts'] == old
        assert ss.build_smartshunt_state(raw)['status'] == 'unavailable'
    finally:
        mc._mqtt_data['victron']['batteries'] = saved


def test_mqtt_parser_json_and_instance_separation():
    saved = copy.deepcopy(mc._mqtt_data['victron']['batteries'])
    try:
        mc._mqtt_data['victron']['batteries'] = {}
        mc._dispatch_mqtt_message('N/portal/battery/290/Dc/0/Current', b'{"value":-3.2}')
        mc._dispatch_mqtt_message('N/portal/battery/291/Dc/0/Current', b'{"value":8}')
        assert mc._mqtt_data['victron']['batteries'][290]['Dc/0/Current'] == -3.2
        assert mc._mqtt_data['victron']['batteries'][291]['Dc/0/Current'] == 8
    finally:
        mc._mqtt_data['victron']['batteries'] = saved