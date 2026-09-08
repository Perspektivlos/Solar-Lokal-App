# Modernisierungsanweisungen für Solar-Lokal-App

> Dieses Dokument ist ein generierter, editierbarer Begleiter zu
> `MODERNIZATION_PLAN.md`. Die bestehende `.github/copilot-instructions.md`
> wurde nicht überschrieben. Nach Stakeholder-Review die gewünschten
> Commands/Gates in die autoritative Datei übernehmen.

Die aktuelle Architektur steht in `ARCHITECTURE.md`, der Fahrplan in
`MODERNIZATION_PLAN.md`. Arbeite immer nur an **einer Phase**, schneide den
Branch aus `main`, merge die Phase vor der nächsten und aktualisiere Plan,
README und Topologie-Dokumentation gemeinsam bei Strukturänderungen.

## Kanonische Befehle

| Aktion | Befehl |
|---|---|
| Backend installieren | `cd backend && python -m pip install -r requirements.txt` |
| Backend-Pure-Tests | `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py tests/test_influx_points.py tests/test_get_config_merge.py -q` |
| Backend vollständig | `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/` |
| Einzelne Backend-Datei | `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -v` |
| Einzelner Backend-Test | `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py::test_fetch_trucki_from_mqtt_discharging -v` |
| Backend-Server | `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. uvicorn server:app --reload --host 127.0.0.1 --port 8001` |
| Backend-Format | `black backend/` |
| Backend-Lint | `flake8 backend/` |
| Frontend installieren | `cd frontend && yarn install` |
| Frontend starten | `cd frontend && yarn start` |
| Frontend-Build | `cd frontend && yarn build` |
| Frontend-Test | `cd frontend && yarn test --watchAll=false` |
| Frontend-Testdatei | `cd frontend && yarn test --watchAll=false --runTestsByPath src/path/to/file.test.js` |
| Deployment | `/opt/solar-dashboard/deploy/proxmox/build-app.sh` im LXC |

Es gibt aktuell kein verifiziertes Typecheck-, E2E- oder CI-Workflow-Gate.
`backend/tests/test_solar_dashboard.py` und
`backend/tests/test_refactor_lifespan.py` benötigen einen laufenden Dienst und
eine gesetzte `REACT_APP_BACKEND_URL`; sie dürfen nicht als Offline-Unit-Tests
ausgegeben werden.

## Regime-aware Phase-Gates

- **Dark/pre-testability:** Nicht auf ein Testgate blockieren, das die
  Komponente noch nicht ausführen kann. Verlange stattdessen den erreichbaren
  Safety-Rung: Golden-/Seam-Snapshots, Smoke-Check, Reversibilität und Review.
- **Lit/post-testability:** Grüne runnable Commands bzw. grüne CI sind das
  autoritative Signal. API-/MQTT-/Influx-/Route-Änderungen benötigen den
  relevanten Contract-Diff.
- Die Testability Milestones und Rungs stehen pro Komponente in
  `MODERNIZATION_PLAN.md`.
- Ein unbekannter Pass/Fail ist nicht bestanden und muss im PR benannt werden.

## CI-Milestone und Enforcement

CI wird in **Phase 2** authoriert, nachdem Backend-Boot und der Frontend-
Beachhead testbar sind. Der Workflow soll Installation, Backend-Tests,
Frontend-Build und mindestens einen echten Frontend-Test ausführen.

**Manuelle Übergabe:** Ein Repository-Administrator muss danach unter GitHub
*Settings → Branches* die CI-Jobs als required status checks/Branch Protection
für `main` aktivieren. Bis dahin läuft CI, blockiert aber keine Merges.

## Branch- und PR-Regeln

1. Phase-Branches heißen `phase-N-kurzname` und werden aus dem aktuellen `main`
   erstellt.
2. Keine Phase direkt auf `main` committen.
3. Phase N vollständig prüfen, PR nach `main` mergen, erst danach Phase N+1
   starten.
4. Keine stillen Stack-PRs. Wenn Stacken unvermeidbar ist, braucht es eine
   Reconciliation-PR und einen expliziten Residual-Risk-Eintrag.
5. Vor dem Start prüfen: `git log origin/main..HEAD` ist leer, sobald ein
   Remote existiert.

## H1–H8 Pre-flight vor jeder Phase

- **H1:** Wurde jeder entfernte/quarantänisierte Dependency-Hit in allen
  Manifests/Imports erfasst?
- **H2:** Sind Major-Codemods inklusive Test-Engine und Config-Keys eigene Tasks?
- **H3:** Sind Python/Node/Mongo/Influx/CI-/Base-Image-Pins im selben Change?
- **H4:** Sind SPA, `/api`, Diagnose/Health, anonyme lokale UI, s2s und Webhooks
  explizit als Routeklassen geprüft?
- **H5:** Gibt es für jeden Stateful-Major einen sequenziellen Upgradepfad oder
  eine bewusst destruktive Demo-Reset-Entscheidung plus Rollback?
- **H6:** Ist jeder transitional-insecure state mit Schließphase und Rest-Risiko
  registriert?
- **H7:** Ist die vorherige Phase nach `main` gemergt und der Branch aus Trunk?
- **H8:** Sind README, Architecture, diese Instructions und Topologie-Listen im
  selben PR aktuell?

## Projektregeln

- Das DC-Energiemodell bleibt: `house = Hoymiles PV_AC + SUN discharge +
  Shelly grid`; Victron-MPPT-DC-Ladung wird nicht als Hauslast gezählt.
- `_via_mqtt`, `_fallback`, `online`, vier Hoymiles-Kanäle und drei Shelly-
  Phasen bleiben stabil.
- MQTT bleibt bevorzugt, HTTP ist kurzer Fallback, Demo bleibt local-first.
- Keine Secrets, `.env`, Tokens, erzeugten Builds oder Dependency-Verzeichnisse
  committen.
- Änderungen an Influx-Feldern/Tenants/Dashboards sind ein gemeinsamer Vertrag
  mit Backend und Grafana.
- `MODERNIZATION_PLAN.md` mit `✅ complete`, `⏭️ descoped` oder `🗑️ dropped`
  aktualisieren, sobald eine Phase abgeschlossen ist.

