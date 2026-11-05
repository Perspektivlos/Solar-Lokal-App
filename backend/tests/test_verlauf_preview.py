# Verlauf-Preview backend: /api/history ranges (incl. new 3h), /api/live summary, /api/today fields
import os
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _span_min(points):
    if len(points) < 2:
        return 0
    t0 = datetime.fromisoformat(points[0]["ts"])
    t1 = datetime.fromisoformat(points[-1]["ts"])
    return (t1 - t0).total_seconds() / 60


@pytest.mark.parametrize("rng,minutes", [("1h", 60), ("3h", 180), ("6h", 360), ("12h", 720), ("24h", 1440)])
def test_history_ranges(rng, minutes):
    r = requests.get(f"{BASE_URL}/api/history", params={"range": rng}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["range"] == rng
    pts = d["points"]
    assert isinstance(pts, list)
    assert len(pts) <= 600 or len(pts) <= 1200
    if pts:
        since = datetime.now(timezone.utc) - timedelta(minutes=minutes + 2)
        first = datetime.fromisoformat(pts[0]["ts"])
        if first.tzinfo is None:
            first = first.replace(tzinfo=timezone.utc)
        assert first >= since
        assert "_id" not in pts[0]
        for k in ("pv_power", "house_power", "battery_power", "grid_power"):
            assert k in pts[0]
    print(rng, len(pts), "span_min", round(_span_min(pts), 1),
          "first", pts[0]["ts"] if pts else None, "last", pts[-1]["ts"] if pts else None)


def test_history_3h_differs_from_1h_default():
    a = requests.get(f"{BASE_URL}/api/history", params={"range": "1h"}, timeout=30).json()["points"]
    b = requests.get(f"{BASE_URL}/api/history", params={"range": "3h"}, timeout=30).json()["points"]
    # 3h span must exceed 1h span if data older than 1h exists
    assert _span_min(b) >= _span_min(a)


def test_history_24h_includes_recent_data():
    pts = requests.get(f"{BASE_URL}/api/history", params={"range": "24h"}, timeout=30).json()["points"]
    if not pts:
        pytest.skip("no snapshots")
    last = datetime.fromisoformat(pts[-1]["ts"])
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - last).total_seconds()
    print("24h last point age s", age)
    assert age < 600, f"24h history last point is {age:.0f}s old (truncation by limit?)"


def test_live_summary_fields():
    r = requests.get(f"{BASE_URL}/api/live", timeout=30)
    assert r.status_code == 200
    s = r.json()["summary"]
    for k in ("pv_power", "house_power", "battery_power", "grid_power"):
        assert isinstance(s[k], (int, float))


def test_today_fields():
    r = requests.get(f"{BASE_URL}/api/today", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("battery_charge_kwh", "battery_discharge_kwh", "grid_import_kwh", "grid_export_kwh"):
        assert k in d and isinstance(d[k], (int, float))
    print({k: d.get(k) for k in d})
