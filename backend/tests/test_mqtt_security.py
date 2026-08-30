"""Security tests for MQTT topic validation and VRM ID filtering.

Tests the mitigation of CVE-style wildcard injection attacks that could
allow cross-tenant telemetry collection via malicious topic_prefix or vrm_id.
"""

import importlib
import pytest

server = importlib.import_module("server")
mc = importlib.import_module("mqtt_client")


# ---------- Input Validation Tests ----------


def test_mqtt_topic_prefix_rejects_single_level_wildcard():
    """topic_prefix='+' would create subscription '+/#' matching all first-level topics."""
    with pytest.raises(ValueError, match="topic_prefix.*wildcard"):
        server._validate_mqtt_topic_fragment("+", "mqtt.topic_prefix")


def test_mqtt_topic_prefix_rejects_multi_level_wildcard():
    """topic_prefix='solar#' would create invalid subscription."""
    with pytest.raises(ValueError, match="topic_prefix.*wildcard"):
        server._validate_mqtt_topic_fragment("solar#", "mqtt.topic_prefix")


def test_mqtt_topic_prefix_rejects_path_separator():
    """topic_prefix='N/b827' would create subscription 'N/b827/#' matching Victron topics."""
    with pytest.raises(ValueError, match="topic_prefix.*path separator"):
        server._validate_mqtt_topic_fragment("N/b827", "mqtt.topic_prefix")


def test_victron_vrm_id_rejects_single_level_wildcard():
    """vrm_id='+' would create subscription 'N/+/#' matching all VRM IDs."""
    with pytest.raises(ValueError, match="vrm_id.*wildcard"):
        server._validate_mqtt_topic_fragment("+", "victron_mqtt.vrm_id")


def test_victron_vrm_id_rejects_multi_level_wildcard():
    """vrm_id='b827#' would create invalid subscription."""
    with pytest.raises(ValueError, match="vrm_id.*wildcard"):
        server._validate_mqtt_topic_fragment("b827#", "victron_mqtt.vrm_id")


def test_victron_vrm_id_rejects_path_separator():
    """vrm_id='b827/eb79' would create subscription 'N/b827/eb79/#' (invalid VRM format)."""
    with pytest.raises(ValueError, match="vrm_id.*path separator"):
        server._validate_mqtt_topic_fragment("b827/eb79", "victron_mqtt.vrm_id")


def test_mqtt_config_validation_accepts_valid_prefix():
    """Valid topic_prefix should pass validation."""
    cfg = {"topic_prefix": "solar", "host": "localhost"}
    result = server._validate_mqtt_config(cfg)
    assert result["topic_prefix"] == "solar"


def test_mqtt_config_validation_rejects_wildcard_prefix():
    """ConfigUpdate should reject MQTT config with wildcard in topic_prefix."""
    cfg = {"topic_prefix": "+", "host": "localhost"}
    with pytest.raises(ValueError, match="topic_prefix"):
        server._validate_mqtt_config(cfg)


def test_victron_config_validation_accepts_valid_vrm():
    """Valid vrm_id should pass validation."""
    cfg = {"vrm_id": "b827eb79321c", "enabled": True}
    result = server._validate_victron_mqtt_config(cfg)
    assert result["vrm_id"] == "b827eb79321c"


def test_victron_config_validation_rejects_wildcard_vrm():
    """ConfigUpdate should reject Victron config with wildcard in vrm_id."""
    cfg = {"vrm_id": "+", "enabled": True}
    with pytest.raises(ValueError, match="vrm_id"):
        server._validate_victron_mqtt_config(cfg)


def test_config_update_model_validates_mqtt():
    """Pydantic ConfigUpdate model should validate mqtt field."""
    with pytest.raises(ValueError, match="topic_prefix"):
        server.ConfigUpdate(mqtt={"topic_prefix": "+"})


def test_config_update_model_validates_victron_mqtt():
    """Pydantic ConfigUpdate model should validate victron_mqtt field."""
    with pytest.raises(ValueError, match="vrm_id"):
        server.ConfigUpdate(victron_mqtt={"vrm_id": "#"})


def test_config_update_model_accepts_valid_config():
    """ConfigUpdate should accept valid configuration."""
    update = server.ConfigUpdate(
        mqtt={"topic_prefix": "solar", "host": "localhost"},
        victron_mqtt={"vrm_id": "b827eb79321c", "enabled": True},
    )
    assert update.mqtt["topic_prefix"] == "solar"
    assert update.victron_mqtt["vrm_id"] == "b827eb79321c"


def test_mqtt_config_validation_accepts_empty_prefix():
    """Empty topic_prefix should pass validation."""
    cfg = {"topic_prefix": "", "host": "localhost"}
    result = server._validate_mqtt_config(cfg)
    assert result["topic_prefix"] == ""


def test_victron_config_validation_accepts_empty_vrm():
    """Empty vrm_id should pass validation."""
    cfg = {"vrm_id": "", "enabled": False}
    result = server._validate_victron_mqtt_config(cfg)
    assert result["vrm_id"] == ""


def test_mqtt_config_validation_accepts_none_config():
    """None config should pass validation."""
    result = server._validate_mqtt_config(None)
    assert result is None


def test_victron_config_validation_accepts_none_config():
    """None config should pass validation."""
    result = server._validate_victron_mqtt_config(None)
    assert result is None


def test_mqtt_config_validation_accepts_missing_prefix():
    """Config without topic_prefix should pass validation."""
    cfg = {"host": "localhost", "port": 1883}
    result = server._validate_mqtt_config(cfg)
    assert "topic_prefix" not in result


