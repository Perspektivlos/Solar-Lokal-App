# Agent-Map für Solar-Lokal-App

## Überblick

Diese Agenten sind bewusst in klare Rollen aufgeteilt, damit die Arbeit sauber zwischen Analyse, Umsetzung und Agenten-Verbesserung getrennt bleibt.

## 1) Diagnose-Phase

Agent: ../agents/haucklab.agent.md
- Zweck: Debugging-only / Fehleranalyse

Verwendung bei:
- Ursache eines Problems nachverfolgen, ohne sofort zu refaktorieren
- Fehlerursachen suchen & finden
- Root-Cause-Analyse
- Datenfluss verfolgen: MQTT/HTTP → Backend → Berechnung → API → Frontend
- MQTT/HTTP-Parsing-Fehler verstehen
- Regressionen oder unerwartetes Verhalten verstehen

Typische Prompts:
- "Warum ist die Batterieanzeige falsch?"
- "Analysiere den Fehler im MQTT-Parsing."
- "Finde die Ursache für die fehlerhafte PV-Berechnung."

## 2) Implementierungs-Phase

Agent: ../agents/haucklab-fix.agent.md
- Zweck: Fix + Update + Cleanup

Verwendung bei:
- Codeänderungen und Fehlerbehebungen umsetzen
- Regressionen beheben
- Struktur und Code aufräumen
- Tests oder kleine Refactors ergänzen
- Projektelemente aktuell halten

Typische Prompts:
- "Behebe den Fehler und passe den betroffenen Bereich an."
- "Räume die MQTT-Logik auf und behalte das Systemverhalten intakt."
- "Verbessere die Maintainability ohne das Modell zu verändern."

## 3) Selbstverbesserung der Agenten-Workflows

Agent: ../agents/haucklab-self.agent.md
- Zweck: Grenzen analyse zur Agenten-Eigenentwicklung

Verwendung bei:
- Agenten-Setup evaluieren
- Prompt- und Rollenqualität verbessern
- Overlap oder Unklarheiten zwischen Agenten erkennen
- Agenten-Workflows optimieren
- Schwächen in der Agenten-Entwicklung selbst analysieren


Typische Prompts:
- "Bewerte die Agenten-Struktur und schlage Verbesserungen vor."
- "Ist die Trennung zwischen Debugging und Fix klar genug?"
- "Verbessere die Agenten-Definitionen anhand der Repo-Architektur."

## 4) Trainings- und Subagent-Loop

Die Agenten sollen zusammenarbeiten wie eine kleine, wiederholbare Lern-Schleife statt als isolierte Einzelkämpfer.

Standard-Workflow:
- Diagnose-Agent: Symptom, Ursachepfad, Hypothese, Belege, minimaler Fix-Vorschlag
- Fix-Agent: kleinster sichere Patch, konsekutive Verifikation, keine Überschreitung des Scope
- Self-Agent: Robuste Zuständigkeiten, Rollenklären, Prompt-Verbesserungen, Wiederholungsfehler erkennen

Subagent-Contract:
- Ziel: Was genau ist das Problem?
- Relevanter Repository-Kontext: betroffene Dateien und Architekturabschnitt
- Beleg: Datenfluss oder Testresultat
- Ursache: warum das Problem entsteht
- Fix-Plan: kleinster sichere Eingriff
- Verifikation: zuständiger Befehl und erwartetes Ergebnis
- Lernpunkt: welche Wiederholung wurde verhindert

Typische Trainingsaufgaben aus dem Repo:
- MQTT-Payload ohne `value`-Feld robust parsen
- Config-Merge mit verschachtelten Default-Werten
- Influx-Punkt-Namen und Einheiten konsistent halten
- Energy-Model: MPPT-Ladung nicht als Hausverbrauch zählen
- Frontend-API-Contract mit stabilen Feldern und Signalen beibehalten

## 5) Verifikationsregeln

Backend:
- Nächstliegender relevanter Pytest-Lauf
- Beispiel:
  - cd backend
  - MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q

Frontend
- Relevanter Build oder Test-Lauf
- Beispiel:
  - cd frontend
  - ./node_modules/.bin/craco build
  - oder gezielter Testlauf

Relevanz
- Bei Energie-/Batterie-/PV-Logik: Datenfluss-Check vor Fix
- Bei UI-Änderungen: Komponente + API-Contract prüfen
- Bei Parser-/Integrations-Änderungen: Test für fehlende oder fehlerhafte Felder

## Empfehlung für die Auswahl

Wenn du nur die Ursache suchst
→ haucklab

Wenn du konkret ändern musst
→ haucklab-fix

Wenn du das Agenten-Setup verbessern willst
→ haucklab-self

Wenn du eine domänenweite Sicherheit/Logikprüfung brauchst
→ solar-app

## Grundsatz

Die Agenten sollen jeweils eine klare Aufgabe übernehmen, statt alles gleichzeitig zu versuchen. Das macht die Zusammenarbeit robuster, verständlicher und besser wartbar.
