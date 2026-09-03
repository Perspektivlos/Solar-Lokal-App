---
name: solar-lokal-app-diagnostics
description: Investigate root causes in the Solar Lokal App, trace telemetry from device input through aggregation to UI output, and isolate regressions without broad refactors.
_agensi: "9e9e3100-ec7b-466d-ae73-9c219355cb8d"
---

# Solar App Diagnostics

Use this skill for root-cause analysis in the Solar Lokal App. The goal is to find the exact failing layer before proposing or applying any fix.

## Goal

Locate the defect in the correct layer: device input, MQTT/HTTP parsing, aggregation, API transformation, or UI rendering. Do not patch just the visible symptom without checking the upstream data path.

## Investigation workflow

1. Identify the exact symptom.
   - Example: battery discharge is too high, PV value is missing, grid signal is inverted, card shows stale data.

2. Trace the full data path.
   - Device topic or HTTP response
   - parser or accessor function
   - collection logic (`collect_live()` or equivalent)
   - summary and aggregation logic
   - API response payload
   - frontend page or component

3. Check the most likely source files in order.
   - `backend/mqtt_client.py` for MQTT state, payload parsing, and topic routing
   - `backend/server.py` for live aggregation, summary logic, demo mode, and API output
   - `backend/collectors.py` and `backend/routes.py` for collector- or route-specific bugs
   - `frontend/src/lib/api.js` and the affected page/component for rendering mismatches

4. Verify repo invariants.
   - Preserve `_via_mqtt`, `_fallback`, and `online` semantics.
   - Keep the energy model DC-coupled and consistent across all layers.
   - Determine whether the mismatch is caused by parsing, aggregation, API shaping, or frontend rendering.

## Key repository checks

Use these checks during diagnosis:

- MQTT payloads may arrive as JSON, wrapped `{ "value": ... }`, numeric strings, or plain text.
- Missing or malformed values must not crash the poller; they should degrade safely.
- The system must not double-count MPPT charging as house consumption.
- `METER` remains an independent grid signal and must not be conflated with battery logic.
- Trucki power should prefer `ACDISPLAY` and fall back to `ACSETPOINT`.
- Existing response shapes should stay stable unless the task explicitly changes the API contract.
- Demo mode and fallback paths must remain local-first and safe.

## Diagnostic questions to answer

Before suggesting a fix, answer these:

- Which layer is wrong: parser, collector, summary, API, or UI?
- Is the mismatch caused by stale MQTT data, missing fallback, wrong sign convention, bad conversion, or wrong source precedence?
- Does the issue affect live values, snapshots, or both?
- Is the wrong value generated upstream, or only displayed incorrectly?

## Output expectations

When diagnosing a bug, provide:

- likely root cause
- exact file and function involved
- the data path that leads to the wrong result
- minimal fix scope to apply next
- any assumptions or risk that still needs confirmation

## When to use this skill

Use this skill for:

- debugging solar metric mismatches
- tracing a value from MQTT or HTTP into the dashboard
- identifying wrong energy semantics or sign conventions
- validating whether an issue is backend logic or frontend rendering
- narrowing a regression before changing code
