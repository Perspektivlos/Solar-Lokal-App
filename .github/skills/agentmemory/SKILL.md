---
name: agentmemory
description: Verwalte verifizierte, dauerhafte Lernnotizen für die Solar-Lokal-Agenten ohne Secrets oder ungeprüfte Vermutungen.
---

# `/agentmemory`

Nutze diesen Skill, wenn eine bestätigte Repo-Regel, ein wiederkehrender Fehler,
ein Handoff-Lernpunkt oder eine Verbesserung des Agenten-Workflows dauerhaft
festgehalten oder nachgelesen werden soll.

## Werkzeugkette

1. Lies zuerst `.github/solar-lokal-agent-toolbelt.md`.
2. Verwende `solar_lokal_memory_read`, bevor du eine vorhandene Regel
   reproduzierst oder eine neue Notiz formulierst.
3. Schreibe mit `solar_lokal_memory_append` nur eine kurze Notiz, wenn sie
   durch Code, Test, Build oder einen klaren Repo-Beleg bestätigt ist.
4. Nutze die Kategorien `workflow`, `domain`, `validation` oder `failure`.

## Grenzen

- Keine Secrets, Tokens, personenbezogenen Daten oder vollständigen Payloads.
- Keine ungeprüften Hypothesen und keine Chat-Zusammenfassungen ohne Lernwert.
- Memory ersetzt weder Tests noch die Projektanweisungen.
- Bei widersprüchlichen Notizen gilt der aktuelle Code und die aktuelle
  Repository-Dokumentation; veraltete Regeln werden als neue Korrektur notiert.

## Notizformat

`Problem/Regel -> Beleg -> sichere Konsequenz`

Beispiel:

`domain: MPPT-DC-Ladung bleibt aus dem Hausverbrauch ausgeschlossen -> test_influx_points.py und server.py -> Frontend darf diesen Wert nicht addieren.`
