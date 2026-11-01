# Rollenvertrag und Handoffs (HauckLab-Skills)

Lies diese Datei, wenn du eine Aufgabe an einen anderen Skill übergibst, eine Übergabe annimmst
oder unklar ist, welcher Skill zuständig ist.

## Rollen

| Skill | Eigentum | Darf nicht |
|---|---|---|
| `haucklab` | Root-Cause-Diagnose und Datenpfad (nur lesen) | ohne ausdrücklichen Fix-Auftrag Dateien ändern |
| `haucklab-fix` | bestätigter Fix, Test, minimale Bereinigung in Backend und Frontend | eine unklare Ursache improvisieren |
| `haucklab-self` | Skill-, Prompt- und Handoff-Qualität | Produktcode ohne Workflow-Auftrag ändern |
| `haucklab-local-apps` | Betrieb der Dienste (systemd, Logs, Update, Backup) | App-Code patchen |
| `haucklab-network` | IP-Plan, Erreichbarkeit, Firewall, Härtung | MQTT-Payloads oder App-Code bewerten |
| `code-reviewer` | Review von Diffs, PRs und Dateien | ungefragt patchen |

## Handoff-Minimum

Jede Übergabe enthält: **Ziel**, **betroffene Dateien**, **Beleg/Datenpfad**,
**Ursache oder Unsicherheit**, **kleinster nächster Schritt**, **Verifikation** und **Lernpunkt**.
Fehlt ein Punkt, bleibt der Empfänger im Analysemodus.

## Lernpunkte

- Gib am Ende eine kurze Lernnotiz in der Antwort aus (Ursache, warum dieser Weg, welche Prüfung schützt).
- Dauerhaft ablegen nur bestätigte Regeln, nie Secrets oder Vermutungen. Bestehende Lernpunkte stehen
  im Projekt-Wiki unter `knowledge/learnings/`; lies sie vor workflowweiten Entscheidungen.
