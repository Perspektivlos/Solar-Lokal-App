# Perplexity-Skills (Spiegel)

Kopie der aktiven Perplexity-Computer-Skills für dieses Projekt, Stand 2026-11-01.
Maßgeblich bleiben die Skills in Perplexity; dieser Ordner dient der Versionierung und Nachvollziehbarkeit.

## Anonymisierung

Das Repository ist öffentlich. Vor dem Spiegeln wurden ersetzt:

| Platzhalter | Bedeutung |
|---|---|
| `<MQTT_APP_USER>` | MQTT-ACL-User der App (lesend) |
| `<MQTT_SHELLY_USER>` | MQTT-ACL-User für Shelly (schreibt `shellies/#`) |
| `<MQTT_DTU_USER>` | MQTT-ACL-User für AhoyDTU (schreibt `ahoy/#`) |
| `<APP_CT_ID>` | Proxmox-Container-ID der Solar-Lokal-App |

Passwörter, Tokens und Schlüssel sind in keinem Skill enthalten. Beim Zurückspielen nach Perplexity
die Platzhalter wieder durch die echten Werte ersetzen.

## Rollen

Siehe `.github/solar-lokal-agent-toolbelt.md`: `haucklab` (Diagnose), `haucklab-fix` (Umsetzung),
`haucklab-self` (Agenten-Qualität), `haucklab-local-apps` (Betrieb), `haucklab-network` (Netz).
