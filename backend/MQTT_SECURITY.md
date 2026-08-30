# MQTT Security Mitigation

## Issue Summary

**CVE-Style Finding:** Unvalidated MQTT topic configuration permits cross-VRM telemetry collection

The configuration PUT endpoint accepts arbitrary dictionaries for `mqtt` and `victron_mqtt`. 
`topic_prefix` and `vrm_id` were interpolated directly into MQTT subscription filters without 
rejecting MQTT wildcard characters or path separators. This allowed:

1. Setting `topic_prefix` to `+` creates subscription `+/#`, which receives topics beginning 
   with `N/` as well as the intended generic topics
2. Setting `vrm_id` to `+` creates subscription `N/+/#`, matching all VRM IDs
3. The dispatcher routed any topic beginning with `N/` to the Victron handler without comparing 
   the topic's VRM component with the configured ID
4. Unrelated instances/system/grid values were exposed through `/api/diagnostics/raw` and 
   `/api/integrations/status`

## Mitigation Applied

### 1. Input Validation (server.py)

Added validation functions to reject MQTT wildcard characters (`+`, `#`) and path separators (`/`) 
in configuration fields:

- `_validate_mqtt_topic_fragment()`: Core validation logic
- `_validate_mqtt_config()`: Validates `mqtt.topic_prefix`
- `_validate_victron_mqtt_config()`: Validates `victron_mqtt.vrm_id`

These validators are integrated into the Pydantic `ConfigUpdate` model using `@field_validator` 
decorators, ensuring validation occurs automatically on all PUT /api/config requests.

**Example rejection:**
```python
PUT /api/config
{
  "mqtt": {"topic_prefix": "+"}
}
# Returns 422 Unprocessable Entity with error:
# "mqtt.topic_prefix must not contain MQTT wildcard or path separator characters (+, #, /)"
```

### 2. VRM ID Filtering (mqtt_client.py)

Modified `_handle_victron_topic()` to validate that incoming MQTT messages match the configured 
VRM ID before processing:

```python
configured_vrm = _mqtt_state.get("vrm_id")
topic_vrm = parts[1]  # Extract VRM ID from topic N/<vrm_id>/...
if configured_vrm and topic_vrm != configured_vrm:
    logger.debug(f"Ignoring Victron topic with mismatched VRM ID: {topic_vrm} != {configured_vrm}")
    return
```

This ensures that even if a broadened subscription somehow occurs (e.g., through direct database 
manipulation), messages from other VRM IDs are filtered out at the handler level.

### 3. Test Coverage (tests/test_mqtt_security.py)

Added comprehensive security tests covering:

- Input validation for all wildcard characters (`+`, `#`, `/`)
- Validation in both `mqtt.topic_prefix` and `victron_mqtt.vrm_id`
- Pydantic model validation integration
- VRM ID filtering for solarcharger, system, and grid topics
- Dispatcher routing with filtering
- Edge cases (no VRM configured, matching VRM, mismatched VRM)

## Remaining Security Considerations

### Authentication & Authorization

**IMPORTANT:** This mitigation addresses the wildcard injection vulnerability, but the following 
security issues remain and are documented as known limitations:

1. **No authentication on `/api/config` PUT endpoint**: Any network-accessible client can modify 
   the configuration. This is acceptable for LAN-only deployments but requires additional 
   protection (reverse proxy auth, firewall rules, VPN) if exposed to untrusted networks.

2. **No authentication on data exposure endpoints**: `/api/diagnostics/raw`, 
   `/api/integrations/status`, and `/api/live` expose telemetry data without access control.

3. **MQTT credentials in configuration**: The `/api/config` GET endpoint returns MQTT passwords 
   in plaintext. Consider using environment variables or a secrets manager for production 
   deployments.

### Deployment Recommendations

For production deployments:

1. **Network isolation**: Deploy on a private LAN segment with firewall rules restricting access
2. **Reverse proxy authentication**: Use nginx/Caddy with HTTP Basic Auth or OAuth2 proxy
3. **MQTT ACLs**: Configure broker-side ACLs to restrict topic access per client
4. **Secrets management**: Store MQTT/InfluxDB credentials in environment variables, not database
5. **Read-only API key**: Consider implementing a separate read-only API key for dashboards

## Testing

Run security tests:
```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest tests/test_mqtt_security.py -v
```

All tests should pass, confirming:
- Wildcard characters are rejected in configuration
- VRM ID filtering prevents cross-tenant data collection
- Valid configurations are accepted

## References

- MQTT Wildcard Documentation: https://www.hivemq.com/blog/mqtt-essentials-part-5-mqtt-topics-best-practices/
- OWASP Input Validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
