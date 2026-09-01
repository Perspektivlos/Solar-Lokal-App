---
name: solar-lokal-app-expert
description: Diagnose, fix, and validate changes for the Solar Lokal App's FastAPI backend, MQTT/HTTP integrations, and React dashboard while preserving the local-first energy semantics and API contract.
_agensi: "d3f0d1f0-0d2e-4ca5-8c65-5627672d7e9a"
---

# Solar App Expert

Use this skill for work on the Solar Lokal App repository. It keeps changes aligned with the repo's architecture, energy semantics, and validation expectations.

## Project context

This project is a local-first solar dashboard with:

- FastAPI backend in `backend/`
- MQTT and HTTP device collection in `backend/mqtt_client.py` and `backend/server.py`
- MongoDB config persistence and snapshot polling
- Optional InfluxDB telemetry export
- React 19 frontend in `frontend/src/`
- production deployment in `deploy/proxmox/`

The system is DC-coupled and must preserve energy-calculation invariants. The house power model should stay consistent across parsers, aggregators, API payloads, InfluxDB points, and UI cards.

## Required workflow

1. Start at the nearest owning source of truth.
   - Use `backend/server.py` for live aggregation and API responses.
   - Use `backend/mqtt_client.py` for MQTT parsing, in-memory data storage, and topic routing.
   - Use `backend/routes.py` or `backend/collectors.py` when the issue is a route or collector bug.
   - Use `frontend/src/lib/api.js` and the relevant page/component if the issue is an output rendering bug.

2. Trace the data path completely before fixing.
   - Device input -> parser or HTTP accessor -> collection logic -> summary aggregation -> API endpoint -> frontend component
   - Do not patch only the rendered value without checking upstream logic.

3. Preserve the repo's invariants.
   - Keep the API response shape stable unless the task explicitly changes it.
   - Preserve source markers such as `_via_mqtt`, `_fallback`, and `online`.
   - Do not count Victron MPPT DC charging as house consumption.
   - Keep the established four-Hoymiles-channel and three-Shelly-phase model.
   - Protect local-first behavior and safe fallbacks when MQTT or HTTP data is missing or stale.

4. Keep changes minimal and correct.
   - Prefer the narrowest fix that addresses root cause.
   - Avoid unrelated refactors or cleanup near the affected path.
   - Preserve demo-mode behavior and startup/shutdown lifecycle expectations.

## Energy and device rules

Follow these repository-specific expectations:

- House consumption equation must remain consistent:
  - `House consumption = Hoymiles PV_AC + SUN battery discharge + Shelly grid flow`
- Victron MPPT output is DC-side charging and must not be added to house consumption.
- Trucki discharge is taken from `ACDISPLAY` with `ACSETPOINT` as fallback.
- `METER` remains a separate grid signal and must not be folded into battery usage incorrectly.
- Daily battery round-trip efficiency is based on SUN discharge AC energy divided by MPPT charging DC energy, using trapezoidal integration.
- MQTT parsing should be defensive: accept JSON, wrapped `{ "value": ... }`, numeric strings, and plain text where relevant.
- Missing fields must produce safe defaults rather than crashing the poller or summary logic.

## Validation expectations

Before finishing a task, run the smallest relevant verification command:

### Backend

From repo root:

```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_get_config_merge.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_influx_points.py -q
```

If the fix touches the live API or front-end contract, use the relevant broader test or a focused API check as needed.

### Frontend

From `frontend/`:

```bash
./node_modules/.bin/craco test --watchAll=false --runInBand
```

Or run a focused test path when available.

## Repo conventions to preserve

- `backend/server.py` imports config from environment at module load time; set `MONGO_URL` and `DB_NAME` before importing `server.py`.
- `backend/tests/test_mqtt_client.py`, `test_influx_points.py`, `test_get_config_merge.py`, and `test_solar_dashboard.py` act as regression guardrails.
- Config is merged recursively with `DEFAULT_CONFIG` into a MongoDB document keyed by `_id: "main"`.
- Integration restart logic should be targeted; only connection-relevant config changes should restart MQTT, Victron, or InfluxDB.
- Snapshot polling and keepalive tasks must be shut down cleanly during app shutdown.
- Graphana dashboards and InfluxDB measurement names are coupled to telemetry names and units; adjust both together if a schema change is required.
- Keep dark-glass / neon design patterns, existing routes, and frontend conventions unless the request explicitly says otherwise.

## Output expectations

When implementing changes:

- Explain the root cause briefly before the fix.
- Show the concrete change and why it is minimal.
- State the verification command and actual result.
- Call out any residual risk or environment dependence clearly.

## When to choose this skill

Use this skill when the user asks for any of these:

- debug a solar metric bug
- fix MQTT or HTTP parsing
- adjust live energy aggregation or summary logic
- fix API output or frontend display mismatch
- investigate config merge or integration lifecycle issues
- validate a backend change against the repo's test suite
- maintain repo conventions without changing intended product behavior
