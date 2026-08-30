# Security Fix Summary: MQTT Wildcard Injection Mitigation

## Changes Made

### 1. backend/server.py

**Added imports:**
- `HTTPException` from fastapi (for better error handling)
- `field_validator` from pydantic (for model validation)
- `re` module (imported but not used in final implementation)

**Added validation functions:**
- `_validate_mqtt_topic_fragment(fragment, field_name)`: Core validation that rejects MQTT wildcards (+, #) and path separators (/)
- `_validate_mqtt_config(mqtt_cfg)`: Validates mqtt.topic_prefix
- `_validate_victron_mqtt_config(victron_cfg)`: Validates victron_mqtt.vrm_id

**Modified ConfigUpdate model:**
- Added `@field_validator('mqtt')` to validate MQTT configuration on PUT /api/config
- Added `@field_validator('victron_mqtt')` to validate Victron MQTT configuration on PUT /api/config

### 2. backend/mqtt_client.py

**Modified `_handle_victron_topic()` function:**
- Added VRM ID validation at the beginning of the function
- Extracts VRM ID from topic (parts[1])
- Compares with configured VRM ID from `_mqtt_state.get("vrm_id")`
- Returns early (ignores message) if VRM IDs don't match
- Logs debug message when filtering out mismatched VRM IDs

### 3. backend/tests/test_mqtt_security.py (NEW FILE)

**Created comprehensive security test suite with 23 test cases:**

Input Validation Tests (13 tests):
- Rejection of single-level wildcard (+) in topic_prefix and vrm_id
- Rejection of multi-level wildcard (#) in topic_prefix and vrm_id
- Rejection of path separator (/) in topic_prefix and vrm_id
- Acceptance of valid configurations
- Pydantic model validation integration
- Edge cases (empty strings, None values, missing fields)

VRM ID Filtering Tests (10 tests):
- Filtering of mismatched VRM IDs for solarcharger topics
- Filtering of mismatched VRM IDs for system topics
- Filtering of mismatched VRM IDs for grid topics
- Acceptance of matching VRM IDs
- Acceptance when no VRM ID is configured
- Integration with dispatcher routing

### 4. backend/MQTT_SECURITY.md (NEW FILE)

**Created security documentation:**
- Issue summary and attack vectors
- Detailed explanation of mitigation applied
- Code examples
- Remaining security considerations (authentication, authorization)
- Deployment recommendations
- Testing instructions
- References

## Attack Vectors Mitigated

### 1. Wildcard Topic Prefix Attack
**Before:** Setting `mqtt.topic_prefix` to `+` created subscription `+/#` which matched all first-level topics including `N/<vrm>/#`
**After:** PUT /api/config rejects with 422 Unprocessable Entity and error message

### 2. Wildcard VRM ID Attack
**Before:** Setting `victron_mqtt.vrm_id` to `+` created subscription `N/+/#` which matched all VRM IDs
**After:** PUT /api/config rejects with 422 Unprocessable Entity and error message

### 3. Path Separator Injection
**Before:** Setting `mqtt.topic_prefix` to `N/b827` created subscription `N/b827/#` matching Victron topics
**After:** PUT /api/config rejects with 422 Unprocessable Entity and error message

### 4. Cross-Tenant Data Collection
**Before:** Even with valid subscriptions, messages from other VRM IDs were processed and stored
**After:** Handler validates VRM ID and ignores messages from other VRM IDs

## Testing

All 23 security tests pass:
```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest tests/test_mqtt_security.py -v
```

Existing tests remain passing (no regressions):
```bash
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q
```

## Validation Examples

### Valid Configuration (Accepted)
```python
PUT /api/config
{
  "mqtt": {"topic_prefix": "solar"},
  "victron_mqtt": {"vrm_id": "b827eb79321c"}
}
# Returns 200 OK
```

### Invalid Configuration (Rejected)
```python
PUT /api/config
{
  "mqtt": {"topic_prefix": "+"}
}
# Returns 422 Unprocessable Entity
# Error: "mqtt.topic_prefix must not contain MQTT wildcard or path separator characters (+, #, /)"
```

```python
PUT /api/config
{
  "victron_mqtt": {"vrm_id": "N/+"}
}
# Returns 422 Unprocessable Entity
# Error: "victron_mqtt.vrm_id must not contain MQTT wildcard or path separator characters (+, #, /)"
```

## Defense in Depth

The fix implements multiple layers of defense:

1. **Input Validation (Primary)**: Rejects malicious input at the API boundary
2. **VRM ID Filtering (Secondary)**: Filters messages at the handler level even if subscription is broadened
3. **Logging**: Debug logs when filtering occurs for security monitoring
4. **Documentation**: Clear security documentation for operators

## Remaining Limitations

This fix addresses the wildcard injection vulnerability but does NOT address:

1. **No authentication on /api/config**: Any network-accessible client can modify configuration
2. **No authentication on data endpoints**: /api/diagnostics/raw, /api/integrations/status, /api/live
3. **Credentials in configuration**: MQTT passwords returned in plaintext by GET /api/config

These are documented as known limitations for LAN-only deployments. Production deployments should implement:
- Reverse proxy authentication (nginx/Caddy with HTTP Basic Auth or OAuth2)
- Network isolation (firewall rules, VPN)
- Secrets management (environment variables instead of database storage)
- MQTT broker ACLs

## Files Modified

- backend/server.py (added validation functions and model validators)
- backend/mqtt_client.py (added VRM ID filtering in handler)

## Files Created

- backend/tests/test_mqtt_security.py (23 security tests)
- backend/MQTT_SECURITY.md (security documentation)
- backend/SECURITY_FIX_SUMMARY.md (this file)
