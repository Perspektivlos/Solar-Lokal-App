"""Tests für die Energiebilanz-Umrechnung (routes._rows_to_balance)."""
import server  # noqa: F401  (löst späte Bindung, verhindert Zirkularimport beim direkten routes-Import)
import routes


def test_rows_to_balance_kwh_conversion():
    # 240 Samples à 15s = 3600s = 1h. Bei konstant 1000W -> 1 kWh.
    rows = [{"_id": "2026-06-08", "pv": 1000 * 240, "imp": 0, "exp": 500 * 240, "n": 240}]
    out = routes._rows_to_balance(rows)
    assert out[0]["pv_kwh"] == 1.0
    assert out[0]["export_kwh"] == 0.5
    # Eigenverbrauch = PV - Einspeisung
    assert out[0]["self_kwh"] == 0.5
    assert out[0]["period"] == "2026-06-08"


def test_self_consumption_never_negative():
    rows = [{"_id": "2026-06-08", "pv": 100, "imp": 0, "exp": 1000 * 240, "n": 240}]
    out = routes._rows_to_balance(rows)
    assert out[0]["self_kwh"] == 0.0


def test_empty_rows():
    assert routes._rows_to_balance([]) == []
