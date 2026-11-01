# Backend-Regeln (FastAPI, MQTT/HTTP, InfluxDB)

Lies diese Datei, wenn der Fix Dateien unter `backend/` betrifft.

## Zuständige Module

- `backend/server.py`: App, Lifespan, Default-Config (u. a. MQTT `port: 1883`), `MONGO_URL`
- `backend/routes.py`: API-Routen und Response-Logik
- `backend/mqtt_client.py`: MQTT-Parsing (Trucki `ACDISPLAY`/`ACSETPOINT`, `METER`), Verbindung
- `backend/collectors.py`: HTTP-Fallbacks und Snapshot-Poller (Shelly, AhoyDTU, Victron)
- `backend/influx_points.py`: InfluxDB-Punktgenerierung und Telemetrie-Schema
- `backend/alarms.py`, `backend/mocks.py`, `backend/local_inmemory.py`

## Arbeitsregeln

1. Am nächsten Backend-Source beginnen und den Datenfluss bis zur API-Ausgabe verfolgen.
2. Lifecycle von MQTT, Victron, InfluxDB und Snapshot-Poller nicht nebenbei umbauen.
3. `server.py` nicht nur aus Stilgründen refaktorieren.
4. Für jede Verhaltensänderung einen fokussierten Test in `backend/tests/` ergänzen oder anpassen.
5. Kleinsten passenden `pytest`-Lauf aus `energy-invariants.md` ausführen.

Ein UI-Symptom nicht im Backend kaschieren; die Ursache gehört an die Stelle, an der der Wert entsteht.
