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
- ✅ Grafana-Dashboard erweitert: 8. Panel **"Autarkie heute"** (Gauge %, Flux union/pivot: (Hausenergie − Netzbezug)/Hausenergie).
- ✅ Refactoring: MQTT-Logik aus `server.py` in eigenes Modul `backend/mqtt_client.py` ausgelagert (Daten-Store, Topic-Handler, fetch_*_from_mqtt, _mqtt_setup/_disconnect). server.py 1347 → ~960 Zeilen. Lint sauber, 29/29 Tests grün (inkl. neue `tests/test_mqtt_client.py`).

## Backlog (P1/P2)
- P1: Victron VenusOS Large – konkretes Parsing der MPPT-Endpunkte (D-Bus REST), aktuell generisch.
- P1: MQTT Topic-Mapping zu Live-Werten (statt nur Counter).
- P2: Authentication (optional, bisher keine).
- P2: Konfiguration exportieren/importieren (JSON).
- P2: Push-Benachrichtigung bei Übergang Bezug ↔ Einspeisung.
- P2: Wochen-/Monats-Verlauf + CSV-Export.

## UI-Feinschliff (2026-06)
- KPI-Tagesleiste: an GlassCard-Stil angeglichen (linker Akzentbalken + dezenter Glow je Kennzahl), fügt sich ins Gesamtbild ein.
- Energiefluss-Labels: Watt-Werte durch Richtungspfeile (Flussrichtung) auf der Linienmitte ersetzt – weniger Zahlen-Dopplung, klare Richtungsanzeige.
- Hoymiles HM1500: Anzeige immer CH1–CH4 (statt aggregiertem CH0); Per-Kanal-Werte aus `HM1500/ch1..4/*`-Topics, sonst 0.
- Akku-„ENTLÄDT"-Bereich bewusst unverändert (User-Wunsch).
- Lint/Code: `Date.now()`-Purity-Blocker behoben (Uhr inkrementell + Lazy-Init), Vorwert von useRef → useState (reineres Render), `relativeTime(iso, now)`.

## UI/Design-Iteration 2 (2026-06)
- KPI-Tagesleiste: ein zusammenhängendes Raster mit abgesteckten Bereichen (Trennlinien `divide-*` + farbiger Top-Akzent je Segment) statt einzelner Karten.
- Gesamtbild: Hintergrund tiefes Schwarz → Dunkelblau, dynamisch gemischt via `body::before` (radiale Blau-/Silber-Glows, langsame `bg-drift`-Animation). Karten-/Glass-Schatten auf Weiß/Silber-Halo umgestellt (`.glass`, `.glass-strong`, GlassCard boxShadow).
- Versionsnummer automatisch: `craco.config.js` setzt `process.env.REACT_APP_VERSION` aus `package.json` (→ Footer `v{version}`). package.json auf 1.2.0 gebumpt; Version wird in den Production-Build eingebacken.
- Footer: „Made with Emergent" verschoben (floating `#emergent-badge` ausgeblendet), Copyright „© THcentral.de".
- InfluxDB-Anleitung: Hinweis ergänzt, dass InfluxDB bereits als LXC (ID 101, 192.168.0.203:8086) läuft → Install-Script optional, nur Org/Bucket/Token sicherstellen.

## Bugfix: Netz/Akku identische Werte (2026-06)
- Ursache: `fetch_trucki_from_mqtt()` leitete `battery_power` aus `Trucki/METER` ab. METER ist laut Trucki2Shelly-Doku der Netz-/Zähler-Messwert (Feedback-Signal vom Shelly Pro 3EM) → identisch zu `summary.grid_power`. Auf echter Hardware zeigten Netz und Akku denselben Wert.
- Fix: `battery_power` kommt jetzt aus `Trucki/ACDISPLAY` (Ist-WR-Ausgang), Fallback `Trucki/ACSETPOINT`. Entladen → negativ, 0 wenn STATE != ON. METER bleibt separat als `grid_meter_w`. SoC-Lastkompensation nutzt ebenfalls die WR-Ausgangsleistung.
- 3 Regressionstests ergänzt (test_mqtt_client.py), Testing-Agent: Backend+Frontend 100% grün, Netz/Akku im Energiefluss klar unterschiedlich.

