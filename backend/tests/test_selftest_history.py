# Self-test history: POST /api/diagnostics/run persistence + GET /api/diagnostics/history aggregation + retention (50)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _run():
    r = requests.post(f"{BASE_URL}/api/diagnostics/run", timeout=60)
    assert r.status_code == 200
    return r.json()


def _hist():
    r = requests.get(f"{BASE_URL}/api/diagnostics/history", timeout=30)
    assert r.status_code == 200
    return r.json()


class TestRun:
    def test_run_shape_no_id(self):
        d = _run()
        assert "_id" not in d
        assert set(["timestamp", "duration_ms", "summary", "tests"]) <= set(d)
        s = d["summary"]
        assert s["total"] == len(d["tests"]) == s["pass"] + s["fail"] + s["skip"]
        assert isinstance(d["duration_ms"], int)

    def test_run_persisted_newest_first(self):
        d = _run()
        h = _hist()
        assert h["keep"] == 50
        assert h["runs"][0]["timestamp"] == d["timestamp"]
        assert h["runs"][0]["summary"] == d["summary"]
        assert "_id" not in h["runs"][0] and "tests" not in h["runs"][0]
        ts = [r["timestamp"] for r in h["runs"]]
        assert ts == sorted(ts, reverse=True)


class TestHistoryAggregation:
    def test_checks_aggregation_consistent(self):
        d = _run()
        h = _hist()
        nruns = len(h["runs"])
        names = {c["name"]: c for c in h["checks"]}
        for t in d["tests"]:
            c = names[t["name"]]
            assert c["last_status"] == t["ok"]
            assert c["runs"] <= nruns
            assert 0 <= c["fails"] <= c["runs"]
            if t["ok"] is True:
                assert c["last_ok"] == d["timestamp"]
            if t["ok"] is False:
                assert c["last_fail"] == d["timestamp"]
                assert c["last_fail_detail"] == t.get("detail")
            if c["fails"] == 0:
                assert c["last_fail"] is None
        assert "Backend API" in names and "MongoDB" in names


class TestRetention:
    def test_retention_50(self):
        for _ in range(53):
            _run()
        h = _hist()
        assert len(h["runs"]) == 50
        last = _run()
        h2 = _hist()
        assert len(h2["runs"]) == 50
        assert h2["runs"][0]["timestamp"] == last["timestamp"]
        # oldest of previous list dropped
        assert h["runs"][-1]["timestamp"] not in [r["timestamp"] for r in h2["runs"]]
        for c in h2["checks"]:
            assert c["runs"] <= 50
