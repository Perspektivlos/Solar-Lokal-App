---
name: solar-lokal-app-fix-workflow
description: Implement focused fixes for the Solar Lokal App while preserving the project’s local-first behavior, device semantics, and validation expectations.
_agensi: "1d3d7ff3-5f34-49e9-8d83-0802bd69d473"
---

# Solar App Fix Workflow

Use this skill when the user wants a practical fix for a Solar Lokal App bug or regression. This workflow favors a narrow, evidence-based change over broad cleanup.

## Fix workflow

1. Confirm the failing behavior.
   - Reproduce or localize the issue using the smallest test, code path, or symptom description available.
   - Identify whether the problem is in parsing, collection, aggregation, API transformation, or rendering.

2. Localize the root cause.
   - Check `backend/mqtt_client.py` for MQTT parsing and topic state handling.
   - Check `backend/server.py` for summarization, fallback logic, API payload generation, and lifecycle behavior.
   - Check `frontend/src/lib/api.js` and the relevant page/component when the issue is visible only in UI output.

3. Apply the smallest correct fix.
   - Do not broaden scope to adjacent modules unless the root cause clearly spans them.
   - Keep the system’s energy model consistent and avoid changing API contracts unless explicitly required.
   - Preserve existing source markers, safe defaults, and demo-mode behavior.

4. Verify with the narrowest relevant check.
   - Backend: run a focused pytest selection for the touched logic.
   - Frontend: run a targeted test or build step for the affected area.
   - If no direct test exists, prefer the smallest executable validation that checks the changed behavior.

## Rules to preserve

- Keep the DC-coupled energy model intact.
- Do not count MPPT charging as house consumption.
- Keep `METER` separate from battery discharge logic.
- Preserve the established API shape and frontend conventions unless the task explicitly changes them.
- Maintain defensive MQTT parsing and graceful degradation for missing or malformed data.
- Preserve the existing local-first, demo-safe design.

## Safety checklist

Before finishing, verify:

- the change addresses the actual root cause
- the fix does not alter unrelated metrics
- the API contract remains stable unless intentionally changed
- the relevant test or validation command was run and recorded
- any remaining uncertainty is called out clearly

## Typical use cases

Use this skill for:

- backend bug fixes
- MQTT or HTTP parsing corrections
- summary logic or fallback adjustments
- API contract mismatches
- frontend display fixes caused by upstream data problems
- regression fixes that must stay aligned with project invariants