## Feature: Autarkie-Ziel-Kachel + Cleanup (2026-06)
- Neue Dashboard-Kachel „Autarkie heute · Ziel-Fortschritt" (`AutarkyGoal.jsx`): Ring-Fortschritt der heutigen Eigendeckung gegen ein konfigurierbares Ziel, Aufschlüsselung (Eigenverbrauch %, selbst genutzt kWh), Fortschrittsbalken mit Ziel-Markierung und Inline-Ziel-Editor (±5 %).
- Backend: `goals.autarky_pct` (Default 70) in `DEFAULT_CONFIG` + Merge + `ConfigUpdate`. `PUT /api/config` startet Integrationen nur noch neu, wenn verbindungsrelevante Keys ({demo_mode, devices, mqtt, victron_mqtt, influx}) geändert werden → Ziel-Tweaks lassen die MQTT-Session bestehen.
- Cleanup: ungenutzte shadcn-Dateien `carousel.jsx`, `calendar.jsx`, `command.jsx` gelöscht → 4 blockierende Lint-Fehler entfernt.
- Tests: `test_config_goals.py` (6) ergänzt; Testing-Agent Backend+Frontend je 100%.

## Grafana/InfluxDB-Ausbau + Victron-Bestätigung (2026-06)
- InfluxDB-Write erweitert (`_build_influx_points` in server.py): schreibt jetzt pro Poll-Zyklus reiche Measurements – `solar` (inkl. momentanem `autarky_pct`/`self_consumption_pct`), `shelly_phase` (L1–L3), `shelly`, `hoymiles`, `hoymiles_ch` (CH1–4), `victron`, `victron_mppt` (pro Instanz, inkl. `state`), `trucki` (vbat/ac_power/soc/zepc/temperature/setpoint/energy).
- Zweites Grafana-Dashboard `solar-devices-dashboard.json` (UID `solar-geraete`): gerätespezifische Zeilen (Shelly-Phasen, Hoymiles-Kanäle, Victron-MPPTs, Trucki, Autarkie/Eigenverbrauch-Verlauf). Verlinkt mit dem Übersichts-Dashboard.
- SETUP-Doku (`INFLUXDB-GRAFANA-SETUP.md`): Datenmodell-Tabelle, Zwei-Dashboard-Import, Retention aktualisiert.
- Victron: Topics vom User als korrekt bestätigt (`N/<vrm>/solarcharger/<inst>/…`), bleibt rein MPPT-Solar → Parsing unverändert; Victron-Daten fließen jetzt zusätzlich pro MPPT nach InfluxDB/Grafana.
- Tests: `test_influx_points.py` (5) – Measurements/Autarkie-Berechnung/Offline-Skip. Gesamt 42 pytest grün.