def test_victron_config_validation_accepts_missing_vrm():
    """Config without vrm_id should pass validation."""
    cfg = {"enabled": True, "instances": [288, 289]}
    result = server._validate_victron_mqtt_config(cfg)
    assert "vrm_id" not in result


# ---------- VRM ID Filtering Tests ----------


def test_victron_handler_filters_mismatched_vrm_id():
    """_handle_victron_topic should ignore messages with VRM ID != configured."""
    # Reset state
    mc._mqtt_data["victron"]["instances"] = {}
    mc._mqtt_data["victron"]["system"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # Message from different VRM ID should be ignored
    mc._handle_victron_topic(
        "N/deadbeef1234/solarcharger/288/Yield/Power",
        b'{"value": 150.5}',
        "2024-01-01T12:00:00Z",
    )

    # No data should be stored
    assert 288 not in mc._mqtt_data["victron"]["instances"]


def test_victron_handler_accepts_matching_vrm_id():
    """_handle_victron_topic should accept messages with matching VRM ID."""
    # Reset state
    mc._mqtt_data["victron"]["instances"] = {}
    mc._mqtt_data["victron"]["system"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # Message from configured VRM ID should be accepted
    mc._handle_victron_topic(
        "N/b827eb79321c/solarcharger/288/Yield/Power",
        b'{"value": 150.5}',
        "2024-01-01T12:00:00Z",
    )

    # Data should be stored
    assert 288 in mc._mqtt_data["victron"]["instances"]
    assert mc._mqtt_data["victron"]["instances"][288]["Yield/Power"] == 150.5


def test_victron_handler_accepts_when_no_vrm_configured():
    """_handle_victron_topic should accept all messages when no VRM ID is configured."""
    # Reset state
    mc._mqtt_data["victron"]["instances"] = {}
    mc._mqtt_data["victron"]["system"] = {}
    mc._mqtt_state["vrm_id"] = None

    # Message should be accepted even with different VRM ID
    mc._handle_victron_topic(
        "N/anyvrm123/solarcharger/289/Yield/Power",
        b'{"value": 200.0}',
        "2024-01-01T12:00:00Z",
    )

    # Data should be stored
    assert 289 in mc._mqtt_data["victron"]["instances"]
    assert mc._mqtt_data["victron"]["instances"][289]["Yield/Power"] == 200.0


def test_victron_handler_filters_system_topic_with_wrong_vrm():
    """System topics should also be filtered by VRM ID."""
    mc._mqtt_data["victron"]["system"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # System message from different VRM ID should be ignored
    mc._handle_victron_topic(
        "N/wrongvrm456/system/0/Dc/Pv/Power",
        b'{"value": 500.0}',
        "2024-01-01T12:00:00Z",
    )

    # No data should be stored
    assert "Dc/Pv/Power" not in mc._mqtt_data["victron"]["system"]


def test_victron_handler_accepts_system_topic_with_correct_vrm():
    """System topics should be accepted when VRM ID matches."""
    mc._mqtt_data["victron"]["system"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # System message from configured VRM ID should be accepted
    mc._handle_victron_topic(
        "N/b827eb79321c/system/0/Dc/Pv/Power",
        b'{"value": 500.0}',
        "2024-01-01T12:00:00Z",
    )

    # Data should be stored
    assert mc._mqtt_data["victron"]["system"]["Dc/Pv/Power"] == 500.0


def test_victron_handler_filters_grid_topic_with_wrong_vrm():
    """Grid topics should also be filtered by VRM ID."""
    mc._mqtt_data["victron"]["grid"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # Grid message from different VRM ID should be ignored
    mc._handle_victron_topic(
        "N/attackervrm/grid/0/Ac/Power", b'{"value": 1000.0}', "2024-01-01T12:00:00Z"
    )

    # No data should be stored
    assert "Ac/Power" not in mc._mqtt_data["victron"]["grid"]


def test_victron_handler_accepts_grid_topic_with_correct_vrm():
    """Grid topics should be accepted when VRM ID matches."""
    mc._mqtt_data["victron"]["grid"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # Grid message from configured VRM ID should be accepted
    mc._handle_victron_topic(
        "N/b827eb79321c/grid/0/Ac/Power", b'{"value": 1000.0}', "2024-01-01T12:00:00Z"
    )

    # Data should be stored
    assert mc._mqtt_data["victron"]["grid"]["Ac/Power"] == 1000.0


def test_dispatch_routes_to_victron_handler_with_filtering():
    """_dispatch_mqtt_message should route N/ topics to handler which filters by VRM."""
    mc._mqtt_data["victron"]["instances"] = {}
    mc._mqtt_state["vrm_id"] = "b827eb79321c"

    # Dispatch message with wrong VRM ID
    mc._dispatch_mqtt_message(
        "N/evilvrm999/solarcharger/290/Yield/Power", b'{"value": 999.0}'
    )

    # Should be routed to handler but filtered out
    assert 290 not in mc._mqtt_data["victron"]["instances"]

    # Dispatch message with correct VRM ID
    mc._dispatch_mqtt_message(
        "N/b827eb79321c/solarcharger/290/Yield/Power", b'{"value": 123.0}'
    )

    # Should be accepted
    assert 290 in mc._mqtt_data["victron"]["instances"]
    assert mc._mqtt_data["victron"]["instances"][290]["Yield/Power"] == 123.0
