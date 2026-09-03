# Solar Lokal App

## Repository-Übersicht

- `backend/` enthält den FastAPI-Dienst, Gerätesammler, die MQTT-Integration, InfluxDB-Punktgeneratoren und Pytest-Tests.
- `frontend/src/` enthält die React-19-Anwendung. Routen sind in `App.js` definiert; Seiten liegen in `pages/`, die fachliche UI in `components/`, API-Aufrufe in `lib/api.js` und Hilfsfunktionen für Leistung und Vorzeichen in `lib/power.js`.
- `deploy/proxmox/` enthält die Produktionsskripte für LXC und nginx sowie Grafana-Dashboards.
- `.github/.agents/` enthält die repo-lokalen Spezialagenten und die Rollenzuordnung.
- `.github/skills/` enthält auf bestimmte Aufgabenbereiche zugeschnittene Skills für Diagnose, Umsetzung, Validierung und Release-Aufgaben.
- Lies die [Projekt-README](README.md) für Produktverhalten und Deployment-Details, das [Status-Update](STATUS_UPDATE.md) für bekannte Hinweise zum aktuellen Stand und die [Designrichtlinien](design_guidelines.json) für visuelle Frontend-Konventionen.
- Verwende den [Solar-App-Spezialagenten](.github/.agents/solar-app.agent.md) für detaillierte Domäneninvarianten und aufgabenspezifische Hinweise zur Validierung.
- Verwende [agent-map](.github/.agents/agent-map.md), um den passenden Repo-Workflow für Debugging, Fixes oder die Verbesserung von Agenten auszuwählen.

## Befehle

Backend, aus `backend/`:

