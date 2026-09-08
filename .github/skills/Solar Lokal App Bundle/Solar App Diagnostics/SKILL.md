---
name: Solar App Diagnostics
description: Untersuche Ursachen in der Solar-Lokal-App, verfolge Telemetrie von der Geräteeingabe über die Aggregation bis zur UI-Ausgabe und grenze Regressionen ohne breite Refactorings ein.
_agensi: "9e9e3100-ec7b-466d-ae73-9c219355cb8d"
---

# Solar-App-Diagnose

## Gemeinsamer Vertrag

Vor der Diagnose [`../../../solar-lokal-agent-toolbelt.md`](../../../solar-lokal-agent-toolbelt.md)
lesen. Diagnose liefert den Handoff mit Ziel, Datenpfad, Belegen, Ursache,
Unsicherheit, Fix-Scope, Verifikation und Lernpunkt; sie patcht nicht ohne
ausdrücklichen Fix-Auftrag.

Verwende diesen Skill, wenn der Nutzer eine Ursachenanalyse für einen Fehler in der Solar-Lokal-App wünscht, besonders bei Energiekennzahlen, MQTT-Parsing, Geräte-Fallbacks oder Abweichungen in der UI.

## Ziel

Finde die genau fehlerhafte Schicht und erkläre, warum der Wert falsch ist. Ziel ist kein breiter Patch, sondern die Eingrenzung des Defekts und die Identifikation der richtigen Stelle für die Korrektur.

## Untersuchungsablauf

1. Identifiziere das Symptom und den genau gemeldeten Wert.
   - Beispiel: Die Batterieentladung ist zu hoch, der PV-Wert fehlt, das Netzsignal ist invertiert oder eine UI-Karte zeigt veraltete Daten.

2. Verfolge den vollständigen Datenpfad.
   - Gerätethema oder HTTP-Antwort
   - Parser- oder Zugriffsfunktion
   - Sammellogik (`collect_live()` oder Äquivalent)
   - Zusammenfassungs- und Aggregationslogik
   - API-Antwort-Payload
   - Frontend-Seite oder -Komponente

3. Prüfe die wahrscheinlichsten Quelldateien in dieser Reihenfolge.
   - `backend/mqtt_client.py` for MQTT routing, payload parsing, and in-memory state
   - `backend/collectors.py` and `collect_live()` for MQTT-first live collection, HTTP fallback, demo logic, and summary calculations
   - `backend/server.py` or `backend/routes.py` for application lifecycle and API output
   - `frontend/src/lib/api.js` and the relevant page/component for display mismatches

4. Prüfe die Invarianten des Repositories.
   - Bewahre die Semantik von `_via_mqtt`, `_fallback` und `online`.
   - Halte das Energiemodell DC-gekoppelt und über alle Schichten konsistent.
   - Bestätige, ob die Abweichung durch Parsing, Aggregation, API-Transformation oder Frontend-Rendering verursacht wird.

## Wichtige Repository-Prüfungen

Verwende diese Prüfungen während der Diagnose:

- MQTT-Payloads können als JSON, verpackte `{"value": ...}`-Objekte, numerische Zeichenfolgen oder Textwerte eintreffen.
- Fehlende oder fehlerhafte Werte dürfen den Poller nicht beenden, sondern müssen kontrolliert abgefangen werden.
- Das System darf die MPPT-Ladung nicht doppelt als Hausverbrauch zählen.
- `METER` muss sein eigenes Netzsignal bleiben und darf nicht mit dem Batterieverhalten vermischt werden.
- Die Trucki-Leistung soll `ACDISPLAY` verwenden, mit `ACSETPOINT` als Fallback.
- Bestehende Antwortstrukturen sollen stabil bleiben, sofern die Aufgabe den API-Vertrag nicht ausdrücklich ändert.

## Zu beantwortende Diagnosefragen

Beantworte vor einem Fix-Vorschlag folgende Fragen:

- Welche Schicht ist fehlerhaft: Parser, Collector, Zusammenfassung, API oder UI?
- Wird der Fehler durch veraltete MQTT-Daten, einen fehlenden Fallback, eine falsche Umwandlung oder ein falsches Vorzeichen verursacht?
- Betrifft das Problem sowohl Live-Daten als auch gespeicherte Snapshots oder nur eine der beiden Arten?
- Wird der falsche Wert bereits vorgelagert erzeugt oder nur falsch angezeigt?

## Erwartungen an die Ausgabe

Gib bei der Diagnose eines Fehlers Folgendes an:

- die wahrscheinliche Ursache
- die genau betroffene Datei und Funktion
- den Datenpfad, der zum falschen Ergebnis führt
- den minimalen Umfang des nächsten Fixes
- noch zu bestätigende Risiken oder Annahmen

## Wann dieser Skill verwendet wird

Verwende diesen Skill für:

- die Fehlersuche bei Abweichungen von Solar-Kennzahlen
- das Verfolgen eines Werts von MQTT oder HTTP bis ins Dashboard
- das Erkennen falscher Energie-Semantik oder Vorzeichenkonventionen
- die Prüfung, ob ein Problem in der Backend-Logik oder im Frontend-Rendering liegt
- das Eingrenzen einer Regression vor Codeänderungen