## Grafana Check & Repair + App-Style (2026-06)
- **Repair Org-Mismatch:** Echte InfluxDB-Org des Users ist `Solar Lokal` (nicht `home`). `influxdb-datasource.yaml` (Provisioning) auf Org `Solar Lokal` + URL + echten Token gesetzt; SETUP-Doku (Schritt 1/2/3 + Fehlerbehebung) durchgehend auf `Solar Lokal` umgestellt.
- **Check & Repair-Sektion** in der Doku: Hinweis, dass im Data Explorer nur die 5 alten Felder erscheinen, solange die Backend-LXC 220 auf der Vor-Ausbau-Version läuft → `git pull` + `systemctl restart solar-backend` nötig, damit `autarky_pct`/`self_consumption_pct` + Measurements `shelly_phase/hoymiles/hoymiles_ch/victron/victron_mppt/trucki` geschrieben werden.
- **Design-Optimierung (App-Look):** Beide Grafana-Dashboards neu gestylt – transparente Panels (`transparent:true`), `style:dark`, App-Neon-Palette (PV #FACC15, Netz-Bezug #F87171, Einspeisung/Autarkie #10B981, Akku/Cyan #06B6D4, Haus #cbd5e1, Orange #FB923C), weiche Gradient-Linien, Emojis aus Titeln entfernt, Cross-Links zwischen Übersicht (`solar-lokal`) und Geräte-Detail (`solar-geraete`).

## Bugfix: Hoymiles-Parser + DC-gekoppeltes Energiemodell (2026-06)
- **Hoymiles-Kachel repariert:** AhoyDTU publiziert je Kanal ein JSON-Objekt unter `HM1500/ch1..ch4` (DC) bzw. `HM1500/ch0` (AC), plus `HM1500/total` und `HM1500/ack_pwr_limit`. Der alte Parser suchte flache Keys `HM1500/chN/P_DC` und `power_limit_read` → Kanäle 0, Limit 100 %. `fetch_ahoy_from_mqtt` liest jetzt die JSON-Objekte korrekt (CH1–CH4 P_DC/U_DC/I_DC/YieldDay, Limit aus `ack_pwr_limit`).
- **Verbrauch/Energiemodell korrigiert (DC-Kopplung, vom User bestätigt):** Victron-MPPTs laden den Akku (DC), Hoymiles speist AC ins Haus, Trucki/SUN entlädt den Akku ins AC-Netz. Neue Haus-Formel: `house = pv_ac (Hoymiles) + battery_discharge (SUN) + grid`. Vorher wurde die Victron-Ladeleistung fälschlich als Hausversorgung mitgezählt (Verbrauch ~4558 statt ~1760 W).
- **Neue Summary-Felder:** `pv_ac_power`, `pv_dc_power`, `battery_charge_w` (MPPT), `battery_discharge_w` (SUN), `battery_power` (netto). Auch in InfluxDB-Write aufgenommen.
- **Frontend:** Energiefluss DC-gekoppelt (PV→Haus, PV→Akku laden Diagonale, Akku→Haus entladen); Akku-Kachel zeigt Laden (MPPT) & Entladen (SUN) getrennt (User-Wunsch Option c).
- Tests: +3 (Ahoy JSON-Kanäle, ch0-Fallback), gesamt 44 pytest grün; Testing-Agent Backend+Frontend 100 %.

## Next Tasks
- P1: Telegram-Bot für SoC-Warnungen (Push bei niedrigem Akku/Statuswechsel).
- P1: Forecast vs. Ist-Vergleich (Vergleichskarte auf dem Dashboard).
- P2: Erweiterte Wettervorhersage (Wind, Niederschlag).
- Reale Victron-Endpunkte je nach VenusOS-Setup anpassen.

## Deployment-Härtung (2026-06)
- `deploy/proxmox/build-app.sh`: Backend-Service wird jetzt VOR dem Frontend-Build aktiviert/gestartet → ein Frontend-Build-Fehler lässt das Backend nicht mehr „dead". RAM-Check + `NODE_OPTIONS=--max-old-space-size=2048` + OOM-Hinweise ergänzt.
- `frontend/craco.config.js`: ESLint-Override nur noch im Dev-Server (Production-Build lässt `eslint`-Key weg). Hinweis: craco gibt bei `DISABLE_ESLINT_PLUGIN=true` weiterhin die harmlose Log-Zeile „Cannot find ESLint plugin (ESLintWebpackPlugin)" aus – NICHT fatal, Build läuft mit EXIT 0 durch.
- Auf User-LXC 220 verifiziert: Frontend-Build erfolgreich (~19s, kein Memory-Limit), Backend `active (running)`, Live-/History-Endpunkte liefern 200 OK im Browser.