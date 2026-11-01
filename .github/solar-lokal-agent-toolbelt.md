# Solar-Lokal-Agentenvertrag und Werkzeuggürtel

Diese Datei ist die gemeinsame Quelle für `.github/.agents/Solar_Lokal_Agent/` und
`.github/skills/Solar Lokal App Bundle/`. Die einzelnen Rollen dürfen sie nicht
durch eigene, widersprüchliche Regeln ersetzen.

Energiemodell, API-Vertrag, MQTT-Entscheidung und gültige Testbefehle stehen in
[`solar-lokal-energy-invariants.md`](solar-lokal-energy-invariants.md).

## Werkzeugkette

1. **read**: relevante Dateien und Tests lesen.
2. **search**: Symbole, Datenpfade, Tests und Verbraucher finden.
3. **todo**: bei mehrstufigen Aufgaben Scope, Abhängigkeiten und Abschluss festhalten.
4. **execute**: den kleinsten passenden Test, Build oder reproduzierbaren Check ausführen.
5. **edit**: nur den bestätigten Scope ändern; keine unabhängigen Nutzeränderungen überschreiben.
6. **solar_lokal_memory_read**: vor einer neuen workflow- oder domänenweiten Entscheidung die bisherigen Lernnotizen lesen.
7. **solar_lokal_memory_append**: nach einer bestätigten neuen Regel, Regression oder Workflow-Verbesserung genau eine kurze Lernnotiz speichern.

Die Memory-Werkzeuge sind absichtlich kein Ersatz für Tests. Sie speichern nur
verifizierte Erkenntnisse, niemals Secrets, Zugangsdaten oder ungeprüfte Vermutungen.

## Rollenvertrag

| Rolle | Eigentum | Darf nicht |
|---|---|---|
| `haucklab` | Root-Cause-Diagnose und Datenpfad (ohne `edit`) | Dateien ändern; bei Fix-Auftrag an `haucklab-fix` übergeben |
| `haucklab-fix` | bestätigter Fix, Test, minimale Bereinigung in Backend und Frontend | eine unklare Ursache improvisieren |
| `haucklab-self` | Agenten-, Prompt- und Handoff-Qualität | Produktcode ohne direkten Workflow-Auftrag ändern |

Die früheren Rollen `backend-specialist`, `frontend-specialist` und `solar-app` sind in
`haucklab-fix` aufgegangen (`.agents/Solar_Lokal_Agent/references/backend.md` und `frontend.md`).
Die Skills unter `skills/Solar Lokal App Bundle/` liefern Abläufe, keine eigenen Rollen.

## Handoff-Minimum

Jede Übergabe enthält: **Ziel**, **betroffene Dateien**, **Beleg/Datenpfad**,
**Ursache oder Unsicherheit**, **kleinsten nächsten Schritt**, **Verifikation**
und **Lernpunkt**. Fehlt ein Punkt, bleibt der Empfänger im Analysemodus.

## Abschlussregeln

- Antwort, Handoff und Memory-Notiz auf Deutsch; Code- und API-Namen bleiben unverändert.
- API-Verträge, Herkunftsmarker, local-first Verhalten und Energiemodell bleiben stabil.
- `execute` läuft nach der ersten substanziellen Änderung und erneut vor dem Abschluss.
- Bei fehlender Umgebung wird das klar von einem Codefehler getrennt.
