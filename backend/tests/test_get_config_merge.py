"""Regression tests for get_config() merge robustness.

Reproduces the LXC startup crash: a stored config doc missing nested keys
(and carrying stale extra keys) must merge against DEFAULT_CONFIG without
raising KeyError during on_startup().
"""

import asyncio
import importlib

server = importlib.import_module("server")


class _FakeCursorDB:
    def __init__(self, doc):
        self._doc = doc
        self.inserted = None

    async def find_one(self, *_a, **_k):
        return dict(self._doc) if self._doc is not None else None

    async def insert_one(self, doc):
        self.inserted = doc


class _FakeDB:
    def __init__(self, doc):
        self.config = _FakeCursorDB(doc)


def _run(doc):
    orig = server.db
    server.db = _FakeDB(doc)
    try:
        return asyncio.run(server.get_config())
    finally:
        server.db = orig


def test_partial_doc_merges_defaults_no_crash():
    # doc lacks 'influx'/'victron_mqtt' and carries a stale extra key
    cfg = _run({"_id": "main", "demo_mode": False, "mqtt": {"enabled": True}, "legacy_goal": 70})
    for k, v in server.DEFAULT_CONFIG.items():
        assert k in cfg
        if isinstance(v, dict):
            assert isinstance(cfg[k], dict)
    assert cfg["demo_mode"] is False
    assert cfg["mqtt"]["enabled"] is True
    # nested defaults still present
    assert "host" in cfg["mqtt"]


def test_empty_db_returns_defaults():
    cfg = _run(None)
    assert cfg["demo_mode"] == server.DEFAULT_CONFIG["demo_mode"]
    assert set(server.DEFAULT_CONFIG).issubset(set(cfg))
