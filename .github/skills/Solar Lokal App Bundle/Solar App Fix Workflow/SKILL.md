---
name: solar-lokal-app-fix-workflow
description: Setze fokussierte Fixes für die Solar-Lokal-App um und bewahre dabei das local-first Verhalten, die Geräte-Semantik und die Validierungserwartungen des Projekts.
_agensi: "1d3d7ff3-5f34-49e9-8d83-0802bd69d473"
---

# Solar-App-Fix-Workflow

## Gemeinsamer Vertrag

Vor dem Patch [`../../../solar-lokal-agent-toolbelt.md`](../../../solar-lokal-agent-toolbelt.md)
lesen. Ein Fix startet nur mit einem belegten Ursachepfad oder einer
ausdrücklichen Nutzerfreigabe für eine Untersuchung; nach der Änderung werden
Verifikation und ein einzelner Lernpunkt dokumentiert.

Verwende diesen Skill, wenn der Nutzer einen praktischen Fix für einen Fehler oder eine Regression der Solar-Lokal-App wünscht. Dieser Ablauf bevorzugt eine eng begrenzte, belegbasierte Änderung gegenüber einer breiten Bereinigung.

## Fix-Ablauf

1. Bestätige das fehlerhafte Verhalten.
   - Reproduziere oder lokalisiere das Problem mit dem kleinsten verfügbaren Test, Codepfad oder der vorhandenen Symptombeschreibung.
   - Bestimme, ob das Problem im Parsing, Sammeln, Aggregieren, der API-Transformation oder dem Rendering liegt.

2. Grenze die Ursache ein.
   - Prüfe `backend/mqtt_client.py` auf MQTT-Parsing und Verwaltung des Themenstatus.
   - Prüfe `backend/collectors.py` und `collect_live()` auf MQTT-first-Sammlung, HTTP-Fallback und Zusammenfassung; prüfe `backend/server.py` auf API-Integration und Lebenszyklusverhalten.
   - Prüfe `frontend/src/lib/api.js` und die relevante Seite/Komponente, wenn das Problem nur in der UI-Ausgabe sichtbar ist.

3. Wende den kleinsten korrekten Fix an.
   - Erweitere den Umfang nicht auf angrenzende Module, sofern sich die Ursache nicht eindeutig über sie erstreckt.
   - Halte das Energiemodell des Systems konsistent und ändere API-Verträge nur bei ausdrücklicher Anforderung.
   - Bewahre bestehende Herkunftsmarker, sichere Standardwerte und das Verhalten des Demo-Modus.

4. Prüfe mit der engsten relevanten Gegenprobe.
   - Backend: Führe eine fokussierte pytest-Auswahl für die geänderte Logik aus.
   - Frontend: Führe einen gezielten Test oder Build-Schritt für den betroffenen Bereich aus.
   - Wenn kein direkter Test existiert, bevorzuge die kleinste ausführbare Validierung, die das geänderte Verhalten prüft.

## Zu bewahrende Regeln

- Bewahre das DC-gekoppelte Energiemodell.
- Zähle die MPPT-Ladung nicht als Hausverbrauch.
- Halte `METER` getrennt von der Batterieentladungslogik.
- Bewahre die etablierte API-Struktur und Frontend-Konventionen, sofern die Aufgabe sie nicht ausdrücklich ändert.
- Erhalte defensives MQTT-Parsing und kontrollierte Verschlechterung bei fehlenden oder fehlerhaften Daten.
- Bewahre das bestehende local-first- und demo-sichere Design.

## Sicherheits-Checkliste

Prüfe vor dem Abschluss:

- die Änderung behebt die tatsächliche Ursache
- der Fix verändert keine sachfremden Kennzahlen
- der API-Vertrag bleibt stabil, sofern er nicht absichtlich geändert wird
- der relevante Test oder Validierungsbefehl wurde ausgeführt und dokumentiert
- verbleibende Unsicherheiten werden klar benannt

## Typische Anwendungsfälle

Verwende diesen Skill für:

- Backend-Fehlerbehebungen
- Korrekturen beim MQTT- oder HTTP-Parsing
- Anpassungen an Zusammenfassungslogik oder Fallbacks
- Abweichungen vom API-Vertrag
- Frontend-Anzeigefixes, die durch vorgelagerte Datenprobleme verursacht werden
- Regression-Fixes, die an den Projektinvarianten ausgerichtet bleiben müssen
