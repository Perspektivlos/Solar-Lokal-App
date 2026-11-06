# Kanonische Umschaltung auf SmartShunt: /api/today additiv, /api/history ohne erfundene Nullwerte.
import ast
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

import pytest

from phase2 import summarize_phase2_points

HELPERS = {'_safe_power', '_charge_w', '_discharge_w', '_flow_components', '_summarize_energy_rows',
           '_phase2_points_from_rows', '_apply_smartshunt_history'}
CONSTANTS = {'_PHASE2_LEGACY_KEYS', '_SMARTSHUNT_VALUE_KEYS'}


def load(rows=None):
    class Cursor:
        def find(self, *args): return self
        def sort(self, *args): return self
        def limit(self, *args): return self
        async def to_list(self, *args): return rows
    tree = ast.parse((Path(__file__).parents[1] / 'routes.py').read_text())
    body = [n for n in tree.body if (isinstance(n, ast.FunctionDef) and n.name in HELPERS)
            or (isinstance(n, ast.Assign) and any(getattr(t, 'id', None) in CONSTANTS for t in n.targets))]
    history = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'history')
    history.decorator_list = []
    ns = dict(datetime=datetime, timezone=timezone, timedelta=timedelta, Dict=Dict, List=List, Any=Any,
              Optional=Optional, MAX_ENERGY_GAP_SECONDS=600, summarize_phase2_points=summarize_phase2_points,
              db=SimpleNamespace(snapshots=Cursor()))
    exec(compile(ast.fix_missing_locations(ast.Module(body=body + [history], type_ignores=[])), 'routes.py', 'exec'), ns)
    return ns


START = datetime(2026, 11, 6, 0, 0, tzinfo=timezone.utc)


def at(sec):
    return (START + timedelta(seconds=sec)).isoformat()


def snap(sec, grid=0.0, trucki_batt=-100.0, status='current', received=None, dc=None, soc=None):
    ts = (START + timedelta(seconds=sec)).isoformat()
    return {'ts': ts, 'pv_power': 0, 'house_power': 300, 'grid_power': grid, 'battery_power': trucki_batt,
            'battery_charge_w': max(0, trucki_batt), 'battery_discharge_w': max(0, -trucki_batt),
            'battery_soc': 50, 'phase2_source': 'smartshunt', 'smartshunt_status': status,
            'smartshunt_received_at': received, 'smartshunt_dc_power_w': dc,
            'smartshunt_voltage_v': 52.0 if dc is not None else None,
            'smartshunt_current_a': (dc / 52.0) if dc is not None else None,
            'smartshunt_soc_pct': soc, 'trucki_ac_output_w': 250, 'house_ac_power_w': 300}


def test_today_keeps_legacy_grid_semantics_and_adds_dc_fields():
    # Legacy-Netzintegration zählt fehlende Werte als 0; Phase 2 würde sie auslassen.
    rows = [snap(0, grid=1000, received=at(0), dc=-200, soc=70),
            snap(60, grid=None, received=at(0)),
            snap(120, grid=1000, received=at(120), dc=-200, soc=70)]
    out = load()['_summarize_energy_rows'](rows)
    legacy = {k: out[k] for k in ('grid_import_kwh', 'measurement_available', 'sample_count', 'measured_duration_s')}
    assert legacy == {'grid_import_kwh': pytest.approx(0.017, abs=0.001), 'measurement_available': True,
                      'sample_count': 3, 'measured_duration_s': 120.0}
    assert out['phase2_measurement_available'] is True
    assert out['battery_dc_measurement_available'] is True
    assert out['battery_dc_discharge_kwh'] == pytest.approx(200 * 120 / 3600 / 1000, abs=0.001)
    assert out['battery_dc_charge_kwh'] == 0


def test_today_counts_repeated_smartshunt_measurement_once():
    rows = [snap(0, received=at(0), dc=-600, soc=70), snap(60, received=at(0), dc=-600, soc=70),
            snap(120, received=at(120), dc=-600, soc=70)]
    out = load()['_summarize_energy_rows'](rows)
    # Messung 'a' doppelt gespeichert -> zählt nur 0..120 s einmal
    assert out['battery_dc_discharge_kwh'] == pytest.approx(600 * 120 / 3600 / 1000, abs=0.001)
    assert out['battery_dc_measured_duration_s'] == 120.0


def test_history_repeats_same_current_measurement_and_breaks_on_unavailable():
    rows = [snap(0, received=at(0), dc=-200, soc=73),
            snap(5, received=at(0)),                       # Poller schneller als SmartShunt
            snap(10, status='stale', received=at(0)),      # nicht mehr aktuell -> Lücke
            snap(15, status='unavailable', received=None),
            snap(20, received=at(20), dc=150, soc=74)]
    ns = load(rows[::-1])  # DB liefert neueste zuerst (sort ts -1)
    points = asyncio.run(ns['history']('1h'))['points']
    assert [p['battery_power'] for p in points] == [-200, -200, None, None, 150]
    assert [p['battery_soc'] for p in points] == [73, 73, None, None, 74]
    assert all(p['battery_source'] == 'smartshunt' for p in points)
    assert [p['legacy_battery_power'] for p in points] == [-100.0] * 5


def test_history_leaves_pre_phase2_rows_untouched():
    row = snap(0)
    row.pop('phase2_source')
    points = asyncio.run(load([row])['history']('1h'))['points']
    assert points[0]['battery_power'] == -100.0 and 'battery_source' not in points[0]
