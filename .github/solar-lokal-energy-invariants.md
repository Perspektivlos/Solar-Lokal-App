# Solar-Lokal-Energie-Invarianten, API-Vertrag und Validierung

Gemeinsame Quelle für alle Agenten unter `.agents/Solar_Lokal_Agent/` und die Skills unter
`skills/`. Lies diese Datei vor jeder Analyse oder Änderung an Energieberechnung,
MQTT-/HTTP-Parsing, API-Antworten oder Dashboard-Werten.

## Energiemodell (DC-gekoppelt)

- Victron SmartSolar MPPT laden direkt die Batterie. MPPT-Ladung nie als Hausverbrauch zählen.
- Hoymiles HM-1500 (AhoyDTU) liefert AC-PV ins Haus/Netz.
- Trucki/SUN = Batterieentladung ins AC-Netz. Shelly Pro 3EM = Netzbezug/-einspeisung.
- `Hausverbrauch = Hoymiles PV_AC + SUN-Batterieentladung + Shelly-Netzfluss`
- Trucki-Entladung nutzt `ACDISPLAY`, Fallback `ACSETPOINT` (`backend/mqtt_client.py`).
  `METER` bleibt ein separates Netz-/Zähler-Signal.
- Wert nie aus einem visuellen Symptom ableiten: MQTT-Topic/HTTP-Antwort -> Parser ->
  `collect_live()`/Summary -> API -> Frontend verfolgen.

## API- und UI-Vertrag

- Live, history, today, control, configuration, integration-status und diagnostics bleiben stabil,
  sofern die Aufgabe sie nicht ausdrücklich ändert. 4 Hoymiles-Kanäle, 3 Shelly-Phasen.
- Einheiten, Vorzeichen, Aggregationsintervalle und `data-testid`-Werte nicht stillschweigend ändern.
- Herkunftsmarker `_via_mqtt`, `_fallback`, `online` korrekt setzen und durchreichen.
- MQTT-Parsing defensiv: JSON, `{"value": ...}`-Wrapper, numerische Strings und Text akzeptieren;
  fehlende Felder liefern sichere Defaults und dürfen den Poller nicht beenden.
- Demo-Modus und Mock-Generatoren als Standardpfad ohne Hardware erhalten.
- Forecast-UI, Autarkie-Zielkachel und Telegram-Integration nicht wieder einführen.
- Lokal-first: keine Cloud-Dienste, keine Authentifizierung und keine spekulativen
  Geräteprotokolle ohne ausdrückliche Anforderung.
- InfluxDB-Messungen und Feldnamen werden von `deploy/proxmox/grafana/` verwendet; bei Änderungen
  diese Verbraucher mit anpassen.

## MQTT-Transport (Entscheidung, 2026-11-01)

- Port 1883 ohne TLS bleibt vorerst der akzeptierte LAN-Standard (Default `port: 1883` in
  `backend/server.py`). Nicht als Fehler melden und nicht eigenmächtig auf 8883/TLS umstellen.
- Weiterhin prüfen: keine Credentials in Code oder Logs, ACL-User statt anonymem Zugriff,
  Broker nur im LAN erreichbar, keine Portfreigabe ins Internet.

## Validierung

Die Tests importieren `server.py`, das `MONGO_URL` und `DB_NAME` beim Modulimport zwingend liest:

```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/ -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -q
```

Offline laufen eigenständig: `test_influx_points.py`, `test_mqtt_client.py`,
`test_get_config_merge.py`, `test_refactor_lifespan.py`.
`tests/test_solar_dashboard.py` ist ein API-/Integrationstest gegen `REACT_APP_BACKEND_URL`
(Default ist eine externe Preview-URL) und läuft nur gegen einen erreichbaren lokalen Dienst. Ohne laufenden Dienst diesen Test abwählen
(`--deselect tests/test_solar_dashboard.py`) und das im Bericht nennen.

```bash
cd frontend
yarn build                  # craco build
yarn test --watchAll=false  # craco test
```

Wenn `yarn` auf dem Rechner defekt ist, direkt `./node_modules/.bin/craco build` bzw.
`./node_modules/.bin/craco test --watchAll=false --runInBand` verwenden.

Semantik prüfen, nicht nur grüne Tests:
- MPPT-Ladung weiterhin vom Hausverbrauch ausgeschlossen?
- Batterieentladung folgt weiterhin `ACDISPLAY` vor `ACSETPOINT`?
- API-Ausgabe weiterhin in erwarteter Struktur (4 Hoymiles-Kanäle, 3 Shelly-Phasen)?
- Fehlende Gerätefelder fallen weiterhin sicher zurück; Herkunftsmarker bleiben aussagekräftig?
- Snapshot-Intervall 15 s und Frontend-Polling 3 s unverändert, sofern nicht beauftragt?

- Energieberechnungen testen mit: Null, Bezug, Einspeisung, Laden, Entladen, fehlende Felder, Demo-Modus.
- Nach der ersten substanziellen Änderung und erneut vor dem Abschluss ausführen.
- Vorbestehende Fehler getrennt von neuen Regressionen berichten; fehlende Umgebung (Hardware,
  Broker, MongoDB) klar von einem Codefehler trennen.
