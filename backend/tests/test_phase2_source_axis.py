"""DC source-axis acceptance: isolated points only; no DB or hardware mutations."""
from datetime import datetime, timedelta, timezone
import pytest
from phase2 import summarize_phase2_points


def point(poll, source, value=-1000, status='current'):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        'ts': (start + timedelta(seconds=poll)).isoformat(),
        'battery_source_ts': (start + timedelta(seconds=source)).isoformat(),
        'status': status, 'battery_dc_power_w': value,
        'inverter_ac_power_w': 900, 'pv_ac_power_w': 600,
        'pv_dc_power_w': 1200, 'house_ac_power_w': 1500, 'grid_power_w': -300,
    }


@pytest.mark.parametrize('value', [None, -1000])
def test_current_same_source_duplicates_preserve_unique_interval(value):
    result = summarize_phase2_points([point(0, 0), point(15, 0, value), point(30, 30)])
    assert result['battery_dc_discharge_kwh'] == .008
    assert result['battery_dc_measured_duration_s'] == 30
    assert result['inverter_ac_output_kwh'] == .007
    assert result['pv_ac_kwh'] == .005
    assert result['mppt_dc_kwh'] == .010
    assert result['house_ac_kwh'] == .013
    assert result['grid_export_kwh'] == .003


@pytest.mark.parametrize('status,source,value', [
    ('unavailable', 0, None), ('stale', 0, -1000),
    ('current', 15, None), ('unavailable', 15, None), ('stale', 15, -1000),
])
def test_real_dc_barriers_are_not_bridged(status, source, value):
    result = summarize_phase2_points([
        point(0, 0), point(15, source, value, status), point(30, 30), point(60, 60),
    ])
    assert result['battery_dc_discharge_kwh'] == .008
    assert result['battery_dc_measured_duration_s'] == 30
    assert result['inverter_ac_output_kwh'] == .015


@pytest.mark.parametrize('source_gap,expected_duration', [(600, 600), (601, 0)])
def test_source_gap_limit_not_poll_gap(source_gap, expected_duration):
    result = summarize_phase2_points([point(0, 0), point(15, source_gap)])
    assert result['battery_dc_measured_duration_s'] == expected_duration
    assert result['battery_dc_discharge_kwh'] == round(expected_duration/3600, 3)
    assert result['inverter_ac_output_kwh'] == .004


def test_source_interval_not_independent_poll_interval():
    result = summarize_phase2_points([point(0, 0), point(15, 0, None), point(30, 60)])
    assert result['battery_dc_discharge_kwh'] == .017
    assert result['battery_dc_measured_duration_s'] == 60
    assert result['inverter_ac_output_kwh'] == .007