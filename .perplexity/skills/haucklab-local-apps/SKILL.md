---
name: haucklab-local-apps
description: "Betrieb der lokalen HauckLab-Dienste: Solar-Lokal-App (Proxmox CT <APP_CT_ID>), Mosquitto, Venus OS/Victron, Shelly Pro 3EM, AhoyDTU/HM-1500, Trucki T2SG, InfluxDB, Grafana, Node-RED. Verwenden für Installation, Konfiguration, Update, Neustart, Logs, Backup oder 'Dienst läuft nicht'. Nicht für Code-Bugs in der App (dafür haucklab/haucklab-fix) oder reine Netzwerkfehler (haucklab-network)."
metadata:
  author: HauckLab - THCoding
  version: '1.0'
---

# HauckLab Lokale Apps

## Grundregeln

- IPs und Ports kommen aus dem Skill `haucklab-network` (`references/ip-plan.md`). Lade ihn, wenn eine Adresse gebraucht wird.
- Lokal-first: keine Cloud-Dienste, keine Google-AI-Studio-/Gemini-Abhängigkeiten einführen.
- Secrets nur über `.env` bzw. `/etc/solar-app/`; nie im Klartext ausgeben oder committen. Für Git-Pushes `gh` oder SSH, nie Token in der URL.
- Energiemodell DC-gekoppelt: Victron MPPT lädt die Batterie (kein Hausverbrauch), HM-1500 liefert AC-PV, Trucki = Batterieentladung, Shelly = Netzbezug/-einspeisung.
- Gib vollständige, kopierbare Befehle und Konfigurationsdateien aus; erst einen Dienst testen, dann erweitern.

## Dienst-Diagnose

1. Dienst und Host bestimmen (Tabelle unten).
2. Status: `systemctl status <unit>` bzw. `pct exec <APP_CT_ID> -- systemctl status solar-lokal`.
3. Logs: `journalctl -u <unit> -n 100 --no-pager`.
4. Datenfluss prüfen: `mosquitto_sub -h 192.168.0.201 -u <MQTT_APP_USER> -P "$MQTT_PASSWORD" -t '#' -v -C 20`.
5. App-Sicht: `curl -s http://192.168.0.222/api/telemetry/live` und `/api/health/hosts`.
Abgeschlossen, wenn der Dienst läuft und seine Daten in `/api/telemetry/live` ankommen.

| Dienst | Host | Unit / Zugriff |
|---|---|---|
| Proxmox | .200 | `pct`, `pve-firewall`, Web-UI :8006 |
| Solar-Lokal-App | CT <APP_CT_ID> (.222) | `solar-lokal`, nginx, `.env` im App-Verzeichnis |
| Mosquitto | .201 | `mosquitto`, `/etc/mosquitto/conf.d/` |
| InfluxDB | .203 | `influxdb`, Bucket `solar` |
| Grafana | .202 | `grafana-server` |
| Venus OS | Raspberry Pi (.111) | MQTT-Bridge zu .201, Topics `N/b827eb79321c/...` |

Lies `references/runbooks.md` bei typischen Fehlerbildern (MQTT getrennt, Venus `simulated`, CA fehlt, Shelly/AhoyDTU leer) und für Update-, Backup- und Neuinstallationsschritte.

## Repos

- `Perspektivlos/Solar-Lokal-App` (produktiv) und `Perspektivlos/Solar-App` (umfangreiche UI, Daten bisher simuliert). Änderungen als Branch + PR, nie direkt auf `main`.
