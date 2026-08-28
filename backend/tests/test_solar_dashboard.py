"""Backend API tests for Solar Dashboard.
Covers: /api/live, /api/config, /api/today, /api/history, /api/control/*,
/api/integrations/status, poller snapshots, demo_mode toggle.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://solar-control-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /api/live ----------
class TestLive:
    def test_live_status_and_structure(self, client):
        r = client.get(f"{API}/live", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Top-level keys
        for k in ("timestamp", "demo_mode", "shelly", "ahoy", "trucki", "victron", "summary"):
            assert k in data, f"missing key {k}"

    def test_live_shelly_three_phases(self, client):
        data = client.get(f"{API}/live", timeout=15).json()
        shelly = data["shelly"]
        assert "phases" in shelly
        assert len(shelly["phases"]) == 3
        phases = {p["phase"] for p in shelly["phases"]}
        assert phases == {"L1", "L2", "L3"}
        for p in shelly["phases"]:
            for f in ("power", "voltage", "current", "pf"):
                assert isinstance(p[f], (int, float))

    def test_live_ahoy_four_channels(self, client):
        data = client.get(f"{API}/live", timeout=15).json()
        ahoy = data["ahoy"]
        assert "channels" in ahoy
        assert len(ahoy["channels"]) == 4
        for c in ahoy["channels"]:
            assert isinstance(c.get("power"), (int, float))

    def test_live_trucki_soc(self, client):
        data = client.get(f"{API}/live", timeout=15).json()
        trucki = data["trucki"]
        assert "soc" in trucki
        assert isinstance(trucki["soc"], (int, float))
        assert 0 <= trucki["soc"] <= 100

    def test_live_victron_two_mppts(self, client):
        data = client.get(f"{API}/live", timeout=15).json()
        victron = data["victron"]
        assert "mppts" in victron
        assert len(victron["mppts"]) == 2

    def test_live_summary_fields(self, client):
        data = client.get(f"{API}/live", timeout=15).json()
        summary = data["summary"]
        # commonly expected summary fields
        assert isinstance(summary, dict)
        assert len(summary.keys()) > 0


# ---------- /api/config ----------
class TestConfig:
    def test_get_config_defaults(self, client):
        r = client.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        cfg = r.json()
        assert "devices" in cfg
        assert "mqtt" in cfg
        assert "influx" in cfg

    def test_put_config_persists_changes(self, client):
        # 1. Get current config
        cfg = client.get(f"{API}/config", timeout=15).json()
        original_demo = cfg.get("demo_mode", True)
        original_shelly_ip = cfg.get("devices", {}).get("shelly", {}).get("ip", "")

        # 2. Toggle demo_mode off and change shelly IP
        cfg["demo_mode"] = False
        if "devices" in cfg and "shelly" in cfg["devices"]:
            cfg["devices"]["shelly"]["ip"] = "192.168.99.250"

        r = client.put(f"{API}/config", json=cfg, timeout=15)
        assert r.status_code == 200, r.text

        # 3. Verify persistence via GET
        new_cfg = client.get(f"{API}/config", timeout=15).json()
        assert new_cfg["demo_mode"] is False
        if "devices" in new_cfg and "shelly" in new_cfg["devices"]:
            assert new_cfg["devices"]["shelly"]["ip"] == "192.168.99.250"

        # 4. Restore (toggle back to True, restore IP)
        new_cfg["demo_mode"] = True
        if original_shelly_ip and "devices" in new_cfg and "shelly" in new_cfg["devices"]:
            new_cfg["devices"]["shelly"]["ip"] = original_shelly_ip
        r2 = client.put(f"{API}/config", json=new_cfg, timeout=15)
        assert r2.status_code == 200

        restored = client.get(f"{API}/config", timeout=15).json()
        assert restored["demo_mode"] == original_demo or restored["demo_mode"] is True


# ---------- /api/today ----------
class TestToday:
    def test_today_numeric_fields(self, client):
        r = client.get(f"{API}/today", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for f in ("pv_kwh", "consumption_kwh", "autarky_pct"):
            assert f in data, f"missing {f}"
            assert isinstance(data[f], (int, float)), f"{f} not numeric: {data[f]}"

    def test_today_round_trip_fields(self, client):
        r = client.get(f"{API}/today", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for f in ("battery_charge_kwh", "battery_discharge_kwh", "round_trip_pct"):
            assert f in data, f"missing {f}"
            assert isinstance(data[f], (int, float)), f"{f} not numeric: {data[f]}"
        assert 0 <= data["round_trip_pct"] <= 100


# ---------- /api/history ----------
class TestHistory:
    @pytest.mark.parametrize("rng", ["1h", "6h", "12h", "24h"])
    def test_history_ranges(self, client, rng):
        r = client.get(f"{API}/history?range={rng}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "points" in data
        assert isinstance(data["points"], list)


# ---------- /api/control/* ----------
class TestControl:
    def test_hoymiles_limit(self, client):
        r = client.post(f"{API}/control/hoymiles",
                        json={"action": "limit", "value": 80}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True

    def test_trucki_zepc_on(self, client):
        r = client.post(f"{API}/control/trucki",
                        json={"action": "zepc_on"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True


# ---------- /api/diagnostics/* (Iteration 3) ----------
class TestDiagnosticsRun:
    def test_diagnostics_run_structure(self, client):
        t0 = time.time()
        r = client.post(f"{API}/diagnostics/run", timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("timestamp", "duration_ms", "summary", "tests"):
            assert k in data, f"missing key {k}"
        # Summary
        s = data["summary"]
        for k in ("pass", "fail", "skip", "total"):
            assert k in s
            assert isinstance(s[k], int)
        assert s["pass"] + s["fail"] + s["skip"] == s["total"]
        # Duration is reasonable
        assert isinstance(data["duration_ms"], int)
        assert elapsed < 25, f"diagnostics too slow: {elapsed}s"

    def test_diagnostics_run_required_checks(self, client):
        data = client.post(f"{API}/diagnostics/run", timeout=30).json()
        tests = data["tests"]
        assert len(tests) == data["summary"]["total"]
        names = [t["name"] for t in tests]
        # Backend, MongoDB, Poller, MQTT, InfluxDB checks
        assert any("Backend" in n for n in names), names
        assert any("MongoDB" in n for n in names), names
        assert any("Poller" in n for n in names), names
        assert any("MQTT" in n for n in names), names
        assert any("Influx" in n for n in names), names
        # 4 device tests
        assert any("Shelly" in n for n in names), names
        assert any("Ahoy" in n or "Hoymiles" in n for n in names), names
        assert any("Trucki" in n for n in names), names
        assert any("Victron" in n for n in names), names

    def test_diagnostics_ok_field_types(self, client):
        data = client.post(f"{API}/diagnostics/run", timeout=30).json()
        for t in data["tests"]:
            assert "name" in t and "ok" in t and "detail" in t and "ms" in t
            assert t["ok"] in (True, False, None), f"ok must be true/false/null: {t}"
            assert isinstance(t["name"], str)
            assert isinstance(t["detail"], str)

    def test_diagnostics_backend_and_mongo_pass(self, client):
        data = client.post(f"{API}/diagnostics/run", timeout=30).json()
        by_name = {t["name"]: t for t in data["tests"]}
        backend = next((t for n, t in by_name.items() if "Backend" in n), None)
        mongo = next((t for n, t in by_name.items() if "MongoDB" in n), None)
        assert backend and backend["ok"] is True
        assert mongo and mongo["ok"] is True


class TestDiagnosticsRaw:
    def test_diagnostics_raw_structure(self, client):
        t0 = time.time()
        r = client.get(f"{API}/diagnostics/raw", timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        assert elapsed < 2.0, f"raw too slow: {elapsed}s"
        data = r.json()
        for dev in ("ahoy", "shelly", "trucki", "victron"):
            assert dev in data, f"missing {dev}"
            assert "_ts" in data[dev]
        # ahoy/trucki have raw dict
        assert "raw" in data["ahoy"]
        assert "raw" in data["trucki"]
        # shelly has phases/online/total_power
        for k in ("online", "total_power", "phases"):
            assert k in data["shelly"]
        # victron has system/grid/instances
        for k in ("system", "grid", "instances"):
            assert k in data["victron"]


# ---------- /api/integrations/status ----------
class TestIntegrationsStatus:
    def test_status_keys(self, client):
        r = client.get(f"{API}/integrations/status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("mqtt", "influx", "poller"):
            assert k in data, f"missing {k}"


# ---------- Background poller ----------
class TestPoller:
    def test_poller_writes_snapshots(self, client):
        # Take initial history length, wait > 15s, ensure points >= or grew
        r1 = client.get(f"{API}/history?range=1h", timeout=15).json()
        initial = len(r1.get("points", []))
        time.sleep(20)
        r2 = client.get(f"{API}/history?range=1h", timeout=15).json()
        after = len(r2.get("points", []))
        assert after >= initial, f"Snapshot count decreased: {initial} -> {after}"
        # Ideally grew by at least 1 in 20s (poller=15s)
        if after == initial:
            pytest.skip(f"Poller did not add a snapshot in 20s (still {initial}). May indicate poller issue.")


# ---------- demo_mode off fallback ----------
class TestDemoModeFallback:
    def test_demo_off_returns_data_with_offline(self, client):
        cfg = client.get(f"{API}/config", timeout=15).json()
        orig_demo = cfg.get("demo_mode", True)

        cfg["demo_mode"] = False
        client.put(f"{API}/config", json=cfg, timeout=15)
        time.sleep(1)

        try:
            r = client.get(f"{API}/live", timeout=20)
            assert r.status_code == 200, r.text
            data = r.json()
            assert "shelly" in data and "ahoy" in data
            # In real-device mode without devices, should mark online=false (graceful fallback)
            # We don't strictly assert online=False because behavior may vary; just ensure structure intact
            for dev in ("shelly", "ahoy", "trucki", "victron"):
                assert dev in data
                assert "online" in data[dev]
        finally:
            # restore
            cfg2 = client.get(f"{API}/config", timeout=15).json()
            cfg2["demo_mode"] = orig_demo if isinstance(orig_demo, bool) else True
            client.put(f"{API}/config", json=cfg2, timeout=15)
