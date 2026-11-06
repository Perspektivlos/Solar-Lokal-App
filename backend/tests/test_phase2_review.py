"""Phase2 public contracts and missing-data integration regressions; no production mutations."""
import os
import asyncio
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone
import pytest
import requests
import server  # Establish the application's intentional late-bound route imports first.
from phase2 import summarize_phase2_points
from phase2_routes import Phase2LiveResponse, Phase2HistoryResponse, Phase2TodayResponse

BASE = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')

def get(path, **params):
    response = requests.get(f'{BASE}/api/{path}', params=params, timeout=30)
    assert response.status_code == 200, response.text
    data = response.json()
    assert '"_id"' not in response.text
    return data

def test_live_typed_sources_and_house_balance():
    data = get('smartshunt-phase2/live')
    Phase2LiveResponse.model_validate(data)
    assert data['battery_dc']['source'] == 'smartshunt'
    assert data['battery_dc']['power_w'] == data['smartshunt']['power_w']
    assert data['battery_dc']['soc_pct'] == data['smartshunt']['soc_pct']
    assert data['inverter_ac']['output_w'] == max(0, data['trucki']['ac_display_w'])
    house = max(0, data['ahoy']['total_power'] + max(0, -data['trucki']['battery_power']) + data['shelly']['total_power'])
    assert data['summary']['house_power'] == round(house, 1)

@pytest.mark.parametrize('span', ['1h','3h','6h','12h','24h'])
def test_all_history_ranges(span):
    data = get('smartshunt-phase2/history', range=span)
    Phase2HistoryResponse.model_validate(data)
    assert data['range'] == span
    points = data['points']
    assert len(points) > 1
    assert all(a['ts'] < b['ts'] for a,b in zip(points,points[1:]))
    assert all(isinstance(p['battery_dc_power_w'], (float,int)) and isinstance(p['inverter_ac_power_w'],(float,int)) for p in points)

def test_today_typed_domains():
    data = get('smartshunt-phase2/today')
    Phase2TodayResponse.model_validate(data)
    assert data['sample_count'] > 1
    assert data['measured_duration_s'] > 0
    assert data['battery_dc_charge_kwh'] >= 0
    assert data['battery_dc_discharge_kwh'] >= 0
    assert data['inverter_ac_output_kwh'] >= 0

def point(seconds, power=None):
    return {'ts': (datetime(2026,1,1,tzinfo=timezone.utc)+timedelta(seconds=seconds)).isoformat(),
            'status':'unavailable' if power is None else 'current',
            'battery_dc_power_w':power,'inverter_ac_power_w':900}

def test_no_measurement_is_not_reported_as_available_zero_dc():
    result = summarize_phase2_points([point(0), point(300)])
    assert result.get('battery_dc_measurement_available', result['measurement_available']) is False, result

def test_missing_dc_endpoint_does_not_integrate_as_zero_power():
    result = summarize_phase2_points([point(0,-1000), point(300)])
    assert result['battery_dc_discharge_kwh'] == 0, result

def test_regression_public_main_live():
    data = get('live')
    assert data['phase2']['summary']['house_power'] == data['summary']['house_power']
    assert isinstance(data['trucki']['zepc'], bool)

def test_today_must_not_integrate_decimated_chart_points(monkeypatch):
    import phase2_routes
    rows = [{'ts':point(i*15)['ts'],'smartshunt_status':'current',
             'smartshunt_dc_power_w':1000 if i%9==0 else 0} for i in range(5760)]
    class Cursor:
        def find(self,*args): return self
        def sort(self,*args): return self
        def limit(self,*args): return self
        async def to_list(self,*args):return rows
    monkeypatch.setattr(phase2_routes,'db',SimpleNamespace(snapshots=Cursor()))
    sampled=asyncio.run(phase2_routes._history_points('24h',False))
    raw=[{'ts':r['ts'],'battery_dc_power_w':r['smartshunt_dc_power_w']} for r in rows]
    actual=summarize_phase2_points(sampled)['battery_dc_charge_kwh']
    expected=summarize_phase2_points(raw)['battery_dc_charge_kwh']
    assert actual == pytest.approx(expected,abs=0.001), (actual,expected)

def test_poller_does_not_reintegrate_same_source_measurement(monkeypatch):
    from test_phase2_smartshunt import source_data
    from phase2 import build_phase2_model
    data=source_data()
    data.update(timestamp=point(0)['ts'],demo_mode=False)
    data['summary'].update(battery_charge_w=0,battery_discharge_w=777)
    data['phase2']=build_phase2_model(data)
    captured=[]
    async def insert(row):captured.append(row)
    async def cfg():return {'alarms':{'enabled':False},'retention':{'enabled':False}}
    async def collect(_):
        data['timestamp']=point(len(captured)*15)['ts']
        return data
    async def noop(*args,**kwargs):pass
    async def stop(_):
        if len(captured)>=2:raise asyncio.CancelledError()
    monkeypatch.setattr(server,'db',SimpleNamespace(snapshots=SimpleNamespace(insert_one=insert)))
    monkeypatch.setattr(server,'get_config',cfg)
    monkeypatch.setattr(server,'collect_live',collect)
    monkeypatch.setattr(server,'_persist_smartshunt',noop)
    monkeypatch.setattr(server,'_log_alarm_transitions',noop)
    monkeypatch.setattr(server,'_influx_state',{'write_api':None})
    monkeypatch.setattr(server,'_poller_state',{'running':False,'count':0})
    monkeypatch.setattr(server.asyncio,'sleep',stop)
    with pytest.raises(asyncio.CancelledError):asyncio.run(server.poller_loop())
    assert captured[0]['smartshunt_received_at']==captured[1]['smartshunt_received_at']
    assert captured[1]['smartshunt_dc_power_w'] is None, captured

def test_phase2_route_honors_configured_battery_alarm_thresholds(monkeypatch):
    import phase2_routes
    from test_phase2_smartshunt import source_data
    from phase2 import build_phase2_model
    data=source_data()
    data['smartshunt'].update(voltage_v=44,soc_pct=5)
    data.update(timestamp=point(0)['ts'],demo_mode=False,phase2=build_phase2_model(data))
    async def cfg():return {'alarms':{'enabled':True,'battery_voltage':{'under':48,'under_crit':46},'battery_soc':{'under':15}}}
    async def collect(_):return data
    monkeypatch.setattr(phase2_routes,'get_config',cfg)
    monkeypatch.setattr(phase2_routes,'collect_live',collect)
    response=asyncio.run(phase2_routes.phase2_live())
    assert {'smartshunt_voltage_low','smartshunt_soc_low'} <= {a['code'] for a in response.alarms}, response.alarms