---
name: solar-lokal-app-diagnostics
description: Investigate root causes in the Solar Lokal App, trace telemetry from device input through aggregation to UI output, and isolate regressions without broad refactors.
_agensi: "9e9e3100-ec7b-466d-ae73-9c219355cb8d"
---

# Solar App Diagnostics

Use this skill when the user wants a root-cause analysis for a bug in the Solar Lokal App, especially around energy metrics, MQTT parsing, device fallback behavior, or UI discrepancies.

## Goal

Find the exact failing layer and explain why the value is wrong. The goal is not to patch broadly; it is to localize the defect and identify the correct fix site.

## Investigation workflow

1. Identify the symptom and the exact value being reported.
   - Example: battery discharge is too high, PV value is missing, grid signal is inverted, or UI card shows stale data.

2. Trace the full data path.
   - Device topic or HTTP response
   - parser / access function
   - collection logic (`collect_live()` or equivalent)
   - summary and aggregation logic
   - API response payload
   - frontend page or component

3. Check the most likely source files in order.
   - `backend/mqtt_client.py` for MQTT routing, payload parsing, and in-memory state
   - `backend/collectors.py` and `collect_live()` for MQTT-first live collection, HTTP fallback, demo logic, and summary calculations
   - `backend/server.py` or `backend/routes.py` for application lifecycle and API output
   - `frontend/src/lib/api.js` and the relevant page/component for display mismatches

4. Verify the repository invariants.
   - Preserve `_via_mqtt`, `_fallback`, and `online` semantics.
   - Keep the energy model DC-coupled and consistent across all layers.
   - Confirm whether the mismatch is caused by parsing, aggregation, API transformation, or frontend rendering.

## Key repository checks

Use these checks during diagnosis:

- MQTT payloads may arrive as JSON, wrapped `{"value": ...}` objects, numeric strings, or text values.
- Missing or malformed values must not crash the poller; they should degrade gracefully.
- The system must not double-count MPPT charging as house consumption.
- `METER` must remain its own grid signal; do not conflate it with battery behavior.
- Trucki power should use `ACDISPLAY` with `ACSETPOINT` as fallback.
- Existing response shapes should stay stable unless the task explicitly changes the API contract.

## Diagnostic questions to answer

Before suggesting a fix, answer these:

- Which layer is wrong: parser, collector, summary, API, or UI?
- Is the error caused by stale MQTT data, missing fallback, bad conversion, or wrong sign convention?
- Does the issue affect both live data and persisted snapshots, or only one of them?
- Is the wrong value being generated upstream, or just displayed incorrectly?

## Output expectations

When diagnosing a bug, provide:

- the likely root cause
- the exact file and function involved
- the data path that leads to the wrong result
- the minimal fix scope that should be applied next
- any risks or assumptions that still need confirmation

## When to use this skill

Use this skill for:

- debugging solar metric mismatches
- tracing a value from MQTT or HTTP into the dashboard
- identifying wrong energy semantics or sign conventions
- validating whether an issue is in backend logic or frontend rendering
- narrowing a regression before making code changes
