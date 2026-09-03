---
name: solar-lokal-app-validation
description: Validate Solar Lokal App changes with the smallest relevant backend or frontend checks while preserving the project’s energy rules, API contract, and local-first behavior.
_agensi: "a80f0f9c-4de1-4c0d-b900-d19cf7b742c5"
---

# Solar App Validation

Use this skill when the user wants to check whether a change is correct, safe, and aligned with the repository’s invariants. This workflow focuses on targeted validation rather than broad, noisy test runs.

## Validation goals

Confirm that the change:

- preserves the solar energy model and sign conventions
- keeps MQTT/HTTP fallback behavior safe and local-first
- does not break expected API fields or frontend consumers
- passes the smallest relevant executable verification

## Validation workflow

1. Choose the smallest relevant command.
   - Backend logic change: run a focused `pytest` selection for the touched area.
   - Frontend behavior change: run a targeted test or build command for the changed screen/component.
   - API shape change: verify the backend contract and any dependent frontend consumers.

2. Prefer repo-specific checks.
   - Backend examples:

```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_get_config_merge.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_influx_points.py -q
```

   - Frontend examples:

```bash
cd frontend
./node_modules/.bin/craco test --watchAll=false --runInBand
```

3. Validate the correctness of the system semantics, not just the test pass.
   - Check whether MPPT charging is still excluded from house consumption.
   - Check whether battery discharge logic still follows the correct source precedence.
   - Check whether API output still matches the expected structure.
   - Check whether missing device fields still fall back safely.

4. Record actual result and residual risk.
   - Report what was verified.
   - Call out any environment dependency or limitation.
   - Distinguish confirmed behavior from assumptions.

## Must-hold invariants

- Local-first and demo-safe behavior should remain intact.
- MQTT parsing remains defensive and tolerant of malformed payloads.
- `_via_mqtt`, `_fallback`, and `online` semantics remain meaningful.
- The four-Hoymiles-channel and three-Shelly-phase structure remains stable.
- No double-counting of DC-side charging in house consumption.

## When to use this skill

Use this skill for:

- verifying a fix or refactor
- checking whether a backend or frontend change is safe
- validating energy semantics and API contract stability
- confirming a bug is actually resolved without causing regressions
- deciding whether a broader suite is necessary or whether a focused check is sufficient
