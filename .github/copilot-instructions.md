# Copilot-Anweisungen für Solar-Lokal-App

## Projektübersicht

Solar-Lokal-App ist ein cloudfreies Dashboard für ein DC-gekoppeltes PV- und Batteriesystem im Heimnetzwerk. Das Backend ist ein FastAPI-Dienst. Es bezieht Gerätedaten über MQTT und HTTP, aggregiert Live- und Verlaufswerte, speichert Konfiguration und Snapshots in MongoDB und schreibt optional Zeitreihendaten nach InfluxDB. Das Frontend ist eine React-19-Single-Page-Anwendung, die produktiv über nginx ausgeliefert wird.

Die Anwendung ist bewusst lokal und ressourcenschonend ausgelegt. Diese Eigenschaften müssen bei Änderungen an Integrationen, Polling oder Deployment erhalten bleiben.

## Build-, Test- und Lint-Befehle

### Backend

Befehle werden standardmäßig aus dem Repository-Root ausgeführt. `pytest.ini` ergänzt `backend` zum `PYTHONPATH`.

```bash
cd backend
python -m pip install -r requirements.txt
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -v
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py::test_fetch_trucki_from_mqtt_discharging -v
black .
flake8 .
```

Die Tests importieren `server.py`; deshalb müssen `MONGO_URL` und `DB_NAME` gesetzt sein. Der API-/Integrationstest in `backend/tests/test_solar_dashboard.py` verwendet `REACT_APP_BACKEND_URL` und fällt standardmäßig auf die bereitgestellte Preview-URL zurück. Diesen Test nur ausführen, wenn der Dienst erreichbar ist:

```bash
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest backend/tests/test_solar_dashboard.py -v
```

### Frontend

Das Frontend verwendet Yarn 1 und CRACO. In `frontend/package.json` gibt es kein separates Lint-Skript.

```bash
cd frontend
yarn install
yarn start
yarn build
yarn test --watchAll=false
yarn test --watchAll=false --runTestsByPath src/path/to/file.test.js
```

Für das Produktions-Deployment erstellt `deploy/proxmox/build-app.sh` die Python-Virtualenv, installiert Backend-Abhängigkeiten, startet das systemd-Backend, baut das Frontend ohne Source Maps und ESLint-Plugin und kopiert `frontend/build` nach `/var/www/solar-dashboard`.

## Architektur und Datenfluss

### Backend

- `backend/server.py` enthält die FastAPI-Anwendung, Konfigurationsdefaults und -merging, HTTP-Fallbacks für Geräte, Live-Aggregation, API-Routen, den 15-Sekunden-Snapshot-Poller, die InfluxDB-Punktgenerierung sowie den Lebenszyklus der Integrationen.
- `backend/mqtt_client.py` verwaltet die In-Memory-MQTT-Speicher (`_mqtt_data`, `_mqtt_state`), Topic-Routing, Payload-Parsing und die MQTT-Zugriffsfunktionen der Geräte. Diese Dictionaries werden absichtlich in place verändert, weil `server.py` sie per Referenz importiert.
- Die Live-Sammlung bevorzugt aktuelle MQTT-Werte und verwendet direkte HTTP-Geräteabfragen, wenn MQTT-Daten fehlen oder veraltet sind. Im Demo-Modus werden die Mock-Generatoren in `server.py` verwendet.
- Frontend-API-Aufrufe sind in `frontend/src/lib/api.js` zentralisiert. `App.js` bindet Router und gemeinsames Layout ein. Seiten liegen unter `frontend/src/pages`, wiederverwendbare Visualisierungs- und Gerätekomponenten unter `frontend/src/components`.
- nginx liefert die React-SPA aus und leitet `/api/*` an Uvicorn unter `127.0.0.1:8001` weiter. Der Backend-Dienst läuft als Benutzer `solar` aus `/opt/solar-dashboard/backend`.

### Energiemodell

Die physikalische Abrechnung muss über Parser, Aggregator, API-Payloads, InfluxDB-Punkte und UI hinweg konsistent bleiben:

```text
Hausverbrauch = Hoymiles PV_AC + SUN-Batterieentladung + Shelly-Netzfluss
```

Die Victron-MPPT-Leistung liegt auf der DC-Seite und darf nicht zusätzlich als Hausverbrauch gezählt werden. Die Trucki-Batterieentladung kommt aus `ACDISPLAY`, mit `ACSETPOINT` als Fallback. `METER` ist das Netz-/Zählersignal und muss getrennt bleiben. Die tägliche Batterie-Rundlauf-Effizienz wird aus der von SUN entladenen AC-Energie geteilt durch die von den MPPTs geladene DC-Energie berechnet; verwendet wird eine Trapezintegration.

