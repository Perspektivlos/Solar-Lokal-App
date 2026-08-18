# Agent-Map für Solar-Lokal-App

## Überblick

Diese Agenten sind bewusst in klare Rollen aufgeteilt, damit die Arbeit sauber zwischen Analyse, Umsetzung und Agenten-Verbesserung getrennt bleibt.

## 1) haucklab

Zweck: Debugging-only / Fehleranalyse

Verwendung bei:
- Root-Cause-Analyse
- Fehlerursachen im Energiefluss suchen
- MQTT-Parsing-Fehler verstehen
- Backend- oder Frontend-Regression analysieren
- Ursache eines Problems nachverfolgen, ohne sofort zu refaktorieren

Typische Prompts:
- "Warum ist die Batterieanzeige falsch?"
- "Analysiere den Fehler im MQTT-Parsing."
- "Finde die Ursache für die fehlerhafte PV-Berechnung."

## 2) haucklab-fix

Zweck: Fix + Update + Cleanup

Verwendung bei:
- Codeänderungen und Fehlerbehebungen umsetzen
- Regressionsfehler beheben
- Struktur und Code aufräumen
- Tests oder kleine Refactors ergänzen
- Projektelemente aktuell halten

Typische Prompts:
- "Behebe den Fehler und passe den betroffenen Bereich an."
- "Räume die MQTT-Logik auf und behalte das Systemverhalten intakt."
- "Verbessere die Maintainability ohne das Modell zu verändern."

## 3) haucklab-self

Zweck: Selbstanalyse zur Agenten-Eigenentwicklung

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

## Empfehlung für die Auswahl

- Wenn du nur die Ursache einer Fehlfunktion willst: haucklab
- Wenn du die Ursache identifiziert hast und jetzt konkret ändern willst: haucklab-fix
- Wenn du die Agentenstrategie, Rollen oder Prompt-Qualität verbessern willst: haucklab-self

## Grundsatz

Die Agenten sollen jeweils eine klare Aufgabe übernehmen, statt alles gleichzeitig zu versuchen. Das macht die Zusammenarbeit robuster, verständlicher und besser wartbar.
