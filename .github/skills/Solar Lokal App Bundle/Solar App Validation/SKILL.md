---
name: solar-lokal-app-validation
description: Validiere Änderungen an der Solar-Lokal-App mit den kleinsten relevanten Backend- oder Frontend-Prüfungen und bewahre dabei die Energieregeln, den API-Vertrag und das local-first Verhalten des Projekts.
_agensi: "a80f0f9c-4de1-4c0d-b900-d19cf7b742c5"
---

# Solar-App-Validierung

## Gemeinsamer Vertrag

Vor der Prüfung [`../../../solar-lokal-agent-toolbelt.md`](../../../solar-lokal-agent-toolbelt.md)
lesen. `execute` ist der maßgebliche Werkzeuggürtel-Schritt; Memory darf nur
bereits bestätigte Ergebnisse speichern und niemals einen Test ersetzen.

Verwende diesen Skill, wenn der Nutzer prüfen möchte, ob eine Änderung korrekt, sicher und an den Invarianten des Repositories ausgerichtet ist. Dieser Ablauf konzentriert sich auf gezielte Validierung statt auf breite, unübersichtliche Testläufe.

## Validierungsziele

Bestätige, dass die Änderung:

- das Solar-Energiemodell und die Vorzeichenkonventionen bewahrt
- das sichere, local-first MQTT-/HTTP-Fallback-Verhalten erhält
- erwartete API-Felder oder Frontend-Verbraucher nicht beschädigt
- die kleinste relevante ausführbare Prüfung besteht

## Validierungsablauf

1. Wähle den kleinsten relevanten Befehl.
   - Änderung an Backend-Logik: Führe eine fokussierte `pytest`-Auswahl für den geänderten Bereich aus.
   - Änderung am Frontend-Verhalten: Führe einen gezielten Test oder Build-Befehl für die geänderte Ansicht/Komponente aus.
   - Änderung der API-Struktur: Prüfe den Backend-Vertrag und alle abhängigen Frontend-Verbraucher.

2. Bevorzuge Repository-spezifische Prüfungen.
   - Backend-Beispiele:

```bash
cd backend
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_mqtt_client.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_get_config_merge.py -q
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/test_influx_points.py -q
```

   - Frontend-Beispiele:

```bash
cd frontend
./node_modules/.bin/craco test --watchAll=false --runInBand
```

3. Validiere die Korrektheit der Systemsemantik, nicht nur den bestandenen Test.
   - Prüfe, ob die MPPT-Ladung weiterhin vom Hausverbrauch ausgeschlossen ist.
   - Prüfe, ob die Batterieentladungslogik weiterhin der korrekten Quellenpriorität folgt.
   - Prüfe, ob die API-Ausgabe weiterhin der erwarteten Struktur entspricht.
   - Prüfe, ob fehlende Gerätefelder weiterhin sicher auf Fallbacks zurückfallen.

4. Dokumentiere das tatsächliche Ergebnis und verbleibende Risiken.
   - Berichte, was geprüft wurde.
   - Benenne Umgebungsabhängigkeiten oder Einschränkungen.
   - Unterscheide bestätigtes Verhalten von Annahmen.

## Zwingend einzuhaltende Invarianten

- Local-first- und demo-sicheres Verhalten müssen erhalten bleiben.
- MQTT-Parsing bleibt defensiv und tolerant gegenüber fehlerhaften Payloads.
- Die Semantik von `_via_mqtt`, `_fallback` und `online` bleibt aussagekräftig.
- Die Struktur mit vier Hoymiles-Kanälen und drei Shelly-Phasen bleibt stabil.
- Keine doppelte Zählung der DC-seitigen Ladung im Hausverbrauch.

## Wann dieser Skill verwendet wird

Verwende diesen Skill für:

- die Prüfung eines Fixes oder Refactorings
- die Einschätzung, ob eine Backend- oder Frontend-Änderung sicher ist
- die Validierung von Energie-Semantik und API-Vertragsstabilität
- die Bestätigung, dass ein Fehler ohne neue Regressionen behoben ist
- die Entscheidung, ob eine umfangreichere Testsuite nötig oder eine fokussierte Prüfung ausreichend ist