### Gerätethemen und Payloads

- Victron VenusOS: `N/<vrm_id>/solarcharger/<instance>/...` sowie `system`- und `grid`-Pfade.
- Shelly Pro 3EM: `venus/grid/shellypro/status/em:0`; die drei Phasen als L1/L2/L3 aggregieren.
- AhoyDTU/Hoymiles: Die in `mqtt_client.py` unterstützten Präfixe beibehalten, einschließlich `HM1500/ch1` bis `HM1500/ch4`, Total-/Summary-Payloads, Availability und `ack_pwr_limit`.
- Trucki: `Trucki/ACDISPLAY`, `Trucki/ACSETPOINT`, `Trucki/METER`, `Trucki/VBAT`, `Trucki/STATE` und `Trucki/ZEPC`.

## Repository-spezifische Konventionen

- Agenten schreiben Antworten, Berichte, Rückfragen und Handoffs auf Deutsch. Code, API-Namen, Dateinamen, Befehle und unvermeidbare Fachbegriffe bleiben unverändert.
- MQTT-Parsing defensiv implementieren: JSON, verpackte `{"value": ...}`-Payloads, numerische Strings und Text akzeptieren. Fehlende oder fehlerhafte Gerätefelder sollen sichere Defaults liefern und den Poller nicht beenden.
- Die von der UI verwendeten Herkunftsmarker (`_via_mqtt`, `_fallback` und `online`) erhalten, damit Demo-, MQTT-Live-, HTTP-Fallback- und Offline-Daten unterschieden werden können.
- Das etablierte Antwortformat mit vier Hoymiles-Kanälen und drei Shelly-Phasen beibehalten. Änderungen am API-Format erfordern passende Anpassungen an Frontend-Verbrauchern und Backend-Tests.
- Die Konfiguration wird als MongoDB-Dokument mit `_id: "main"` gespeichert und rekursiv mit `DEFAULT_CONFIG` gemerged. Fehlende verschachtelte Defaults müssen erhalten bleiben; veraltete zusätzliche Schlüssel dürfen keinen Fehler verursachen.
- Integrationen werden gezielt neu gestartet: `cfg_put` startet MQTT, Victron und InfluxDB nur bei verbindungsrelevanten Konfigurationsänderungen neu.
- Der FastAPI-Startup erstellt Snapshot-Poller und Victron-Keepalive-Task. Beim Shutdown müssen Tasks beendet und MQTT/InfluxDB sauber getrennt werden.
- InfluxDB-Messungen und Feldnamen werden von den Grafana-JSON-Dashboards unter `deploy/proxmox/grafana/` verwendet. Bei Änderungen an Telemetrienamen oder Einheiten auch diese Verbraucher anpassen.
- Frontend-Imports möglichst über den `@/`-Alias für `src` führen. Die bestehenden funktionalen Komponenten, React-Hooks, Tailwind-, shadcn/Radix- und `lucide-react`-Muster verwenden. Dark-Glass-/Neon-Design und die bestehenden Routen (`/verlauf`, `/steuerung`, `/geraete`, `/diagnose`, `/integrationen`) erhalten.
- `backend/tests/test_mqtt_client.py`, `test_influx_points.py`, `test_get_config_merge.py` und `test_solar_dashboard.py` als Regressionsspezifikationen für Parser-Robustheit, Energiesemantik, Telemetrieformat, Konfigurationsmerging und API-Verhalten behandeln.
- Bei Gerätefehlern den vollständigen Pfad verfolgen: MQTT-Topic oder HTTP-Antwort -> Parser/Zugriffsfunktion -> `collect_live()` und Summary-Berechnung -> API-Endpunkt -> Frontend-Seite oder -Komponente. Nicht nur den angezeigten Wert ändern.

## Deployment- und Dokumentationsreferenzen

- Proxmox-Einrichtung und Betriebsbefehle: `deploy/proxmox/README.md`
- Container-, Service- und nginx-Einrichtung: `deploy/proxmox/install.sh`
- Build- und Deployment-Skript: `deploy/proxmox/build-app.sh`
- InfluxDB-/Grafana-Einrichtung: `deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md`
- Produktverhalten und unterstützte Hardware: `README.md`
- Repository-spezifische Copilot-Agenten: `.github/agents/*.agent.md`; Rollenzuordnung: `.github/.agents/agent-map.md` (`haucklab` für Diagnose, `haucklab-fix` für Umsetzung, `haucklab-self` für Änderungen am Agenten-Workflow)

Keine Secrets aus `.env`, MQTT-Zugangsdaten, InfluxDB-Tokens oder lokale Deployment-Konfiguration committen.
