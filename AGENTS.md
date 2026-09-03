# Solar Lokal App

## Repository map

- `backend/` contains the FastAPI service, device collectors, MQTT integration, InfluxDB point builders, and Pytest tests.
- `frontend/src/` contains the React 19 application. Routes are defined in `App.js`; pages live in `pages/`, domain UI in `components/`, API calls in `lib/api.js`, and power/sign helpers in `lib/power.js`.
- `deploy/proxmox/` contains the production LXC and nginx deployment scripts plus Grafana dashboards.
- `.github/.agents/` contains the repo-local specialist agents and role map.
- `.github/skills/` contains scoped workflow skills for diagnostics, implementation, validation, and release-oriented tasks.
- Read the [project README](README.md) for product behavior and deployment details, the [status update](STATUS_UPDATE.md) for known current-state notes, and [design guidelines](design_guidelines.json) for frontend visual conventions.
- Use the [solar-app specialist agent](.github/.agents/solar-app.agent.md) for detailed domain invariants and task-specific validation guidance.
- Use [agent-map](.github/.agents/agent-map.md) to select the correct repo workflow for debugging, fixes, or agent self-improvement.

## Commands

Backend, from `backend/`:

```bash
pip install -r requirements.txt
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q
uvicorn server:app --reload --host 127.0.0.1 --port 8001
```

Frontend, from `frontend/`:

```bash
yarn install
yarn start
yarn build
yarn test --watchAll=false
```

The frontend uses CRACO; `yarn start` is the development command. There is no `yarn dev` script.

## Working conventions

- Start at the nearest owning route, component, helper, or test. Trace values from device input through backend aggregation and API transformation before changing displayed metrics.
- Keep API fields, units, signs, aggregation intervals, and existing `data-testid` values stable unless the task explicitly changes the contract.
- Preserve the local-first/demo default path. MQTT is preferred when enabled, with short-timeout HTTP fallback for devices.
- Treat the system as DC-coupled: Victron MPPT charging goes directly to the battery, Hoymiles supplies AC PV, Trucki/SUN supplies battery discharge to AC, and Shelly measures grid exchange. Do not count MPPT charging directly as house consumption.
- Frontend code is JavaScript/JSX, not TypeScript. Reuse existing `solar-ui`, Radix/shadcn primitives, Lucide icons, Recharts, and `lib/power.js` patterns.
- Preserve the German UI and dark glass control-room language. Numerical values use JetBrains Mono and UI text uses the fonts and colors defined in `design_guidelines.json`. Backend docstrings and the README are also German.
- Do not reintroduce the removed Forecast UI, Autarky target tile, or Telegram integration.
- Avoid committing environment files, credentials, generated builds, or dependency directories.
- Use the repo-local skills for scoped support: [Solar App Expert](.github/skills/Solar%20App%20Expert/SKILL.md), [Solar App Diagnostics](.github/skills/Solar%20App%20Diagnostics/SKILL.md), [Solar App Fix Workflow](.github/skills/Solar%20App%20Fix%20Workflow/SKILL.md), and [Solar App Validation](.github/skills/Solar%20App%20Validation/SKILL.md).

## Checklist-based working flow

### 1) Task classification
- [ ] Is this a pure root-cause analysis?
  - Yes → `haucklab`
  - No → continue
- [ ] Is this a concrete fix or update?
  - Yes → `haucklab-fix`
  - No → continue
- [ ] Is this about agent workflow, role clarity, or prompt quality?
  - Yes → `haucklab-self`
  - No → continue
- [ ] Does this need a repo-level domain review across backend/frontend/integrations?
  - Yes → `solar-app`

### 2) Scope and affected area
- [ ] Backend logic affected?
- [ ] Frontend display affected?
- [ ] MQTT/HTTP parsing affected?
- [ ] InfluxDB/history affected?
- [ ] Deployment/Proxmox affected?
- [ ] Only docs/UI wording affected?

If multiple areas are involved, trace the full path:
- source
- parser/collector
- aggregation
- API
- frontend rendering

### 3) Root-cause check before editing
- [ ] Symptom clearly described?
- [ ] Reproduction or failure path known?
- [ ] Data flow checked from source to output?
- [ ] Energy model preserved?
  - PV production
  - battery discharge
  - grid import/export
  - MPPT charging excluded from house consumption

### 4) Fix selection
- [ ] Smallest possible fix chosen?
- [ ] No broad refactor without necessity?
- [ ] API contract kept stable unless the task explicitly changes it?
- [ ] No new hardware assumptions without evidence?
- [ ] No cloud/demo dependency added if local-first behavior is possible?

### 5) Implementation
- [ ] Relevant files read?
- [ ] Root cause confirmed?
- [ ] Minimal patch applied?
- [ ] Targeted tests added or updated?
- [ ] Repo conventions preserved?
- [ ] German UI and existing visual language preserved?

### 6) Verification
- [ ] Relevant backend test run?
- [ ] Relevant frontend check run?
- [ ] Energy edge cases checked?
  - [ ] zero values
  - [ ] import
  - [ ] export
  - [ ] charging
  - [ ] discharging
  - [ ] missing fields
  - [ ] demo mode

Typical commands:
- `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q`
- `cd frontend && ./node_modules/.bin/craco build`

### 7) Closure
- [ ] Root cause documented?
- [ ] Change explained clearly?
- [ ] Risk or follow-up issue identified?
- [ ] No unintended side effects visible?
- [ ] Next actionable step defined?

## Pitfalls

- `backend/server.py` reads `MONGO_URL` and `DB_NAME` from environment at module import time (not inside `lifespan`). Missing variables crash on import, before `uvicorn` even starts. Set both before importing or running anything that touches `server.py`.
- `backend/tests/test_solar_dashboard.py` defaults `REACT_APP_BACKEND_URL` to `https://solar-control-5.preview.emergentagent.com`. Without overriding it to a reachable local backend, the integration tests 404. The offline unit tests (`test_influx_points.py`, `test_mqtt_client.py`, `test_get_config_merge.py`, `test_refactor_lifespan.py`) do not hit the network and run standalone.
- Frontend health-check plugin and dev-server endpoints are gated behind `ENABLE_HEALTH_CHECK=true`; they are off by default.
- CRACO auto-injects `REACT_APP_VERSION` (from `package.json` version) and `REACT_APP_BUILD_DATE` (ISO date) on every `yarn start`/`yarn build`. Do not hardcode these values in components — read them from `process.env`.
- ESLint runs only inside the CRACO dev server (`yarn start`), configured in `craco.config.js` with `plugin:react-hooks/recommended`. There is no standalone `yarn lint` script.
- On this machine `yarn` is broken; use `./node_modules/.bin/craco` directly for start/build/test when `yarn` fails.

## Validation and environment

- Backend imports configuration at module load and startup requires MongoDB. Some integration tests also require a running app/services and `REACT_APP_BACKEND_URL`; distinguish those environment failures from code regressions.
- Backend snapshots are written every 15 seconds and the frontend polls live/today data every 3 seconds; preserve these intervals unless required by the task.
- For energy calculations, cover zero, import, export, charging, discharging, missing fields, and demo-mode data when relevant.
- After the first substantive edit, run the narrowest relevant executable check, then run the appropriate backend tests or frontend build before finishing.
