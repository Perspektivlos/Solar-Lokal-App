# Backend-Regeln für haucklab-fix (FastAPI, MQTT/HTTP, InfluxDB)

Lies diese Datei, wenn ein Fix Dateien unter `backend/` betrifft. Ersetzt den früheren
Agenten `backend-specialist`.

## Zuständige Module

- `backend/server.py`: App, Lifespan, `DEFAULT_CONFIG` (u. a. MQTT `port: 1883`), `MONGO_URL`
- `backend/routes.py`: API-Routen und Response-Logik
- `backend/mqtt_client.py`: Topic-Routing, Payload-Parsing (Trucki `ACDISPLAY`/`ACSETPOINT`, `METER`),
  In-Memory-Speicher `_mqtt_data`/`_mqtt_state` (werden absichtlich in place verändert)
- `backend/collectors.py`: `collect_live()`, MQTT-first-Sammlung, HTTP-Fallbacks, Summary
- `backend/influx_points.py`: InfluxDB-Punktgenerierung und Telemetrie-Schema
- `backend/alarms.py`, `backend/mocks.py`, `backend/local_inmemory.py`

## Arbeitsregeln

1. Am nächsten Backend-Source beginnen und den Datenfluss bis zur API-Ausgabe verfolgen.
2. Lifecycle von MQTT, Victron, InfluxDB und Snapshot-Poller nicht nebenbei umbauen;
   `cfg_put` startet Integrationen nur bei verbindungsrelevanten Änderungen neu.
3. Config-Merge mit `DEFAULT_CONFIG` rekursiv halten; veraltete Zusatzschlüssel dürfen keinen Fehler auslösen.
4. `server.py` nicht nur aus Stilgründen refaktorieren.
5. Für jede Verhaltensänderung einen fokussierten Test in `backend/tests/` ergänzen oder anpassen.
6. Kleinsten passenden `pytest`-Lauf aus `../../../solar-lokal-energy-invariants.md` ausführen.

Ein UI-Symptom nicht im Backend kaschieren; die Ursache gehört an die Stelle, an der der Wert entsteht.
