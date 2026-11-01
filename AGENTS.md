# Solar Lokal App

## Repository-Übersicht

- `backend/` enthält den FastAPI-Dienst, Gerätesammler, die MQTT-Integration, InfluxDB-Punktgeneratoren und Pytest-Tests.
- `frontend/src/` enthält die React-19-Anwendung. Routen sind in `App.js` definiert; Seiten liegen in `pages/`, die fachliche UI in `components/`, API-Aufrufe in `lib/api.js` und Hilfsfunktionen für Leistung und Vorzeichen in `lib/power.js`.
- `deploy/proxmox/` enthält die Produktionsskripte für LXC und nginx sowie Grafana-Dashboards.
- Lies die [Projekt-README](README.md) für Produktverhalten und Deployment-Details, das [Status-Update](STATUS_UPDATE.md) für bekannte Hinweise zum aktuellen Stand und die [Designrichtlinien](design_guidelines.json) für visuelle Frontend-Konventionen.

## Gemeinsame Quellen

Diese Datei wiederholt keine Regeln. Maßgeblich sind:

- [Energie-Invarianten, API-Vertrag, MQTT-Entscheidung und Testbefehle](.github/solar-lokal-energy-invariants.md)
- [Werkzeuggürtel, Rollen und Handoff-Vertrag](.github/solar-lokal-agent-toolbelt.md)
- [Architektur, Datenfluss und Konventionen](.github/copilot-instructions.md)
- [Agent-Map](.github/.agents/Solar_Lokal_Agent/agent-map.md)

## Rollenwahl

- Reine Ursachenanalyse → [`haucklab`](.github/.agents/Solar_Lokal_Agent/haucklab.agent.md)
- Konkreter Fix oder Update in Backend oder Frontend → [`haucklab-fix`](.github/.agents/Solar_Lokal_Agent/haucklab-fix.agent.md)
- Agenten-Workflow, Rollenklarheit oder Prompt-Qualität → [`haucklab-self`](.github/.agents/Solar_Lokal_Agent/haucklab-self.agent.md)
- Review eines Diffs oder PRs → [Code Reviewer](.github/skills/Code%20Reviewer/SKILL.md)

## Befehle

Backend, aus `backend/`:

```bash
pip install -r requirements.txt
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/ -q
uvicorn server:app --reload --host 127.0.0.1 --port 8001
```

Frontend, aus `frontend/`:

```bash
yarn install
yarn start
yarn build
yarn test --watchAll=false
```

Das Frontend verwendet CRACO; `yarn start` ist der Entwicklungsbefehl. Es gibt kein `yarn dev`-Skript.

## Stolperfallen

- Das Frontend-Health-Check-Plugin und die Dev-Server-Endpunkte sind hinter `ENABLE_HEALTH_CHECK=true` geschützt und standardmäßig deaktiviert.
- CRACO injiziert bei jedem `yarn start`/`yarn build` automatisch `REACT_APP_VERSION` (aus der Version in `package.json`) und `REACT_APP_BUILD_DATE` (ISO-Datum). Hardcode diese Werte nicht in Komponenten, sondern lies sie aus `process.env`.
- ESLint läuft nur innerhalb des CRACO-Dev-Servers (`yarn start`) und ist in `craco.config.js` mit `plugin:react-hooks/recommended` konfiguriert. Es gibt kein eigenständiges `yarn lint`-Skript.
- Frontend-Code ist JavaScript/JSX, nicht TypeScript. Backend-Docstrings und die README sind deutsch.
- Committe keine Umgebungsdateien, Zugangsdaten, erzeugten Builds oder Abhängigkeitsverzeichnisse.
