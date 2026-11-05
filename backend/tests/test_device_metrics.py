# Unified device metrics: public live contract and Ahoy MQTT nominal-power parsing.
import copy
import math
import os
import time

import pytest
import requests
import mqtt_client as mc

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')


def live():
    response = requests.get(f'{BASE_URL}/api/live', timeout=30)
    assert response.status_code == 200, response.text
    return response.json()


def test_demo_nominal_and_live_balance():
    data = live()
    assert isinstance(data['demo_mode'], bool)
    if data['demo_mode']:
        assert data['ahoy']['max_power_w'] == 1500
        assert data['trucki']['max_power_w'] == 800
    s = data['summary']
    assert s['pv_power'] == pytest.approx(s['pv_ac_power'] + s['pv_dc_power'], abs=0.11)
    assert s['battery_power'] == pytest.approx(s['battery_charge_w'] - s['battery_discharge_w'], abs=0.11)
    assert s['grid_power'] == data['shelly']['total_power']
    assert s['battery_soc'] == data['trucki']['soc']
    assert all(math.isfinite(s[k]) for k in ('pv_power', 'grid_power', 'battery_power'))


def test_live_poll_timestamp_updates():
    first = live()
    time.sleep(3.1)
    second = live()
    assert second['timestamp'] > first['timestamp']
    assert isinstance(second['victron']['mppts'], list)


@pytest.mark.parametrize('max_value,expected', [(1500, 1500), ('1450.5', 1450.5), (None, None), (0, None), (-50, None)])
def test_ahoy_mqtt_max_power(max_value, expected):
    previous = copy.deepcopy(mc._mqtt_data['ahoy'])
    try:
        total = {'P_AC': 656.1}
        if max_value is not None:
            total['MaxPower'] = max_value
        mc._mqtt_data['ahoy'] = {'raw': {'HM1500/total': total, 'HM1500/available': 1}, '_ts': None}
        parsed = mc.fetch_ahoy_from_mqtt()
        assert parsed['max_power_w'] == expected
        assert parsed['total_power'] == 656.1
        assert parsed['online'] is True
    finally:
        mc._mqtt_data['ahoy'] = previous