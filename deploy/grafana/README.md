# Grafana-Dashboard · Solar SCADA Control Room

Dashboard-JSON im Design der App (Dark/SCADA, gleiche Neon-Farben: PV=Gelb, Netz=Orange/Rot/Grün, Akku=Cyan, Haus=Silber) für die vom Poller nach InfluxDB geschriebenen Daten.

## Import
1. Grafana → **Dashboards → New → Import**.
2. Datei `solar-scada-dashboard.json` hochladen (oder Inhalt einfügen).
3. Beim Import die **InfluxDB-Datasource** auswählen (`DS_INFLUXDB`).
4. Nach dem Import oben die Variablen setzen:
   - **Bucket**: dein InfluxDB-Bucket (Default `solar`).
   - **Modus**: `live` (echte Daten) oder `demo` (simulierte Daten). Der Poller taggt jeden Punkt mit `mode`.

> Voraussetzung: InfluxDB 2.x als **Flux**-Datasource. Der Bucket muss dem in der App unter *Integrationen* konfigurierten Bucket entsprechen.

## Panels
- **Übersicht**: Leistungsfluss (PV/Haus/Netz/Akku), Autarkie, Eigenverbrauch, Akku-SoC.
- **Netz (Shelly)**: Phasenspannung & Phasenleistung (L1–L3).
- **PV (Hoymiles/Victron)**: Hoymiles-Kanäle, Victron-MPPT PV-Leistung.
- **Speicher (Trucki)**: Vbat/SoC, Setpoint/Target/Min/Max.
- **Status/Alarme**: aktueller Status (OK/WARNUNG/ALARM) + Alarm-Verlauf (level 0/1/2).

## InfluxDB-Measurements (vom Poller geschrieben)
`solar` (inkl. `grid_import_w`/`grid_export_w`/`autarky_pct`/`self_consumption_pct`),
`shelly` + `shelly_phase` (tag `phase`), `hoymiles` + `hoymiles_ch` (tag `ch`),
`victron` + `victron_mppt` (tag `mppt`), `trucki` (inkl. `ac_setpoint`/`target`/`min_power`/`max_power`/`ac_output`),
`alarms` (`total`/`critical`/`warning`/`level`).
Alle Punkte tragen den Tag `mode` = `demo` | `live`.
