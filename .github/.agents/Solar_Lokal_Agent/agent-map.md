# Agent-Map für Solar-Lokal-App

> Verbindlicher Vertrag: [`../../solar-lokal-agent-toolbelt.md`](../../solar-lokal-agent-toolbelt.md).
> Domänenregeln und Testbefehle: [`../../solar-lokal-energy-invariants.md`](../../solar-lokal-energy-invariants.md).
> Vor workflow- oder domänenweiten Entscheidungen `/agentmemory` verwenden.

## Überblick

Diese Agenten sind bewusst in klare Rollen aufgeteilt, damit die Arbeit sauber zwischen Analyse, Umsetzung und Agenten-Verbesserung getrennt bleibt.

## 1) Diagnose-Phase

Agent: haucklab.agent.md
- Zweck: Debugging-only / Fehleranalyse (ohne `edit`; Fix-Auftrag geht an haucklab-fix)

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

Agent: haucklab-fix.agent.md
- Zweck: Fix + Update + Cleanup in Backend und Frontend
- Backend-Regeln: [`references/backend.md`](references/backend.md)
- Frontend-Regeln: [`references/frontend.md`](references/frontend.md)

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

Agent: haucklab-self.agent.md
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

Die gültigen Backend- und Frontend-Befehle stehen in
[`../../solar-lokal-energy-invariants.md`](../../solar-lokal-energy-invariants.md#validierung).
`tests/test_solar_dashboard.py` braucht einen laufenden Dienst und wird sonst abgewählt.

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

Wenn du eine Review eines Diffs oder PRs brauchst
→ Skill `Code Reviewer`

## Grundsatz

Die Agenten sollen jeweils eine klare Aufgabe übernehmen, statt alles gleichzeitig zu versuchen. Das macht die Zusammenarbeit robuster, verständlicher und besser wartbar.

## Werkzeuggürtel

Alle Solar-Lokal-Agenten arbeiten mit `read`, `search`, `todo` und `execute`;
`edit` haben nur `haucklab-fix` und `haucklab-self`. Die Extension `solar-lokal-toolbelt` ergänzt
`solar_lokal_memory_read` und `solar_lokal_memory_append`; diese Werkzeuge
werden nur für verifizierte Lernpunkte verwendet. Kein Agent darf Memory als
Ersatz für Codebelege oder Tests behandeln.

## Verbindlicher Handoff

`Ziel | Dateien | Beleg/Datenpfad | Ursache/Unsicherheit | nächster Schritt | Verifikation | Lernpunkt`

Ein Handoff ohne diese sieben Angaben bleibt Analyse und darf nicht automatisch
in einen Fix übergehen.
