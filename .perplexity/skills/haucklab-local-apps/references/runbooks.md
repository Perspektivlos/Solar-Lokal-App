# Runbooks Lokale Apps

## Fehlerbilder
| Symptom | Ursache | Maßnahme |
|---|---|---|
| `mqttConnected: false` mit `:8883` | TLS ist nicht aktiv | `MQTT_URL="mqtt://192.168.0.201:1883"` in `.env`, `systemctl restart solar-lokal` |
| „CA-Datei fehlt" | `MQTT_CA_FILE` gesetzt, obwohl TLS aus ist | `MQTT_CA_FILE` aus `.env` entfernen, Neustart |
| `venus: simulated` | keine `N/b827eb79321c/solarcharger/...` | Venus-MQTT-Bridge zu .201 und ACL für `<MQTT_APP_USER>` prüfen; Keepalive `R/b827eb79321c/keepalive` senden |
| Shelly leer | HTTP-Fallback scheitert | `curl http://192.168.0.100/rpc/EM.GetStatus?id=0` |
| HM-1500 leer | AhoyDTU nicht erreichbar / nachts aus | `curl http://192.168.0.101/api/inverter/id/0` |

## Update Solar-Lokal-App (CT <APP_CT_ID>)
```bash
pct enter <APP_CT_ID>
cd /opt/solar-lokal-app && git pull --ff-only
# Backend: pip install -r backend/requirements.txt ; Frontend: npm ci && npm run build
systemctl restart solar-lokal && systemctl reload nginx
curl -s http://127.0.0.1/api/telemetry/live | head -c 300
```
Pfad `/opt/solar-lokal-app` vorher mit `systemctl cat solar-lokal` bestätigen.

## Backup
- Proxmox: `vzdump <APP_CT_ID> --mode snapshot --compress zstd --storage <backup-storage>`
- InfluxDB: `influx backup /root/influx-$(date +%F)`
- Mosquitto: `/etc/mosquitto/` sichern (ohne Passwörter in Git).
- Node-RED: `~/.node-red/flows*.json` exportieren.
