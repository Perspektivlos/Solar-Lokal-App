# Energie-Invarianten, API-Vertrag und Validierung (Solar-Lokal-App)

Lies diese Datei vor jeder Analyse oder Änderung an Energieberechnung, MQTT/HTTP-Parsing,
API-Antworten oder Dashboard-Werten. Sie ersetzt die frühere `solar-lokal-agent-toolbelt.md`.

## Energiemodell (DC-gekoppelt)

- Victron SmartSolar MPPT laden direkt die Batterie. MPPT-Ladung nie als Hausverbrauch zählen.
- Hoymiles HM-1500 (AhoyDTU) liefert AC-PV ins Haus/Netz.
- Trucki/SUN = Batterieentladung ins AC-Netz. Shelly Pro 3EM = Netzbezug/-einspeisung.
- Hausverbrauch = Hoymiles-AC + Trucki-Entladung + Netzbezug.
- Trucki-Entladung nutzt `ACDISPLAY`, Fallback `ACSETPOINT` (`backend/mqtt_client.py`).
  `METER` bleibt ein separates Netz-/Zähler-Signal.
- Wert nie aus einem visuellen Symptom ableiten: Gerät -> Parser -> Berechnung -> API -> UI verfolgen.

## API- und UI-Vertrag

- Live, history, today, control, configuration, integration-status und diagnostics bleiben stabil,
  sofern die Aufgabe sie nicht ausdrücklich ändert. 4 Hoymiles-Kanäle, 3 Shelly-Phasen.
- Einheiten, Vorzeichen, Aggregationsintervalle und `data-testid`-Werte nicht stillschweigend ändern.
- Herkunftsmarker `_via_mqtt`, `_fallback`, `online` korrekt setzen und durchreichen.
- MQTT-Parsing defensiv: JSON, Wrapper wie `{"value": ...}`, numerische Strings und Text akzeptieren;
  fehlende Felder liefern sichere Defaults und dürfen den Poller nicht abstürzen lassen.
- Demo-Modus und Mock-Generatoren (`backend/mocks.py`) als Standardpfad ohne Hardware erhalten.
- Forecast-UI, Autarkie-Zielkachel und Telegram-Integration nicht wieder einführen.
- Lokal-first: keine Cloud-Dienste, keine Authentifizierung und keine spekulativen Geräteprotokolle
  ohne ausdrückliche Anforderung.

## MQTT-Transport (Entscheidung des Users, 2026-11-01)

- Port 1883 ohne TLS bleibt vorerst der akzeptierte LAN-Standard (Default `port: 1883` in
  `backend/server.py`). Nicht als Fehler melden und nicht eigenmächtig auf 8883/TLS umstellen.
- Weiterhin prüfen: keine Credentials in Code oder Logs, ACL-User statt anonymem Zugriff,
  Broker nur im LAN erreichbar, keine Portfreigabe ins Internet.

## Validierung (vom Repo-Root)

`backend/server.py` liest `MONGO_URL` zwingend, daher immer mit gesetzten Variablen testen:

```bash
cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q
# gezielt, z. B.:
cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q tests/test_mqtt_client.py
```

Vorhandene Tests: `test_alarm_history.py`, `test_alarms.py`, `test_energy_balance.py`,
`test_get_config_merge.py`, `test_influx_points.py`, `test_mqtt_client.py`,
`test_refactor_lifespan.py`, `test_retention.py`, `test_solar_dashboard.py`.
`test_solar_dashboard.py` ist ein API-/Integrationstest gegen `REACT_APP_BACKEND_URL` und läuft nur
mit erreichbarem Dienst; sonst mit `--deselect tests/test_solar_dashboard.py` abwählen und das nennen.
Gemeinsame Quelle im Repo: `.github/solar-lokal-energy-invariants.md`.

```bash
cd frontend && yarn build                  # craco build
cd frontend && yarn test --watchAll=false  # craco test
```

Wenn `yarn` defekt ist: `./node_modules/.bin/craco build` bzw. `./node_modules/.bin/craco test --watchAll=false`.

- Energieberechnungen testen mit: Null, Bezug, Einspeisung, Laden, Entladen, fehlende Felder, Demo-Modus.
- Nach der ersten substanziellen Änderung und erneut vor dem Abschluss ausführen.
- Vorbestehende Fehler getrennt von neuen Regressionen berichten; fehlende Umgebung (Hardware,
  Broker, MongoDB) klar von einem Codefehler trennen.
