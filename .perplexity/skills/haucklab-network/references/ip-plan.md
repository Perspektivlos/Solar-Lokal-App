# IP-Plan HauckLab (192.168.0.0/24)

Spalten: name | ip | port | protokoll | status

| name | ip | port | protokoll | status |
|---|---|---|---|---|
| shelly-pro-3em | 192.168.0.100 | 80 | http (`/rpc/EM.GetStatus?id=0`) | bestätigt |
| ahoydtu-hm1500 | 192.168.0.101 | 80 | http (`/api/inverter/id/0`) | bestätigt |
| proxmox | 192.168.0.200 | 8006 | https | bestätigt |
| mosquitto | 192.168.0.201 | 1883 | mqtt (ohne TLS, aktiver Standard) | bestätigt |
| grafana | 192.168.0.202 | 3000 | http | bestätigt |
| influxdb | 192.168.0.203 | 8086 | http (Org „Solar Lokal“, Bucket `solar`) | bestätigt |
| solar-lokal-app | 192.168.0.222 | 80 | http (CT <APP_CT_ID>, nginx; früher .220) | bestätigt |
| venus-os-rpi | 192.168.0.111 | 1883 | mqtt-bridge zu .201, Portal-ID `b827eb79321c` | bestätigt |
| trucki-t2sg | 192.168.0.102 | 80 | http/mqtt | bestätigt |

Health-Check der App: `curl -s http://192.168.0.222/api/health/hosts`

MQTT-TLS (8883) ist nicht aktiv. Nur 1883 verwenden, bis TLS ausdrücklich eingerichtet wird.
