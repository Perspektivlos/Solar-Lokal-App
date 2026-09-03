"""Tests for the DB retention (snapshot cleanup) logic."""
import asyncio
from datetime import datetime, timedelta, timezone

import server


class _FakeResult:
    def __init__(self, n): self.deleted_count = n


class _FakeSnapshots:
    def __init__(self, data): self.data = data

    async def delete_many(self, query):
        cutoff = query["ts"]["$lt"]
        before = len(self.data)
        self.data = [d for d in self.data if d["ts"] >= cutoff]
        return _FakeResult(before - len(self.data))


class _FakeDB:
    def __init__(self, data): self.snapshots = _FakeSnapshots(data)


def test_cleanup_snapshots_deletes_only_old(monkeypatch):
    """_cleanup_snapshots_once must delete snapshots older than N days
    and leave newer ones untouched."""
    now = datetime.now(timezone.utc)
    docs = [
        {"ts": (now - timedelta(days=45)).isoformat(), "pv_power": 1},
        {"ts": (now - timedelta(days=31)).isoformat(), "pv_power": 2},
        {"ts": (now - timedelta(days=29)).isoformat(), "pv_power": 3},
        {"ts": (now - timedelta(hours=1)).isoformat(), "pv_power": 4},
    ]
    fake = _FakeDB(list(docs))
    monkeypatch.setattr(server, "db", fake)

    deleted = asyncio.run(server._cleanup_snapshots_once(30))
    assert deleted == 2
    remaining_ts = [d["ts"] for d in fake.snapshots.data]
    assert len(remaining_ts) == 2
    for ts in remaining_ts:
        assert (now - datetime.fromisoformat(ts)).days < 30


def test_cleanup_snapshots_disabled_when_zero_days(monkeypatch):
    called = {"n": 0}

    class Snaps:
        async def delete_many(self, query):
            called["n"] += 1
            raise AssertionError("should not be called")

    class DB:
        snapshots = Snaps()

    monkeypatch.setattr(server, "db", DB())
    assert asyncio.run(server._cleanup_snapshots_once(0)) == 0
    assert asyncio.run(server._cleanup_snapshots_once(-5)) == 0
    assert called["n"] == 0


def test_default_config_has_retention():
    ret = server.DEFAULT_CONFIG.get("retention")
    assert ret is not None
    assert ret["enabled"] is True
    assert ret["days"] == 30
