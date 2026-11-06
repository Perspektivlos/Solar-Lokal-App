"""Phase2 acceptance: native alarms, independent coverage and unique source cadence; isolated fake DB only."""
import asyncio
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone
import pytest
import server
import phase2_routes
from phase2 import summarize_phase2_points, evaluate_phase2_battery_alarms


def test_nested_threshold_severity_preserves_native_alerts():
    native = {'code': 'native_alarm', 'label': 'TEST_native', 'severity': 'critical'}
    alarms = evaluate_phase2_battery_alarms(
        {'status':'current','voltage_v':44,'soc_pct':5,'alerts':[native]},
        {'battery_voltage':{'under':48,'under_crit':46},'battery_soc':{'under':15,'under_crit':8}})
    by_code = {a['code']:a for a in alarms}
    assert by_code['native_alarm'] == native
    assert by_code['smartshunt_voltage_low']['severity'] == 'critical'
    assert by_code['smartshunt_soc_low']['severity'] == 'critical'


def test_missing_dc_keeps_ac_coverage_independent():
    start = datetime.now(timezone.utc)
    points = [{'ts':(start+timedelta(seconds=i)).isoformat(),'battery_dc_power_w':None,'inverter_ac_power_w':900} for i in [0,300]]
    totals = summarize_phase2_points(points)
    assert totals['battery_dc_measured_duration_s'] == 0
    assert totals['battery_dc_measurement_available'] is False
    assert totals['inverter_ac_measurement_available'] is True
    assert totals['inverter_ac_output_kwh'] == .075


def test_unique_dc_samples_integrate_across_duplicate_poll_rows(monkeypatch):
    start = datetime.now(timezone.utc).replace(microsecond=0)
    rows = [{'ts':(start+timedelta(seconds=i)).isoformat(),'smartshunt_status':'current',
             'smartshunt_received_at':(start+timedelta(seconds=source)).isoformat(),
             'smartshunt_dc_power_w':-1000,'trucki_ac_output_w':900} for i,source in [(0,0),(15,0),(30,30)]]
    class Cursor:
        def find(self,*args): return self
        def sort(self,*args): return self
        def limit(self,*args): return self
        async def to_list(self,*args): return rows
    monkeypatch.setattr(phase2_routes,'db',SimpleNamespace(snapshots=Cursor()))
    points = asyncio.run(phase2_routes._history_points('1h',False))
    totals = summarize_phase2_points(points)
    assert points[1]['battery_dc_power_w'] is None
    assert totals['inverter_ac_output_kwh'] == .007
    assert totals['battery_dc_discharge_kwh'] == pytest.approx(.008,abs=.001), totals
    assert totals['battery_dc_measured_duration_s'] == 30