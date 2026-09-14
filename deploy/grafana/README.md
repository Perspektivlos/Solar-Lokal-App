# Grafana · Solar SCADA Control Room

Grafana-Dashboard im Design der App (Dark/SCADA, gleiche Neon-Farben: PV=Gelb, Netz=Orange/Rot/Grün, Akku=Cyan, Haus=Silber) für die vom Poller nach InfluxDB geschriebenen Daten.

## Variante A · Auto-Provisioning (empfohlen, kein manueller Import)
Rollt Datasource **und** Dashboard automatisch aus.

```bash
cd deploy/grafana
export INFLUX_URL="http://192.168.0.203:8086"
export INFLUX_ORG="Solar Lokal"
export INFLUX_BUCKET="solar"
export INFLUX_TOKEN="<dein-influxdb-token>"
# optional: GF_ADMIN_USER / GF_ADMIN_PASSWORD
docker compose up -d
```
Grafana läuft dann auf `http://<host>:3000` – die Datasource *InfluxDB Solar* (`uid: influxdb-solar`) und das Dashboard *Solar · SCADA Control Room* (Ordner „Solar") sind sofort da.

Struktur:
```
provisioning/
  datasources/influxdb.yml        # InfluxDB-Flux-Datasource (uid influxdb-solar), Werte aus ENV
  dashboards/dashboards.yml       # Dashboard-Provider (lädt json/*)
  dashboards/json/solar-scada.json# Dashboard (feste Datasource-uid, ohne Import-Prompt)
docker-compose.yml                # Grafana-Service mit Provisioning-Mount + ENV
```

> `GF_SECURITY_ALLOW_EMBEDDING=true` ist gesetzt, damit Grafana später per iframe in die App eingebettet werden kann.

## Variante B · Manueller Import
Datei `solar-scada-dashboard.json` in Grafana unter **Dashboards → New → Import** hochladen und beim Import die InfluxDB-Datasource wählen. Danach oben die Variablen **Bucket** und **Modus** (live|demo) setzen.

## Variablen
- **Bucket**: InfluxDB-Bucket (Default `solar`).
- **Modus**: `live` (echte Daten) oder `demo` (simuliert). Der Poller taggt jeden Punkt mit `mode`.

## InfluxDB-Measurements (vom Poller geschrieben)
`solar` (inkl. `grid_import_w`/`grid_export_w`/`autarky_pct`/`self_consumption_pct`),
`shelly` + `shelly_phase` (tag `phase`), `hoymiles` + `hoymiles_ch` (tag `ch`),
`victron` + `victron_mppt` (tag `mppt`), `trucki` (inkl. `ac_setpoint`/`target`/`min_power`/`max_power`/`ac_output`),
`alarms` (`total`/`critical`/`warning`/`level`).
Alle Punkte tragen den Tag `mode` = `demo` | `live`.
