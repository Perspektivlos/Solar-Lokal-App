"""Read-only-Hardwareprüfung für den lokalen Venus-OS-Broker."""
from types import SimpleNamespace

import smartshunt_probe as probe


class DummySocket:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeClient:
    instances = []

    def __init__(self, client_id):
        self.client_id = client_id
        self.on_connect = None
        self.on_message = None
        self.on_disconnect = None
        self.subscriptions = []
        self.publishes = []
        self.auth = None
        FakeClient.instances.append(self)

    def username_pw_set(self, username, password):
        self.auth = (username, password)

    def connect(self, host, port, keepalive):
        self.on_connect(self, None, None, 0)

    def subscribe(self, topic, qos=0):
        self.subscriptions.append((topic, qos))

    def publish(self, topic, payload, qos=0):
        self.publishes.append((topic, payload, qos))

    def loop_start(self):
        values = {
            "ProductName": "Victron SmartShunt IP65 300A",
            "DeviceInstance": 290,
            "Connected": 1,
            "Mgmt/Connection": "VE.Direct /dev/ttyUSB0",
            "Dc/0/Voltage": 52.7,
            "Dc/0/Current": -4.2,
            "Dc/0/Power": -221.3,
            "Soc": 73.4,
            "History/ChargeCycles": 222,
        }
        for path, value in values.items():
            payload = f'{{"value":{value!r}}}'.replace("'", '"').encode()
            self.on_message(self, None, SimpleNamespace(topic=f"N/portal/battery/290/{path}", payload=payload))

    def loop_stop(self):
        return None

    def disconnect(self):
        if self.on_disconnect:
            self.on_disconnect(self, None, 0)


def test_probe_reads_exact_topic_and_sends_no_write_command(monkeypatch):
    FakeClient.instances = []
    monkeypatch.setattr(probe.socket, "create_connection", lambda *args, **kwargs: DummySocket())
    monkeypatch.setattr(probe.mqtt, "Client", FakeClient)
    result = probe.probe_smartshunt({"host": "broker", "port": 1883, "username": "u", "password": "p"}, "portal", 2)
    client = FakeClient.instances[-1]
    assert result["passed"] is True
    assert result["current"]["identity"]["valid"] is True
    assert result["current"]["direction"] == "discharging"
    assert client.subscriptions == [("N/portal/battery/290/#", 0)]
    assert client.publishes == [("R/portal/keepalive", "", 0)]
    assert not any(topic.startswith("W/") for topic, _, _ in client.publishes)


def test_probe_returns_structured_failure_when_broker_is_unreachable(monkeypatch):
    def fail(*args, **kwargs):
        raise TimeoutError("private network unavailable")

    monkeypatch.setattr(probe.socket, "create_connection", fail)
    result = probe.probe_smartshunt({"host": "private", "port": 1883}, "portal", 2)
    assert result["passed"] is False
    assert result["read_only"] is True
    assert result["checks"][0]["id"] == "broker"
    assert result["checks"][0]["ok"] is False
    assert "private" not in str(result)


def test_probe_rejects_missing_portal_id_without_network_access(monkeypatch):
    monkeypatch.setattr(probe.socket, "create_connection", lambda *args, **kwargs: DummySocket())
    result = probe.probe_smartshunt({"host": "broker", "port": 1883}, "", 2)
    assert result["passed"] is False
    assert result["message_count"] == 0
    assert result["current"]["status"] == "unavailable"