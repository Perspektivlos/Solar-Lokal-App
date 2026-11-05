"""HTTP-level tests for Phase 1 device discovery endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for local pytest run – read frontend .env
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
                    break
    except Exception:
        pass

EXPECTED_COUNTS = {"shelly": 5, "ahoy": 5, "trucki": 3, "victron": 3}
EXPECTED_LABELS = {"shelly", "ahoy", "trucki", "victron"}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_discover_all(api):
    r = api.post(f"{BASE_URL}/api/devices/discover-all", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "devices" in data
    devs = data["devices"]
    assert len(devs) == 4
    by_key = {d["device"]: d for d in devs}
    assert set(by_key.keys()) == EXPECTED_LABELS
    for key, cnt in EXPECTED_COUNTS.items():
        d = by_key[key]
        assert d["status"] == "demo", f"{key} status={d['status']}"
        assert d.get("device_label")
        assert len(d["fields"]) == cnt, f"{key} field count = {len(d['fields'])}"
        for f in d["fields"]:
            assert "label" in f and "value" in f
            assert f["value"] not in (None, "", "n/a")


def test_single_discover_shelly(api):
    r = api.post(f"{BASE_URL}/api/devices/shelly/discover", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["device"] == "shelly"
    assert d["status"] == "demo"
    labels = {f["label"] for f in d["fields"]}
    assert {"Modellkennung", "Firmware-Version", "MAC-Adresse", "Geräte-ID", "Phasen-Profil"}.issubset(labels)
    assert d["detected_at"]


@pytest.mark.parametrize("key,expected", list(EXPECTED_COUNTS.items()))
def test_single_discover_each(api, key, expected):
    r = api.post(f"{BASE_URL}/api/devices/{key}/discover", timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "demo"
    assert len(d["fields"]) == expected


def test_unknown_device_404(api):
    r = api.post(f"{BASE_URL}/api/devices/unknownkey/discover", timeout=10)
    assert r.status_code == 404


def test_devices_info_persisted(api):
    # Run discover-all first to ensure data persisted
    api.post(f"{BASE_URL}/api/devices/discover-all", timeout=20)
    r = api.get(f"{BASE_URL}/api/devices/info", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "devices" in data
    keys = {d["device"] for d in data["devices"]}
    assert EXPECTED_LABELS.issubset(keys)
    for d in data["devices"]:
        if d["device"] in EXPECTED_LABELS:
            assert d["status"] == "demo"
            assert d["detected_at"]
            assert d["fields"]
