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

## Panels (7 Reihen, 42 Panels · Design der App)
Generiert aus `_generate_dashboard.py` (schema-konsistent, reproduzierbar) – bei Änderungen Skript anpassen und neu ausführen:
```bash
cd deploy/grafana && python3 _generate_dashboard.py   # schreibt beide JSON-Dateien identisch
```

1. **Leistungsübersicht** – Leistungsfluss PV/Haus/Netz/Akku (Timeseries), Akku-SoC (**D3 Gauge**), KPI-Leiste (6× **Stat**: PV/Netz/Akku/Haus/Autarkie/Eigenverbrauch).
2. **Effizienz & Netzbilanz** – Autarkie & Eigenverbrauch (2× **D3 Gauge** + Verlauf), Netz Bezug vs. Einspeisung (gestapelt), Hausversorgungs-Mix (Piechart).
3. **Netz · Shelly Pro 3EM** – Phasen-Leistung/-Spannung/-Strom (L1–L3) + Leistungsfaktor.
4. **PV · Hoymiles HM1500** – Kanal-Leistung/-Spannung, Kanal-Ertrag heute (Bargauge), Power-Limit (**D3 Gauge**), Gesamt-AC.
5. **PV · Victron SmartSolar MPPT** – MPPT PV-Leistung/-Spannung, Ertrag heute (Bargauge), **MPPT-Ertrag · Pareto**, Akku-Spannung je MPPT.
6. **Speicher · Trucki2Shelly** – Vbat & SoC, Steuerung (AC/Setpoint/Target/Min/Max), Ertrag heute/gesamt + Temperatur (Stat).
7. **Status · Alarme** – Alarm-Status-Verlauf (State-Timeline OK/Warnung/Alarm), Kritisch-/Warn-Zähler (Stat).

Design: Dark/SCADA, Neon-Farben (PV=Gelb `#FACC15`, PV-DC=Orange `#F59E0B`, Netz-Bezug=Rot, Einspeisung=Grün, Akku=Cyan `#06B6D4`, Haus=Silber). Variablen **Bucket** + **Modus** (live|demo) oben.

### Genutzte Grafana-Plugins
- **Stat** (Built-in) · **D3 Gauge** (`briangann-gauge-panel`) · **Pareto Chart** (`isaozler-paretochart-panel`)
- Built-ins: Timeseries, Bargauge, Piechart, State-Timeline, Gauge.

### Weitere installierte Plugins (optional ergänzbar)
Diese Plugins sind installiert und können bei Bedarf eingehängt werden (Panel-`type` jeweils angegeben); da ihre Options-Schemata gerätespezifisch sind, bitte in Grafana final konfigurieren:
- **SCADAvis Synoptic Panel** (`scadavis-synoptic-panel`) – Synoptik/Energiefluss-Mimik; eigenes SVG + Werte-Bindings. Ideal als zweites „Leistungsfluss"-Panel analog zur App.
- **Flow** (`andrewbmchugh-flow-panel`) / **Solar Flow** – animierter Energiefluss auf Basis eines SVG.
- **Arc Diagram** – Verteilungs-/Flussdarstellung (z. B. Erzeuger→Verbraucher).
- **Gantt** (`marcusolsson-gantt-panel`) – Zeitbalken; sinnvoll sobald Alarm-Events mit Start/Ende als Tabelle vorliegen (aktuell liefert `alarms` nur den Level-Zeitverlauf → State-Timeline).
- **Grafmaid** – Mermaid-Diagramme für statische Anlagen-Topologie.

Panel hinzufügen: im Dashboard **Add → Visualization**, Typ wählen, Datasource *InfluxDB Solar*, Flux-Query im gleichen Stil wie die bestehenden Panels (`r._measurement`, `r._field`, `r.mode == "${mode}"`).

## InfluxDB-Measurements (vom Poller geschrieben)
`solar` (inkl. `grid_import_w`/`grid_export_w`/`autarky_pct`/`self_consumption_pct`),
`shelly` + `shelly_phase` (tag `phase`), `hoymiles` + `hoymiles_ch` (tag `ch`),
`victron` + `victron_mppt` (tag `mppt`), `trucki` (inkl. `ac_setpoint`/`target`/`min_power`/`max_power`/`ac_output`),
`alarms` (`total`/`critical`/`warning`/`level`).
Alle Punkte tragen den Tag `mode` = `demo` | `live`.
