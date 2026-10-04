"""Tests für die Geräte-Erkennung / Anlagendokumentation (discovery.py)."""
import asyncio

import discovery


def _demo_cfg():
    return {
        "demo_mode": True,
        "devices": {
            "shelly": {"ip": "192.168.0.100", "enabled": True},
            "ahoy": {"ip": "192.168.0.101", "enabled": True, "inverter_id": 0},
            "trucki": {"ip": "192.168.0.102", "enabled": True},
            "victron": {"ip": "192.168.0.111", "enabled": True},
        },
        "victron_mqtt": {"enabled": True, "instances": [288, 289]},
    }


def test_mock_shelly_has_expected_labels():
    labels = [f["label"] for f in discovery.mock_discover_shelly()]
    assert "Modellkennung" in labels
    assert "MAC-Adresse" in labels
    assert "Geräte-ID" in labels


def test_discover_device_demo_status():
    r = asyncio.run(discovery.discover_device(_demo_cfg(), "ahoy"))
    assert r["status"] == "demo"
    assert r["device_label"].startswith("Ahoy")
    assert len(r["fields"]) == 5
    assert r["detected_at"]


def test_discover_all_keys():
    cfg = _demo_cfg()
    for key in discovery.DEVICE_LABELS:
        r = asyncio.run(discovery.discover_device(cfg, key))
        assert r["status"] == "demo"
        assert r["fields"], f"{key} should have fields"
        for f in r["fields"]:
            assert f["value"] not in (None, "")


def test_unknown_device_is_error():
    r = asyncio.run(discovery.discover_device(_demo_cfg(), "nope"))
    assert r["status"] == "error"
    assert r["fields"] == []


def test_live_unreachable_returns_error():
    cfg = {"demo_mode": False, "devices": {"shelly": {"ip": "10.255.255.1", "enabled": True}}}
    r = asyncio.run(discovery.discover_device(cfg, "shelly"))
    assert r["status"] == "error"
    assert "nicht erreichbar" in r["error"]