```bash
pip install -r requirements.txt
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q
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

## Arbeitskonventionen

- Beginne bei der nächstgelegenen zuständigen Route, Komponente, Hilfsfunktion oder dem passenden Test. Verfolge Werte von der Geräteeingabe über die Backend-Aggregation und API-Transformation, bevor du angezeigte Kennzahlen änderst.
- Halte API-Felder, Einheiten, Vorzeichen, Aggregationsintervalle und bestehende `data-testid`-Werte stabil, sofern die Aufgabe den Vertrag nicht ausdrücklich ändert.
- Erhalte den local-first-/Demo-Standardpfad. Wenn aktiviert, wird MQTT bevorzugt; für Geräte gibt es einen HTTP-Fallback mit kurzem Timeout.
- Behandle das System als DC-gekoppelt: Die Victron-MPPT-Ladung fließt direkt in die Batterie, Hoymiles liefert AC-PV, Trucki/SUN liefert Batterieentladung an das AC-Netz und Shelly misst den Netzaustausch. Zähle MPPT-Ladung nicht direkt zum Hausverbrauch.
- Frontend-Code ist JavaScript/JSX, nicht TypeScript. Verwende vorhandene Muster mit `solar-ui`, Radix/shadcn-Primitiven, Lucide-Icons, Recharts und `lib/power.js` wieder.
- Erhalte die deutsche UI und die Sprache eines dunklen Glas-Leitstands. Zahlenwerte verwenden JetBrains Mono; UI-Texte verwenden die in `design_guidelines.json` definierten Schriften und Farben. Backend-Docstrings und die README sind ebenfalls deutsch.
- Führe die entfernte Forecast-UI, die Autarkie-Zielkachel oder die Telegram-Integration nicht wieder ein.
- Committe keine Umgebungsdateien, Zugangsdaten, erzeugten Builds oder Abhängigkeitsverzeichnisse.
- Verwende die repo-lokalen Skills für gezielte Unterstützung: [Solar App Expert](.github/skills/Solar%20App%20Expert/SKILL.md), [Solar App Diagnostics](.github/skills/Solar%20App%20Diagnostics/SKILL.md), [Solar App Fix Workflow](.github/skills/Solar%20App%20Fix%20Workflow/SKILL.md) und [Solar App Validation](.github/skills/Solar%20App%20Validation/SKILL.md).

## Checklistenbasierter Arbeitsablauf

### 1) Aufgabenklassifizierung
- [ ] Handelt es sich um eine reine Ursachenanalyse?
  - Ja → `haucklab`
  - Nein → weiter
- [ ] Handelt es sich um einen konkreten Fix oder eine Aktualisierung?
  - Ja → `haucklab-fix`
  - Nein → weiter
- [ ] Geht es um Agenten-Workflow, Rollenklarheit oder Prompt-Qualität?
  - Ja → `haucklab-self`
  - Nein → weiter
- [ ] Ist eine domänenweite Prüfung über Backend, Frontend und Integrationen nötig?
  - Ja → `solar-app`

### 2) Umfang und betroffener Bereich
- [ ] Ist Backend-Logik betroffen?
- [ ] Ist die Frontend-Anzeige betroffen?
- [ ] Ist MQTT-/HTTP-Parsing betroffen?
- [ ] Sind InfluxDB oder Verlauf betroffen?
- [ ] Sind Deployment oder Proxmox betroffen?
- [ ] Sind nur Dokumentation oder UI-Texte betroffen?

Wenn mehrere Bereiche betroffen sind, verfolge den vollständigen Pfad:
- Quelle
- Parser/Sammler
- Aggregation
- API
- Frontend-Darstellung

### 3) Ursachenprüfung vor der Bearbeitung
- [ ] Ist das Symptom klar beschrieben?
- [ ] Ist die Reproduktion oder der Fehlerpfad bekannt?
- [ ] Ist der Datenfluss von der Quelle bis zur Ausgabe geprüft?
- [ ] Ist das Energiemodell erhalten?
  - PV-Erzeugung
  - Batterieentladung
  - Netzimport/-export
  - MPPT-Ladung vom Hausverbrauch ausgeschlossen

### 4) Auswahl des Fixes
- [ ] Ist der kleinstmögliche Fix gewählt?
- [ ] Gibt es kein unnötig breites Refactoring?
- [ ] Bleibt der API-Vertrag stabil, sofern die Aufgabe ihn nicht ausdrücklich ändert?
- [ ] Werden keine neuen Hardwareannahmen ohne Belege eingeführt?
- [ ] Wird keine Cloud-/Demo-Abhängigkeit hinzugefügt, wenn local-first möglich ist?

### 5) Umsetzung
- [ ] Sind die relevanten Dateien gelesen?
- [ ] Ist die Ursache bestätigt?
- [ ] Ist ein minimaler Patch angewendet?
- [ ] Sind gezielte Tests ergänzt oder aktualisiert?
- [ ] Sind die Repo-Konventionen erhalten?
- [ ] Sind die deutsche UI und die bestehende visuelle Sprache erhalten?

### 6) Verifizierung
- [ ] Ist der relevante Backend-Test ausgeführt?
- [ ] Ist der relevante Frontend-Check ausgeführt?
- [ ] Sind die Grenzfälle der Energieberechnung geprüft?
  - [ ] Nullwerte
  - [ ] Import
  - [ ] Export
  - [ ] Laden
  - [ ] Entladen
  - [ ] Fehlende Felder
  - [ ] Demo-Modus

Typische Befehle:
- `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q`
- `cd frontend && ./node_modules/.bin/craco build`

### 7) Abschluss
- [ ] Ist die Ursache dokumentiert?
- [ ] Ist die Änderung klar erklärt?
- [ ] Sind Risiko oder Folgeproblem identifiziert?
- [ ] Sind keine unbeabsichtigten Nebenwirkungen erkennbar?
- [ ] Ist der nächste konkrete Schritt definiert?

## Stolperfallen

- `backend/server.py` liest `MONGO_URL` und `DB_NAME` beim Modulimport aus der Umgebung (nicht innerhalb von `lifespan`). Fehlende Variablen führen bereits beim Import zum Absturz, bevor `uvicorn` überhaupt startet. Setze beide Variablen, bevor du etwas importierst oder ausführst, das `server.py` berührt.
- `backend/tests/test_solar_dashboard.py` verwendet standardmäßig `https://solar-control-5.preview.emergentagent.com` als `REACT_APP_BACKEND_URL`. Ohne Überschreiben mit einem erreichbaren lokalen Backend liefern die Integrationstests 404. Die Offline-Unit-Tests (`test_influx_points.py`, `test_mqtt_client.py`, `test_get_config_merge.py`, `test_refactor_lifespan.py`) greifen nicht auf das Netzwerk zu und laufen eigenständig.
- Das Frontend-Health-Check-Plugin und die Dev-Server-Endpunkte sind hinter `ENABLE_HEALTH_CHECK=true` geschützt und standardmäßig deaktiviert.
- CRACO injiziert bei jedem `yarn start`/`yarn build` automatisch `REACT_APP_VERSION` (aus der Version in `package.json`) und `REACT_APP_BUILD_DATE` (ISO-Datum). Hardcode diese Werte nicht in Komponenten, sondern lies sie aus `process.env`.
- ESLint läuft nur innerhalb des CRACO-Dev-Servers (`yarn start`) und ist in `craco.config.js` mit `plugin:react-hooks/recommended` konfiguriert. Es gibt kein eigenständiges `yarn lint`-Skript.
- Auf diesem Rechner ist `yarn` defekt; verwende bei einem Fehler stattdessen direkt `./node_modules/.bin/craco` für Start, Build und Tests.

## Validierung und Umgebung

- Das Backend importiert seine Konfiguration beim Laden des Moduls und benötigt beim Start MongoDB. Einige Integrationstests benötigen außerdem eine laufende Anwendung bzw. laufende Dienste und `REACT_APP_BACKEND_URL`; unterscheide diese Umgebungsfehler von Code-Regressionen.
- Backend-Snapshots werden alle 15 Sekunden geschrieben und das Frontend fragt Live-/Tagesdaten alle 3 Sekunden ab. Erhalte diese Intervalle, sofern die Aufgabe keine Änderung erfordert.
- Decke bei Energieberechnungen relevante Fälle mit Null, Import, Export, Laden, Entladen, fehlenden Feldern und Demo-Daten ab.
- Führe nach der ersten substanziellen Änderung den engsten passenden ausführbaren Check aus und danach vor dem Abschluss die passenden Backend-Tests oder den Frontend-Build.
