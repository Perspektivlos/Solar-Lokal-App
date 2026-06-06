# Solar Lokal-Dashboard – PRD

## Problem Statement (Original)
Modernes Dashboard für Solarenergie im lokalen Netzwerk, um Daten abzurufen, Geräte zu steuern und zu konfigurieren. Geräte:
- Shelly Pro 3EM (192.168.0.100) – 3-Phasen Energiemesser
- Hoymiles HM1500 in Ahoy DTU (192.168.0.101)
- Trucki2Shelly Gateway (192.168.0.102)
- 2x Victron SmartSolar MPPT 150/35 in VenusOS Large (192.168.0.111)
- Mosquitto MQTT Broker (192.168.0.201)
- InfluxDB (192.168.0.203)

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), Motor (MongoDB async), httpx, paho-mqtt, influxdb-client.
- **Frontend**: React 19 + Vite/CRA, React Router, Recharts, shadcn/ui, IBM Plex Sans/Mono.
- **DB**: MongoDB (collections: `config`, `snapshots`).
- **Background**: Poller asyncio task → Snapshot alle 15s.
- **Design**: Swiss/Control-Room (schwarze Linien, Gelb=PV, Rot=Bezug, Grün=Einspeisung, Blau=Akku, deutsche Oberfläche).

## Personas
- Solar-Anlagenbesitzer im Heimnetz (lokale Steuerung, keine Auth nötig).

## Core Requirements
- Live-Daten aller Geräte aggregiert (3-Phasen, 4 Kanäle, SoC, 2 MPPTs)
- Energiefluss-Visualisierung (animiertes SVG)
- Historie (Recharts, 1h/6h/12h/24h)
- Tageswerte mit Trapez-Integration (kWh PV/Verbrauch/Bezug/Einspeisung, Autarkie %)
- Geräte-Konfig (IP, enabled, Demo-Modus)
- Steuerung Hoymiles (Limit/Power/Start/Stop/Restart) & Trucki (AC/ZEPC/Restart)
- MQTT-Subscriber & InfluxDB-Writer mit UI-Konfig + Live-Status
- Demo-Modus als Default für Cloud-Demo (Mock-Generatoren)

## Implemented (2026-02)
- ✅ Backend Endpoints: /api/live, /api/history, /api/today, /api/config (GET/PUT), /api/control/hoymiles, /api/control/trucki, /api/integrations/status, /api/diagnostics/run, /api/diagnostics/raw
- ✅ Mock-Generatoren mit realistischer Sonnen-Kurve, 3-Phasen-Last, Akku-SoC
- ✅ Echte Fetcher (Shelly /rpc/EM.GetStatus, Ahoy /api/live + /api/inverter, Trucki /status, Victron /api/v1/system) mit Fallback
- ✅ Background-Poller 15s + MongoDB Snapshots + optional InfluxDB-Write
- ✅ MQTT Subscriber (paho) mit Topic-Prefix + Victron-Bridge (N/<vrm>/solarcharger/<inst>/#)
- ✅ Zentraler _mqtt_data Store für ALLE 4 Geräte aus MQTT (Ahoy/Shelly/Trucki/Victron)
- ✅ Trucki SoC-Schätzung aus VBAT (LiFePO4 16S linear)
- ✅ Frontend: Dashboard, Verlauf, Steuerung, Geräte, Diagnose, Integrationen
- ✅ Energiefluss-SVG (animierte stroke-dasharray + Watt-Labels + accent bars)
- ✅ Tageswerte-Karten mit Mini-Sparklines (kWh + Autarkie/Eigenverbrauch %, 0–100 clamped)
- ✅ Live-Cards mit Trend-Deltas (▲/▼), Sparklines, Datenquellen-Badge (MQTT/LIVE/DEMO/FALLBACK)
- ✅ Diagnose-Seite: Selbst-Test (Backend/MongoDB/Poller/MQTT/Influx/4 Geräte) + Geräte-Rohdaten-Tabellen
- ✅ Proxmox LXC Deployment-Scripts: /app/deploy/proxmox/{pve-create-lxc.sh, install.sh, build-app.sh, README.md}
- ✅ Tests: 22/22 backend tests grün (Iteration 1+2+3)
- ✅ Iteration 4 Design: Dark Glassmorphism (#0f172a + radial Yellow/Cyan-Glow), Neon-Akzente (PV gelb, Bezug rot, Einspeisung emerald, Akku cyan), Neon-Drop-Shadows auf Recharts-Linien, neumorphische Buttons, IntroCard mit zusammenklappbarer Doku pro Tab (Zweck/Parameter/Rückgabe/Beispiele/Fehler/Einschränkungen)

## Mocked vs. Live
- **MOCKED** im Demo-Modus: Shelly, Ahoy, Trucki, Victron-Werte aus Generatoren (Sonnen-Kurve, 3-Phasen-Last, SoC).
- **LIVE** sobald Demo-Modus deaktiviert + IPs erreichbar: Direkter HTTP-Abruf.

## Implemented (2026-06)
- ✅ InfluxDB + Grafana Langzeit-Analyse Setup (P0):
  - `deploy/proxmox/pve-create-influxdb-lxc.sh`: InfluxDB-2.7-LXC (Default CT 203 / 192.168.0.203), Auto-Setup Org `home`, Bucket `solar`, generierter API-Token, Repo-Key SHA256-verifiziert.
  - `deploy/proxmox/grafana/solar-influxdb-dashboard.json`: fertiges Grafana-Dashboard (Flux), 7 Panels (PV/Netz/Haus/SoC-Gauge, Leistungsfluss, SoC-Verlauf, Energie-kWh via integral). Nutzt `__inputs` → Datenquelle beim Import wählbar.
  - `deploy/proxmox/grafana/influxdb-datasource.yaml`: optionale Grafana-Provisionierung.
  - `deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md`: Schritt-für-Schritt-Guide für bestehende Grafana (LXC 102, 192.168.0.91:3000).
  - Schema-Match bestätigt: Backend schreibt Measurement `solar`, Felder pv_power/grid_power/battery_power/house_power/battery_soc.

## Backlog (P1/P2)
- P1: Victron VenusOS Large – konkretes Parsing der MPPT-Endpunkte (D-Bus REST), aktuell generisch.
- P1: MQTT Topic-Mapping zu Live-Werten (statt nur Counter).
- P2: Authentication (optional, bisher keine).
- P2: Konfiguration exportieren/importieren (JSON).
- P2: Push-Benachrichtigung bei Übergang Bezug ↔ Einspeisung.
- P2: Wochen-/Monats-Verlauf + CSV-Export.

## Next Tasks
- Testen mit echten Geräten (Demo-Modus aus) zuhause.
- Reale Victron-Endpunkte je nach VenusOS-Setup anpassen.
