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


def test_firmware_annotation_outdated_and_current():
    cfg = _demo_cfg()
    # Ahoy mock fw = 0.8.145, latest = 0.8.150 -> outdated
    a = asyncio.run(discovery.discover_device(cfg, "ahoy"))
    fw_field = next(f for f in a["fields"] if f["label"] == "Firmware-Version")
    assert fw_field["fw_status"] == "outdated"
    assert "Update" in fw_field["fw_hint"]
    assert a["firmware"]["status"] == "outdated"
    # Shelly mock fw = 1.4.4, latest = 1.4.4 -> current
    s = asyncio.run(discovery.discover_device(cfg, "shelly"))
    sf = next(f for f in s["fields"] if f["label"] == "Firmware-Version")
    assert sf["fw_status"] == "current"
    assert s["firmware"]["status"] == "current"


def test_version_parsing():
    assert discovery._parse_version("v3.40 (large)") == (3, 40)
    assert discovery._parse_version("AhoyDTU 0.8.145") == (0, 8, 145)
    assert discovery._parse_version("Trucki2Shelly v2.3") == (2, 3)
    assert discovery._parse_version("keine zahl") is None
    assert discovery._cmp_versions((0, 8, 145), (0, 8, 150)) < 0
    assert discovery._cmp_versions((1, 4, 4), (1, 4, 4)) == 0


def test_annotate_changes():
    fields = [
        {"label": "Firmware-Version", "value": "0.8.150"},
        {"label": "Seriennummer", "value": "114182920147"},
    ]
    prev = {"Firmware-Version": "0.8.145", "Seriennummer": "114182920147"}
    changed = discovery.annotate_changes(fields, prev)
    assert changed == 1
    fw = next(f for f in fields if f["label"] == "Firmware-Version")
    assert fw["changed"] is True and fw["prev"] == "0.8.145"
    ser = next(f for f in fields if f["label"] == "Seriennummer")
    assert "changed" not in ser


def test_annotate_changes_no_prev():
    fields = [{"label": "Firmware-Version", "value": "1.0.0"}]
    assert discovery.annotate_changes(fields, {}) == 0
    assert "changed" not in fields[0]


def test_live_unreachable_returns_error():
    cfg = {"demo_mode": False, "devices": {"shelly": {"ip": "10.255.255.1", "enabled": True}}}
    r = asyncio.run(discovery.discover_device(cfg, "shelly"))
    assert r["status"] == "error"
    assert "nicht erreichbar" in r["error"]
