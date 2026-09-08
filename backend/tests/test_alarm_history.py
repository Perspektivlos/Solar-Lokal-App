"""Tests für die Alarm-Historie (raised/resolved) und alarm_events-Cleanup."""
import asyncio
from datetime import datetime, timedelta, timezone

import server


class _FakeResult:
    def __init__(self, n): self.deleted_count = n


class _FakeAlarmEvents:
    def __init__(self, data=None):
        self.data = data if data is not None else []

    async def insert_many(self, docs):
        self.data.extend(docs)

    async def delete_many(self, query):
        cutoff = query["ts"]["$lt"]
        before = len(self.data)
        self.data = [d for d in self.data if d["ts"] >= cutoff]
        return _FakeResult(before - len(self.data))


class _FakeDB:
    def __init__(self, data=None):
        self.alarm_events = _FakeAlarmEvents(data)


def _alarm(aid, sev="critical"):
    return {"id": aid, "code": aid, "device": "shelly", "device_label": "Shelly Pro 3EM",
            "severity": sev, "message": f"msg {aid}"}


def test_raised_then_resolved(monkeypatch):
    fake = _FakeDB()
    monkeypatch.setattr(server, "db", fake)
    monkeypatch.setattr(server, "_active_alarms", {})

    a = _alarm("shelly-overvoltage")
    asyncio.run(server._log_alarm_transitions([a], demo=False))
    assert len(fake.alarm_events.data) == 1
    assert fake.alarm_events.data[0]["event"] == "raised"
    assert fake.alarm_events.data[0]["mode"] == "live"

    # kein Wechsel -> kein neues Event
    asyncio.run(server._log_alarm_transitions([a], demo=False))
    assert len(fake.alarm_events.data) == 1

    # Alarm verschwindet -> resolved
    asyncio.run(server._log_alarm_transitions([], demo=False))
    assert len(fake.alarm_events.data) == 2
    assert fake.alarm_events.data[-1]["event"] == "resolved"


def test_demo_mode_tag(monkeypatch):
    fake = _FakeDB()
    monkeypatch.setattr(server, "db", fake)
    monkeypatch.setattr(server, "_active_alarms", {})
    asyncio.run(server._log_alarm_transitions([_alarm("x")], demo=True))
    assert fake.alarm_events.data[0]["mode"] == "demo"


def test_multiple_raised_and_partial_resolve(monkeypatch):
    fake = _FakeDB()
    monkeypatch.setattr(server, "db", fake)
    monkeypatch.setattr(server, "_active_alarms", {})
    a, b = _alarm("a"), _alarm("b", "warning")
    asyncio.run(server._log_alarm_transitions([a, b], demo=False))
    assert sum(1 for e in fake.alarm_events.data if e["event"] == "raised") == 2
    # b bleibt, a weg -> genau ein resolved (a)
    asyncio.run(server._log_alarm_transitions([b], demo=False))
    resolved = [e for e in fake.alarm_events.data if e["event"] == "resolved"]
    assert len(resolved) == 1 and resolved[0]["code"] == "a"


def test_cleanup_alarm_events(monkeypatch):
    now = datetime.now(timezone.utc)
    docs = [
        {"ts": (now - timedelta(days=40)).isoformat(), "event": "raised"},
        {"ts": (now - timedelta(days=10)).isoformat(), "event": "raised"},
    ]
    fake = _FakeDB(list(docs))
    monkeypatch.setattr(server, "db", fake)
    deleted = asyncio.run(server._cleanup_alarm_events_once(30))
    assert deleted == 1
    assert len(fake.alarm_events.data) == 1


def test_cleanup_alarm_events_disabled_zero(monkeypatch):
    monkeypatch.setattr(server, "db", _FakeDB([{"ts": "x"}]))
    assert asyncio.run(server._cleanup_alarm_events_once(0)) == 0
