# Solar Lokal App

## Repository map

- `backend/` contains the FastAPI service, device collectors, MQTT integration, InfluxDB point builders, and Pytest tests.
- `frontend/src/` contains the React 19 application. Routes are defined in `App.js`; pages live in `pages/`, domain UI in `components/`, API calls in `lib/api.js`, and power/sign helpers in `lib/power.js`.
- `deploy/proxmox/` contains the production LXC and nginx deployment scripts plus Grafana dashboards.
- Read the [project README](README.md) for product behavior and deployment details, the [status update](STATUS_UPDATE.md) for known current-state notes, and [design guidelines](design_guidelines.json) for frontend visual conventions.
- Use the [solar-app specialist agent](.github/agents/solar-app.agent.md) for detailed domain invariants and task-specific validation guidance.

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
- Preserve the German UI and dark glass control-room language. Numerical values use JetBrains Mono and UI text uses the fonts and colors defined in `design_guidelines.json`.
- Do not reintroduce the removed Forecast UI, Autarky target tile, or Telegram integration.
- Avoid committing environment files, credentials, generated builds, or dependency directories.

## Validation and environment

- Backend imports configuration at module load and startup requires MongoDB. Some integration tests also require a running app/services and `REACT_APP_BACKEND_URL`; distinguish those environment failures from code regressions.
- Backend snapshots are written every 15 seconds and the frontend polls live/today data every 3 seconds; preserve these intervals unless required by the task.
- For energy calculations, cover zero, import, export, charging, discharging, missing fields, and demo-mode data when relevant.
- After the first substantive edit, run the narrowest relevant executable check, then run the appropriate backend tests or frontend build before finishing.