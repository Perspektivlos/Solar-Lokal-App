# Status-Update: Solar-Lokal-App

**Stand:** 07.09.2026
**Branch:** `fork-update2.6`

## Kurzstatus

Die Solar-Lokal-App besitzt weiterhin ihre bestehende Backend-/Frontend-
Architektur mit FastAPI, MQTT, MongoDB, optionaler InfluxDB und React. Das
Energie- und API-Modell bleibt die fachliche Leitplanke.

Parallel läuft eine Modernisierung der Agenten-, Skill- und Workflow-Struktur.
Diese Migration ist im aktuellen Arbeitsbaum noch nicht abgeschlossen.

## Aktueller Git-Stand

Die letzten fünf Commits des Branches sind:

| Commit | Nachricht |
|---|---|
| `2137127` | Auto-generated changes |
| `e738b30` | Auto-generated changes |
| `8b5df87` | Auto-generated changes |
| `cec3235` | Abschluss - Roadmap aktualisiert |
| `2d60090` | Grafana-URL konfigurierbar statt hartkodiert |

Der Arbeitsbaum enthält derzeit:

- Änderungen an `.github/copilot-instructions.md`
- die neue Datei `.github/copilot-instructions.modernization.md`
- neue Agenten-, Skill-, Prompt-, Extension- und Memory-Dateien
- zur Ablösung markierte ältere Agenten und Skills
- die aktualisierte Datei `STATUS_UPDATE.md`

Diese Änderungen sind noch nicht als abgeschlossene Migration zu betrachten.

## Produktstand

### Energie- und Verbrauchsmodell

Das System verwendet für die Hauslast das DC-gekoppelte Modell:

$$
\text{Hausverbrauch} = \text{Hoymiles PV_AC} + \text{SUN-Batterieentladung} + \text{Shelly-Netzfluss}
$$

Die Victron-MPPT-Ladeleistung liegt auf der DC-Seite und wird nicht zusätzlich
als Hausverbrauch gezählt. Die Batterieentladung wird aus `ACDISPLAY` bezogen,
mit `ACSETPOINT` als Fallback. Das Netzsignal `METER` bleibt davon getrennt.

### Geräte und Datenquellen

- MQTT wird bevorzugt verwendet.
- HTTP dient als kurzer Fallback, wenn MQTT-Werte fehlen oder veraltet sind.
- Der Demo-Modus bleibt lokal und ohne externe Cloud-Abhängigkeit nutzbar.
- Das API-Format behält vier Hoymiles-Kanäle und drei Shelly-Phasen bei.
- Herkunftsmarker wie `_via_mqtt`, `_fallback` und `online` bleiben Teil des
  Datenmodells.

### Bereits vorhandene Funktionen

Nach der bestehenden Projektentwicklung umfasst die Anwendung unter anderem:

- robuste MQTT-Auswertung für Trucki, Hoymiles/AhoyDTU, Victron und Shelly
- Live-, Tages- und Verlaufsdaten
- Round-Trip-Wirkungsgrad der Batterie auf Basis trapezförmiger Integration
- InfluxDB-Messungen für Solar-, Geräte-, Phasen- und Batteriedaten
- Grafana-Dashboards für System- und Gerätedaten
- Steuerungs-, Diagnose- und Integrationsbereiche
- konfigurierbare Grafana-Verbindung
- Proxmox-Deployment mit Backend- und Frontend-Build

Diese Punkte sind aus der Projektstruktur und der bestehenden Dokumentation
übernommen. Sie wurden für dieses Update nicht erneut als End-to-End-
Funktionstest ausgeführt.

### Entfernte Funktionen

Forecast-/Prognose-Funktionen und die frühere Autarkie-Zielkachel gehören nicht
mehr zum vorgesehenen Produktumfang. Die berechneten Live-Kennzahlen
`autarky_pct` und `self_consumption_pct` sind davon unabhängig.

## Test- und Build-Stand

Im Repository liegen derzeit sieben Backend-Testdateien:

- `test_alarms.py`
- `test_get_config_merge.py`
- `test_influx_points.py`
- `test_mqtt_client.py`
- `test_refactor_lifespan.py`
- `test_retention.py`
- `test_solar_dashboard.py`

Die Testdateien sind nicht alle gleich einzuordnen:

- Parser-, Konfigurations-, Influx- und Retention-Tests können grundsätzlich
  als Offline-Tests ausgeführt werden.
- `test_solar_dashboard.py` und Teile der Lifespan-Prüfung können einen
  erreichbaren Dienst, MongoDB oder weitere Umgebungsvariablen benötigen.
- Ein aktueller vollständiger Testlauf wurde für dieses Status-Update nicht
  behauptet und muss separat ausgeführt werden.

Die kanonischen Befehle stehen in
`.github/copilot-instructions.modernization.md`. Dort ist ebenfalls festgehalten,
dass aktuell kein verifiziertes Typecheck-, E2E- oder CI-Gate existiert.

## Agenten- und Skill-Modernisierung

Die neue Struktur umfasst:

- `.github/.agents/Solar_Lokal_Agent/` für gebündelte Agentenrollen
- `.github/solar-lokal-agent-toolbelt.md` als gemeinsamen Rollen- und
  Handoff-Vertrag
- `.github/skills/` für Changelog, Code Review, Coding-Workflow, Commit-Texte
  und verifiziertes Agent-Memory
- `.github/extensions/solar-lokal-toolbelt/` für die Memory-Werkzeuge
- `.github/copilot-instructions.modernization.md` für Phasen-Gates, H1-H8-
  Pre-flight-Prüfungen und CI-Ziele

Vor dem Abschluss dieser Migration müssen die neuen und entfernten Dateien
geprüft, die Instructions konsolidiert und die resultierenden Tests ausgeführt
werden.

## Nächste sinnvolle Schritte

1. Modernisierungsänderungen prüfen und eine klare Zielstruktur festlegen.
2. Alte und neue Agenten-/Skill-Pfade auf doppelte oder fehlende Rollen prüfen.
3. Die kanonischen Backend-Pure-Tests ausführen.
4. Den Frontend-Build ausführen.
5. Erst danach die Migration als eigene Phase dokumentieren und versionieren.

## Fachliche Invarianten

Bei allen weiteren Änderungen müssen erhalten bleiben:

- keine Doppelzählung der Victron-MPPT-DC-Ladung als Hausverbrauch
- MQTT-first mit sicherem HTTP-Fallback
- lokaler Demo-Modus
- stabile API-Felder, Einheiten und Vorzeichen
- vier Hoymiles-Kanäle und drei Shelly-Phasen
- defensive Behandlung fehlender oder fehlerhafter Gerätedaten
- keine Secrets, Tokens, `.env`-Dateien, Builds oder Dependency-Verzeichnisse
  im Repository
