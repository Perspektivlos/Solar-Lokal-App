import os

from fastapi.testclient import TestClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "solar_dashboard_test")

import server


def test_live_includes_decision_intents(monkeypatch):
    async def fake_get_config():
        return {
            "demo_mode": True,
            "devices": {
                "shelly": {"ip": "127.0.0.1", "enabled": True},
                "ahoy": {"ip": "127.0.0.1", "enabled": True, "inverter_id": 0},
                "trucki": {"ip": "127.0.0.1", "enabled": True},
                "victron": {"ip": "127.0.0.1", "enabled": True},
            },
            "mqtt": {"enabled": False},
            "victron_mqtt": {"enabled": False},
            "influx": {"enabled": False},
            "forecast": {"enabled": False},
            "goals": {
                "autarky_pct": 70,
                "min_soc": 15,
                "max_soc": 95,
                "reserve_soc": 20,
                "avoid_export": True,
            },
        }

    async def fake_restart_integrations():
        return None

    monkeypatch.setattr(server, "get_config", fake_get_config)
    monkeypatch.setattr(server, "restart_integrations", fake_restart_integrations)

    client = TestClient(server.app)
    response = client.get("/api/live")
    assert response.status_code == 200
    data = response.json()
    assert "decision_intents" in data, "live payload must expose decision_intents"
    assert isinstance(data["decision_intents"], list)
