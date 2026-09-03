---
name: Solar App Expert
description: Diagnostiziere, behebe und validiere Änderungen am FastAPI-Backend, den MQTT-/HTTP-Integrationen und dem React-Dashboard der Solar-Lokal-App, wobei lokale Energie-Semantik und API-Vertrag erhalten bleiben.
_agensi: "d3f0d1f0-0d2e-4ca5-8c65-5627672d7e9a"
---

# Solar-App-Experte

Verwende diesen Skill für Arbeiten am Repository der Solar-Lokal-App. Er hält Änderungen an Architektur, Energie-Semantik und Validierungserwartungen des Repositories ausgerichtet.

## Projektkontext

Dieses Projekt ist ein local-first Solardashboard mit:

- FastAPI-Backend in `backend/`
- MQTT- und HTTP-Gerätesammlung in `backend/mqtt_client.py` und `backend/server.py`
- MongoDB-Konfigurationsspeicherung und Snapshot-Polling
- Optionaler InfluxDB-Telemetrieexport
- React-19-Frontend in `frontend/src/`
- Produktions-Deployment in `deploy/proxmox/`

Das System ist DC-gekoppelt und muss die Invarianten der Energieberechnung bewahren. Das Hausleistungsmodell muss über Parser, Aggregatoren, API-Payloads, InfluxDB-Punkte und UI-Karten konsistent bleiben.

## Verbindlicher Ablauf

1. Beginne bei der nächstgelegenen zuständigen Quelle der Wahrheit.
   - Verwende `backend/collectors.py` und `collect_live()` für Live-Sammlung und Aggregation sowie `backend/server.py` für Anwendungslebenszyklus und API-Integration.
   - Verwende `backend/mqtt_client.py` für MQTT-Parsing, In-Memory-Datenspeicherung und Themen-Routing.
   - Verwende `backend/routes.py` oder `backend/collectors.py`, wenn es sich um einen Routen- oder Collector-Fehler handelt.
   - Verwende `frontend/src/lib/api.js` und die relevante Seite/Komponente, wenn es sich um einen Fehler bei der Ausgabe-Renderung handelt.

2. Verfolge den Datenpfad vor dem Fix vollständig.
   - Geräteeingabe -> Parser oder HTTP-Zugriff -> Sammellogik -> Zusammenfassungsaggregation -> API-Endpunkt -> Frontend-Komponente
   - Patche nicht nur den gerenderten Wert, ohne die vorgelagerte Logik zu prüfen.

3. Bewahre die Invarianten des Repositories.
   - Halte die API-Antwortstruktur stabil, sofern die Aufgabe sie nicht ausdrücklich ändert.
   - Bewahre Herkunftsmarker wie `_via_mqtt`, `_fallback` und `online`.
   - Zähle die Victron-MPPT-DC-Ladung nicht als Hausverbrauch.
   - Halte das etablierte Modell mit vier Hoymiles-Kanälen und drei Shelly-Phasen ein.
   - Schütze das local-first Verhalten und sichere Fallbacks, wenn MQTT- oder HTTP-Daten fehlen oder veraltet sind.

4. Halte Änderungen minimal und korrekt.
   - Bevorzuge den engsten Fix, der die Ursache behebt.
   - Vermeide sachfremde Refactorings oder Bereinigungen nahe am betroffenen Pfad.
   - Bewahre das Verhalten des Demo-Modus und die Erwartungen an den Start-/Shutdown-Lebenszyklus.

## Energie- und Geräteregeln

Halte diese repository-spezifischen Erwartungen ein:

- Die Gleichung für den Hausverbrauch muss konsistent bleiben:
  - `House consumption = Hoymiles PV_AC + SUN battery discharge + Shelly grid flow`
- Die Victron-MPPT-Ausgabe ist eine DC-seitige Ladung und darf nicht zum Hausverbrauch addiert werden.
- Die Trucki-Entladung wird aus `ACDISPLAY` bezogen, mit `ACSETPOINT` als Fallback.
- `METER` bleibt ein separates Netzsignal und darf nicht falsch in den Batterieverbrauch einfließen.
- Der tägliche Batterie-Rundlaufwirkungsgrad basiert auf SUN-Entladeenergie auf der AC-Seite geteilt durch MPPT-Ladeenergie auf der DC-Seite, berechnet per Trapezintegration.
- MQTT-Parsing soll defensiv erfolgen: Akzeptiere JSON, verpackte `{ "value": ... }`-Objekte, numerische Zeichenfolgen und relevante Klartextwerte.
- Fehlende Felder müssen sichere Standardwerte liefern, statt Poller oder Zusammenfassungslogik zu beenden.

## Validierungserwartungen

Führe vor Abschluss einer Aufgabe den kleinsten relevanten Prüf-Befehl aus:

### Backend

Vom Repository-Root aus:

```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_get_config_merge.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_influx_points.py -q
```

Wenn der Fix die Live-API oder den Frontend-Vertrag berührt, verwende bei Bedarf den passenden umfangreicheren Test oder einen fokussierten API-Check.

### Frontend

Aus `frontend/`:

```bash
./node_modules/.bin/craco test --watchAll=false --runInBand
```

Oder führe, sofern vorhanden, einen fokussierten Testpfad aus.

## Zu bewahrende Repository-Konventionen

- `backend/server.py` importiert die Konfiguration beim Laden des Moduls aus der Umgebung; setze `MONGO_URL` und `DB_NAME`, bevor du `server.py` importierst.
- `backend/tests/test_mqtt_client.py`, `test_influx_points.py`, `test_get_config_merge.py` und `test_solar_dashboard.py` dienen als Regressionsschutz.
- Die Konfiguration wird rekursiv mit `DEFAULT_CONFIG` zu einem MongoDB-Dokument mit dem Schlüssel `_id: "main"` zusammengeführt.
- Die Logik zum Neustart von Integrationen soll gezielt bleiben; nur verbindungsrelevante Konfigurationsänderungen dürfen MQTT, Victron oder InfluxDB neu starten.
- Snapshot-Poller und Keepalive-Tasks müssen beim Herunterfahren der Anwendung sauber beendet werden.
- Grafana-Dashboards und InfluxDB-Messungsnamen sind an Telemetrienamen und Einheiten gekoppelt; passe beides gemeinsam an, wenn eine Schemaänderung nötig ist.
- Bewahre dunkle Glas-/Neon-Designmuster, bestehende Routen und Frontend-Konventionen, sofern die Anforderung nichts anderes vorgibt.

## Erwartungen an die Ausgabe

Bei der Umsetzung von Änderungen:

- Erkläre die Ursache kurz vor dem Fix.
- Zeige die konkrete Änderung und warum sie minimal ist.
- Nenne den Validierungsbefehl und das tatsächliche Ergebnis.
- Benenne verbleibende Risiken oder Umgebungsabhängigkeiten klar.

## Wann dieser Skill gewählt wird

Verwende diesen Skill, wenn der Nutzer um eines der folgenden Themen bittet:

- einen Fehler bei Solar-Kennzahlen diagnostizieren
- MQTT- oder HTTP-Parsing korrigieren
- Live-Energieaggregation oder Zusammenfassungslogik anpassen
- eine Abweichung zwischen API-Ausgabe und Frontend-Anzeige beheben
- Probleme beim Konfigurations-Merge oder Integrationslebenszyklus untersuchen
- eine Backend-Änderung gegen die Testsuite des Repositories validieren
- Repository-Konventionen pflegen, ohne das beabsichtigte Produktverhalten zu ändern
