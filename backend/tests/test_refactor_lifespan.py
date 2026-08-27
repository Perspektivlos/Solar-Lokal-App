"""Regression tests for the server.py refactor (mocks.py / influx_points.py extraction
and the migration from @app.on_event to the FastAPI lifespan contextmanager).

Scope:
  - lifespan starts background poller (count increases, running == true)
  - module extraction parity: server re-exports pure functions, identical objects
  - endpoint contract sanity after refactor (live/config/today/history/control/diagnostics)
"""
import os
import time

import pytest
import requests
from dotenv import dotenv_values

_frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or _frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing in env and /app/frontend/.env")
API = f"{_base.rstrip('/')}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- module extraction parity (pure functions) ----------
class TestModuleExtraction:
    def test_server_reexports_mock_functions(self):
        import mocks
        import server
        for name in ("_sun_curve", "mock_shelly", "mock_ahoy", "mock_trucki", "mock_victron"):
            assert getattr(server, name) is getattr(mocks, name), f"{name} not identical"

    def test_server_reexports_influx_builders(self):
        import influx_points
        import server
        for name in ("_instant_ratios", "_pt_solar", "_pts_shelly", "_pts_hoymiles",
                     "_pts_victron", "_pt_trucki", "_build_influx_points"):
            assert getattr(server, name) is getattr(influx_points, name), f"{name} not identical"

    def test_collectors_module_exists_and_exports(self):
        import collectors
        for name in ("collect_live", "fetch_shelly", "fetch_ahoy", "fetch_trucki",
                     "fetch_victron", "_http_get"):
            assert callable(getattr(collectors, name)), f"{name} missing from collectors"

    def test_collect_live_imported_in_server(self):
        import server
        import collectors
        assert server.collect_live is collectors.collect_live

    def test_no_legacy_on_event_hooks(self):
        import server
        src = open(server.__file__.replace(".pyc", ".py")).read()
        assert "on_event" not in src, "legacy @app.on_event still present"
        assert server.app.router.lifespan_context is not None

    def test_mocks_are_pure_and_bounded(self):
        import mocks
        t = mocks.mock_trucki()
        assert 5 <= t["soc"] <= 98
        assert t["battery_power"] <= 0  # DC-coupled: discharge only
        s = mocks.mock_shelly()
        assert len(s["phases"]) == 3
        assert round(sum(p["power"] for p in s["phases"]), 1) == pytest.approx(s["total_power"], abs=0.3)
        a = mocks.mock_ahoy()
        assert len(a["channels"]) == 4
        v = mocks.mock_victron()
        assert len(v["mppts"]) == 2


# ---------- lifespan background tasks ----------
class TestLifespanPoller:
    def test_poller_running_and_count_increases(self, client):
        r1 = client.get(f"{API}/integrations/status", timeout=30)
        assert r1.status_code == 200
        p1 = r1.json()["poller"]
        assert p1["running"] is True
        assert isinstance(p1["count"], int)

        time.sleep(35)  # poller interval is ~30s in demo mode
        r2 = client.get(f"{API}/integrations/status", timeout=30)
        assert r2.status_code == 200
        p2 = r2.json()["poller"]
        assert p2["count"] > p1["count"], f"poller count did not grow: {p1['count']} -> {p2['count']}"
        assert p2["last_write"] is not None

    def test_status_has_all_sections(self, client):
        data = client.get(f"{API}/integrations/status", timeout=30).json()
        for key in ("mqtt", "influx", "poller"):
            assert key in data
        assert set(("connected", "last_error")).issubset(data["mqtt"].keys())
        assert set(("connected", "last_error")).issubset(data["influx"].keys())


# ---------- endpoint contracts after refactor ----------
class TestEndpointContracts:
    def test_live_summary_contract(self, client):
        r = client.get(f"{API}/live", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("shelly", "ahoy", "trucki", "victron", "summary"):
            assert k in d
        s = d["summary"]
        for k in ("pv_power", "grid_power", "battery_power", "battery_charge_w",
                  "battery_discharge_w", "house_power", "battery_soc"):
            assert k in s, f"missing summary field {k}"
            assert isinstance(s[k], (int, float))
        assert s["battery_charge_w"] >= 0 and s["battery_discharge_w"] >= 0

    def test_config_nested_keys_and_partial_put(self, client):
        r = client.get(f"{API}/config", timeout=30)
        assert r.status_code == 200
        cfg = r.json()
        for k in ("devices", "mqtt", "influx", "victron_mqtt"):
            assert k in cfg, f"missing config section {k}"
        original_port = cfg["mqtt"]["port"]

        put = client.put(f"{API}/config", json={"mqtt": {"port": 1884}}, timeout=30)
        assert put.status_code == 200
        after = client.get(f"{API}/config", timeout=30).json()
        assert after["mqtt"]["port"] == 1884
        # other sections must survive a partial update
        for k in ("devices", "influx", "victron_mqtt"):
            assert k in after
        assert after["devices"] == cfg["devices"]

        restore = client.put(f"{API}/config", json={"mqtt": {"port": original_port}}, timeout=30)
        assert restore.status_code == 200
        assert client.get(f"{API}/config", timeout=30).json()["mqtt"]["port"] == original_port

    def test_today_contract(self, client):
        r = client.get(f"{API}/today", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("pv_kwh", "consumption_kwh", "grid_import_kwh", "grid_export_kwh",
                  "autarky_pct", "self_consumption_pct", "battery_charge_kwh",
                  "battery_discharge_kwh", "round_trip_pct"):
            assert k in d, f"missing today field {k}"
            assert isinstance(d[k], (int, float))
        for k in ("autarky_pct", "self_consumption_pct", "round_trip_pct"):
            assert 0 <= d[k] <= 100, f"{k} out of range: {d[k]}"

    @pytest.mark.parametrize("rng", ["1h", "24h"])
    def test_history_points(self, client, rng):
        r = client.get(f"{API}/history", params={"range": rng}, timeout=40)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("points"), list)

    def test_control_endpoints(self, client):
        r1 = client.post(f"{API}/control/hoymiles", json={"action": "limit", "value": 80}, timeout=30)
        assert r1.status_code == 200
        assert r1.json().get("ok") is True
        r2 = client.post(f"{API}/control/trucki", json={"action": "zepc_on"}, timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("ok") is True
        bad = client.post(f"{API}/control/hoymiles", json={}, timeout=30)
        assert bad.status_code == 422

    def test_diagnostics(self, client):
        r = client.post(f"{API}/diagnostics/run", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("tests"), list) and len(d["tests"]) > 0
        assert d["summary"]["total"] == len(d["tests"])
        names = [t["name"] for t in d["tests"]]
        assert "Snapshot-Poller" in names
        poller_check = next(t for t in d["tests"] if t["name"] == "Snapshot-Poller")
        assert poller_check["ok"] is True, f"poller diagnostic failed: {poller_check}"
        raw = client.get(f"{API}/diagnostics/raw", timeout=40)
        assert raw.status_code == 200
        assert isinstance(raw.json(), dict)

    def test_no_mongo_object_id_leak(self, client):
        for path in ("/live", "/config", "/today", "/integrations/status"):
            body = client.get(f"{API}{path}", timeout=30).text
            assert '"_id"' not in body, f"_id leaked in {path}"
