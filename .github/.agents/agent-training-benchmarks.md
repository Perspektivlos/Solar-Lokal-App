# Agent Training Benchmarks

Diese Aufgaben sind bewusst auf echte Solar-Lokal-App-Fälle aus dem Repository zugeschnitten. Sie dienen als Trainingsbasis für Diagnose-, Fix- und Self-Improvement-Agenten.

## 1) MQTT-Payload robust parsen

Ziel:
- Fehlende oder unvollständige MQTT-Payloads dürfen nicht zum Abbruch des Pollers führen.

Relevante Dateien:
- [backend/mqtt_client.py](../../backend/mqtt_client.py)
- [backend/tests/test_mqtt_client.py](../../backend/tests/test_mqtt_client.py)

Aufgabe:
- Ein Payload kann JSON, ein verschachteltes `{ "value": ... }`-Objekt, numerische Strings oder Text sein.
- Fehlende Gerätefelder müssen sichere Defaults liefern.

Erwartetes Verhalten:
- Parser akzeptieren robuste Varianten.
- Falsche oder absent fields fallen auf Defaults zurück.
- Der MQTT- oder HTTP-Poller bricht nicht ab.

Erfolgsmaß:
- Test für fehlende Felder und numerische String-Varianten läuft grün.
- Verifikation: `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q tests/test_mqtt_client.py`

## 2) Konfigurations-Merge mit verschachtelten Defaults

Ziel:
- Konfigurationen müssen als MongoDB-Dokument mit `_id: "main"` sauber mit `DEFAULT_CONFIG` mergeable bleiben.

Relevante Dateien:
- [backend/server.py](../../backend/server.py)
- [backend/tests/test_get_config_merge.py](../../backend/tests/test_get_config_merge.py)

Aufgabe:
- Verschachtelte Konfigurationswerte fehlen teilweise.
- Veraltete zusätzliche Keys dürfen nicht als Fehler auftauchen.

Erwartetes Verhalten:
- Defaults bleiben erhalten.
- Neue Werte ergänzen die Konfiguration, ohne bestehende Struktur zu brechen.

Erfolgsmaß:
- Relevanter config-merge-Test läuft grün.
- Verifikation: `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q tests/test_get_config_merge.py`

## 3) Influx- und Telemetrie-Formate stabil halten

Ziel:
- Telemetrienamen, Einheiten und Feldnamen müssen über InfluxDB-Punkte und Grafana-Consumer konsistent bleiben.

Relevante Dateien:
- [backend/influx_points.py](../../backend/influx_points.py)
- [backend/tests/test_influx_points.py](../../backend/tests/test_influx_points.py)
- [deploy/proxmox/grafana/](../../deploy/proxmox/grafana/)

Aufgabe:
- Ein neues Feld oder eine geänderte Einheit darf die Grafana-Dashboards nicht brechen.

Erwartetes Verhalten:
- Messnamen und Felder entsprechen den bestehenden Semantiken.
- Keine signifikante Änderung an Einheiten ohne dazugehörige Anpassung der Verbraucher.

Erfolgsmaß:
- Relevanter Influx-Test läuft grün.
- Verifikation: `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q tests/test_influx_points.py`

## 4) Energiemodell logisch konsistent halten

Ziel:
- Die physikalische Semantik darf nicht durch falsche Summierungen oder doppelte Zählung brechen.

Relevante Dateien:
- [backend/server.py](../../backend/server.py)
- [backend/tests/test_solar_dashboard.py](../../backend/tests/test_solar_dashboard.py)
- [README.md](../../README.md)

Aufgabe:
- MPPT-Ladung darf nicht zusätzlich als Hausverbrauch gezählt werden.
- Hoymiles PV, Batterieentladung und Shelly-Netzfluss müssen konsistent zusammenlaufen.

Erwartetes Verhalten:
- Quelle → Parser/Collector → Aggregation → API → Frontend bleiben konsistent.
- Zero, Import, Export, Charging und Discharging werden berücksichtigt.

Erfolgsmaß:
- Relevante Energie- oder API-Checks laufen ohne Regressionen.
- Verifikation: `cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q tests/test_solar_dashboard.py`

## 5) API- und Frontend-Contract stabil halten

Ziel:
- Änderungen am API-Format dürfen nicht das Frontend oder UI-Tests brechen.

Relevante Dateien:
- [backend/routes.py](../../backend/routes.py)
- [frontend/src/lib/api.js](../../frontend/src/lib/api.js)
- [frontend/src/pages/](../../frontend/src/pages/)

Aufgabe:
- Die Struktur mit vier Hoymiles-Kanälen und drei Shelly-Phasen muss erhalten bleiben.
- Herkunftsmarker (`_via_mqtt`, `_fallback`, `online`) müssen weiter funktionieren.

Erwartetes Verhalten:
- API-Response bleibt kompatibel zu den bestehenden UI-Verbrauchern.
- Frontend-Seiten bleiben nutzbar, ohne das Datenmodell zu verändern.

Erfolgsmaß:
- kleinerer Frontend-Build oder gezielter UI-Check läuft durch.
- Verifikation: `cd frontend && ./node_modules/.bin/craco build`

## 6) Agenten-Workflow selbst bewerten

Ziel:
- Rollen und Hand-offs zwischen Diagnose-, Fix- und Self-Improvement-Agenten werden auf echte Repo-Szenarien geprüft.

Relevante Dateien:
- [AGENTS.md](../../AGENTS.md)
- [.github/.agents/agent-map.md](agent-map.md)
- [.github/agents/haucklab.agent.md](../agents/haucklab.agent.md)
- [.github/agents/haucklab-fix.agent.md](../agents/haucklab-fix.agent.md)
- [.github/agents/haucklab-self.agent.md](../agents/haucklab-self.agent.md)

Aufgabe:
- Identifiziere Überlappungen, unklare Scope-Grenzen oder fehlende Verifikationsregeln.
- Prüfe, ob der Agent zur Aufgabe wirklich passt.

Erwartetes Verhalten:
- Diagnose-Agent arbeitet ohne Fix-Implikation.
- Fix-Agent hält sich an den bestätigten Ursachepfad.
- Self-Agent erkennt Rollen- oder Prompt-Probleme konkret.

Erfolgsmaß:
- Agent-Verbesserung wird als eigene Lernschleife dokumentiert und in die Agenten-Definitionen übernommen.

## Bewertungsrubrik

Ein Agent gilt als gut trainiert, wenn er bei diesen Aufgaben jeweils folgendes erfüllt:
- Ursache statt Vermutung
- Datenfluss von Quelle bis UI nachverfolgt
- kleinster sichere Scope
- verifizierbare Aussage mit passendem Befehl
- Lernpunkt aus dem Fehler dokumentiert

Diese Benchmarks sind bewusst klein und reproduzierbar, damit sie als tägliche Trainingseinheit und als Qualitätsmaß für zukünftige Agenten-Verbesserungen dienen können.
