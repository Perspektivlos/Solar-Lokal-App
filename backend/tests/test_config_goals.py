"""Tests for the new goals.autarky_pct configuration field and related regressions."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://solar-control-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # Final cleanup: reset goal back to 70 per request
    try:
        s.put(f"{API}/config", json={"goals": {"autarky_pct": 70}}, timeout=10)
    except Exception:
        pass


# --- /api/config goals defaults ---
def test_get_config_has_goals_default(session):
    r = session.get(f"{API}/config", timeout=10)
    assert r.status_code == 200
    cfg = r.json()
    assert "goals" in cfg and isinstance(cfg["goals"], dict)
    assert "autarky_pct" in cfg["goals"]
    assert isinstance(cfg["goals"]["autarky_pct"], (int, float))


# --- PUT /api/config persists goal ---
def test_put_config_goal_persists(session):
    # Set to 80
    r = session.put(f"{API}/config", json={"goals": {"autarky_pct": 80}}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["goals"]["autarky_pct"] == 80

    # Verify via GET
    r2 = session.get(f"{API}/config", timeout=10)
    assert r2.status_code == 200
    assert r2.json()["goals"]["autarky_pct"] == 80

    # Reset to 70
    r3 = session.put(f"{API}/config", json={"goals": {"autarky_pct": 70}}, timeout=10)
    assert r3.status_code == 200
    assert r3.json()["goals"]["autarky_pct"] == 70

    r4 = session.get(f"{API}/config", timeout=10)
    assert r4.json()["goals"]["autarky_pct"] == 70


# --- PUT goals only must not wipe other config keys ---
def test_put_goals_only_preserves_other_keys(session):
    before = session.get(f"{API}/config", timeout=10).json()
    r = session.put(f"{API}/config", json={"goals": {"autarky_pct": 75}}, timeout=10)
    assert r.status_code == 200
    after = r.json()
    # other top-level keys must remain intact
    for key in ["demo_mode", "devices", "mqtt", "influx", "victron_mqtt", "forecast"]:
        assert key in after, f"{key} missing after PUT goals-only"
        assert after[key] == before[key], f"{key} unexpectedly changed by goals-only PUT"
    # reset
    session.put(f"{API}/config", json={"goals": {"autarky_pct": 70}}, timeout=10)


# --- Regression: /api/live still returns distinct grid vs battery in demo mode ---
def test_live_grid_battery_distinct(session):
    r = session.get(f"{API}/live", timeout=10)
    assert r.status_code == 200
    summary = r.json()["summary"]
    assert summary["grid_power"] != summary["battery_power"]


# --- Regression: history & forecast still respond ---
def test_history_ok(session):
    r = session.get(f"{API}/history?range=1h", timeout=10)
    assert r.status_code == 200
    assert "points" in r.json()


def test_today_endpoint_has_autarky_pct(session):
    r = session.get(f"{API}/today", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "autarky_pct" in j
