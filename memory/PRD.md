# Solar Local Dashboard – Product Requirements

## Original Problem Statement
Modernes Dashboard für Solarenergie im lokalen Netzwerk. Funktions-Einstellungen/Tests und Geräte steuern/verwalten.
Geräte: ShellyPro 3EM, Hoymiles HM1500 (AhoyDTU), Trucki2Shelly Gateway, 2× Victron Smartsolar MPPT (VenusOS Large).
Lokaler Mosquitto MQTT Broker & InfluxDB Daten-Integration.

## Core Requirements
- Live-Dashboard mit animiertem Energiefluss-Diagramm
- Mock/Demo mode als Default für Cloud-Entwicklung
- Dark Glassmorphism / Sci-Fi Steuerzentrale mit Neon-Akzenten
- Control-Seite für Hoymiles und Trucki
- Diagnostics-Tab mit Self-Test
- **48h PV Forecast ENTFERNT** – nicht implementieren

## Tech Stack
- **Frontend**: React, TailwindCSS, Recharts, Shadcn/UI, `solar-ui.jsx` (zentrale Glassmorphism-Komponenten)
- **Backend**: FastAPI (Lifespan), MongoDB, Mosquitto MQTT, InfluxDB 2.x
- **Architektur**: DC-gekoppeltes Solar-System

## Code Architecture (Stand: 27.08.2026)
```
/app/backend/
├── server.py          (271 Zeilen) – App lifecycle, Poller, InfluxDB, Config
├── routes.py          (396 Zeilen) – Alle API-Endpunkte via APIRouter
├── collectors.py      (203 Zeilen) – Device-Fetcher & collect_live Aggregator
├── mqtt_client.py     – MQTT-Logik
├── mocks.py           – Demo-Modus-Generatoren
├── influx_points.py   – InfluxDB-Payload-Builder
└── tests/             – 57 passing pytest-Tests

/app/frontend/src/
├── components/solar-ui.jsx  – GlassCard, SectionHeader, Badge etc.
├── components/              – KpiStrip, GridHouseCard, TruckiCard, VictronCard, EnergyFlow
├── pages/                   – Dashboard, Control, History, Diagnose
└── lib/api.js               – Axios API Client
```

## DB Schema
- `config`: `{"_id": "main", "demo_mode": bool, "devices": {}, "mqtt": {}, "victron_mqtt": {}, "influx": {}, "retention": {"enabled": bool, "days": int}, "alarms": {"enabled": bool, "grid_voltage": {...}, "phase_current": {...}, "battery_voltage": {...}, "battery_soc": {...}}}`
- `snapshots`: Zeitreihen-Dokumente vom Poller (15s-Intervall); Index auf `ts`; stündliche Retention löscht alles älter als `retention.days` (Default 30 Tage)

## API Endpoints
- `GET /api/live` – Live-Daten aller Geräte
- `GET/PUT /api/config` – Konfiguration lesen/schreiben
- `GET /api/history?range=1h|6h|12h|24h` – Verlaufsdaten
- `GET /api/today` – Tageszusammenfassung
- `POST /api/control/hoymiles` – Hoymiles steuern
- `POST /api/control/trucki` – Trucki steuern
- `POST /api/diagnostics/run` – Selbsttest
- `GET /api/diagnostics/raw` – Rohdaten
- `GET /api/integrations/status` – MQTT/InfluxDB/Poller Status
- `GET /api/alarms` – Status-/Alarm-Zusammenfassung (level/count/critical/warning/alarms)
- `GET /api/live` enthält zusätzlich Feld `alarms` (Liste aktiver Alarme)

## Completed Work

### Kernfunktionen (Feature-Set)
- [x] Live-Dashboard mit animiertem EnergyFlow-Diagramm
- [x] 6-KPI-Strip mit 15-Min-Sparklines + Hover-Tooltip (Min/Ø/Max)
- [x] Geräte-Karten: Trucki, Victron/MPPT-Vergleich, Hoymiles/Ahoy, Shelly 3-Phasen, Batterie-Netto, Round-Trip, Phasen-Schieflast
- [x] Rubrik-Sektionen mit Geräte-Weblink (↗) + aufklappbaren, live-gefüllten Detail-Panels (IntroCard-Struktur je Rubrik)
- [x] Control-Seite (Hoymiles + Trucki), Diagnostics-Self-Test, History (Recharts)
- [x] Demo/Mock-Modus als Default; MQTT/InfluxDB-Integration

### Architektur & Qualität
- [x] Backend modularisiert: server/routes/collectors/mqtt_client/mocks/influx_points; Lifespan-Migration; 57/57 Pytest-Tests
- [x] Type-Hints in routes.py & server.py (additiv, 30.08.2026)
- [x] Forecast vollständig entfernt (FE+BE, per Grep verifiziert)
- [x] Security Audit dokumentiert; Risiken vom Nutzer bewusst akzeptiert (LAN-only)
- [x] Deploy (Proxmox): build-app.sh mit Vollständigkeits-Check (10 Kern-Dateien) + selbstheilender craco.config-Fallback

### Design (aktueller Stand)
- [x] Sci-Fi Dark Glassmorphism; Palette Schwarz/Mitternachtsblau/Mattgrau/Silber + Weiß/Blau
- [x] Kacheln als erhöhte Navy-Fläche, klar abgehoben vom fast-schwarzen Hintergrund (#04060c); Card-Lift-Hover, Akzent-Glow oben, Sparkline-Flächenfüllung
- [x] 3-Font-System: **Chakra Petch** (Labels) · **IBM Plex Sans** (Body) · **JetBrains Mono** (Zahlen)
- [x] Erweiterte Tailwind-Spacing-Scale + luftigeres Layout; Auto-Versionierung im Footer (package.json → v1.3.0 + Build-Datum)

### Behobene Bugs
- [x] Runtime: „TRAIL_WINDOW_MS / buildTrail is not defined" → Helfer in Komponenten-Scope (verifiziert testing_agent, iteration_12)
- [x] PR-Review-Triage: defensive .get()-Zugriffe, try/finally im Config-Test, History-Fehlerstatus (role=alert), NavLink aria-label, README-tar & .gitignore
- [x] tailwind.config: doppelter `colors`-Key gemerged (silver/midnight-Utilities aktiv)

### Deployment-Readiness (01.09.2026 – PASS)
- [x] .gitignore: `.env`-Ausschlüsse entfernt (für K8s-Deployment nötig)
- [x] MongoDB-Queries begrenzt: `/history` `.limit(10000)`, `/today` `.limit(20000)`, `/diagnostics` `estimated_document_count()`
- [x] deployment_agent-Check: PASS – keine Blocker, alle Endpoints HTTP 200

### DB-Retention (03.09.2026)
- [x] Config-Key `retention: {enabled, days}` (Default 30 Tage) in DEFAULT_CONFIG + ConfigUpdate
- [x] Stündlicher Hintergrund-Task `retention_loop` in Lifespan; löscht Snapshots älter als N Tage
- [x] Index `db.snapshots.ts` beim Startup automatisch angelegt (schnellere Queries & Deletes)
- [x] Diagnostics zeigt DB-Retention-Status (Tage, letzter Lauf, total gelöscht)
- [x] Pytest `tests/test_retention.py` (3 Tests, 60/60 pass)

### Lokaler Start ohne MongoDB (07.06.2026)
- [x] `backend/local_inmemory.py` patcht MongoDB-Client via `mongomock-motor` (In-Memory) vor Import von `server.py`
- [x] `run_local.py` startet standardmäßig In-Memory (`USE_REAL_DB=1` für echte MongoDB); `.vscode/launch.json` mit 2 Configs
- [x] App-Code unverändert; nur lokaler Dev/Test-Start betroffen

### Grafana-Link + Energiefluss-Animation (07.06.2026)
- [x] Verlauf-Seite: Button „Grafana" öffnet `http://192.168.0.202:3000` (SCADA-Stil)
- [x] EnergyFlow: fließende Partikel, watt-abhängiges Tempo (`flowDurSec`), mitfließender Richtungspfeil
- [x] Roadmap-Dialog: Klick auf Footer-Version öffnet Roadmap (`RoadmapDialog.jsx`)

### Phase A – Status-Alarme (07.06.2026)
- [x] Backend `alarms.py`: feste Schwellwerte (Über-/Unterspannung, Überstrom, Akku-SoC/Spannung), Verbindungs-Alarme (Gerät nicht erreichbar, MQTT weg, Ahoy online aber Wechselrichter ohne Daten); Demo unterdrückt Verbindungs-Alarme
- [x] `/api/live` enthält `alarms`; neuer `/api/alarms` (level/count/critical/warning)
- [x] Frontend: globales `StatusBanner` (Dashboard), `SystemStatusLight` (Header, alle Seiten), Alarm-Badges an Sektions-Headern
- [x] Pytest `tests/test_alarms.py` (12 Tests) – gesamt 72/72 pass

### Phase B – Geräte-Settings auslesen & vorbelegen (07.06.2026)
- [x] Steuerungs-Seite lädt `/api/live` beim Mount + Button „Werte vom Gerät laden" (`btn-reload-device`)
- [x] Slider werden aus Geräte-Werten vorbelegt: Hoymiles `limit_percent`; Trucki `ac_setpoint_w/target_w/min_power_w/max_power_w`
- [x] Pro Slider: „Aktuell am Gerät: X" + „Übernehmen"-Pill + „synchron"-Anzeige (`*-current`, `*-adopt`)
- [x] Trucki-Status-Pills (AC-Output/ZEPC/AC aktuell/SoC); read-only Victron-MPPT-Panel (`control-victron`)

### Alarm-Schwellwerte konfigurierbar (07.06.2026)
- [x] `config.alarms` (enabled + 4 Schwellwert-Gruppen) in DEFAULT_CONFIG + ConfigUpdate
- [x] `alarms.merge_thresholds()` merged Config über Defaults; `/api/live` & `/api/alarms` respektieren `alarms.enabled`
- [x] Settings-UI `AlarmSettings.jsx` auf Geräte-Seite (numerische Inputs, Master-Toggle, Standard/Speichern)
- [x] Pytest: gesamt 15 Alarm-Tests (merge + config-driven); Frontend E2E via testing_agent iteration_13 (9/9 PASS, 100%)

### Alarm-Historie + Grafana Auto-Provisioning (08.06.2026)
- [x] Backend protokolliert Alarm-Zustandswechsel (raised/resolved) mit Zeitstempel in MongoDB-Collection `alarm_events` (`_log_alarm_transitions` im Poller); Index `alarm_events.ts`; Retention bereinigt auch alarm_events
- [x] Neuer Endpoint `GET /api/alarms/history?limit=` (neueste zuerst)
- [x] Frontend `AlarmHistory.jsx`: volle Liste auf Diagnose, kompakt auf Verlauf (raised=„Ausgelöst", resolved=„Behoben")
- [x] Grafana Auto-Provisioning: `deploy/grafana/provisioning/` (Datasource `influxdb-solar` + Dashboard-Provider + provisioniertes Dashboard) + `docker-compose.yml` (ENV-gesteuert, `GF_SECURITY_ALLOW_EMBEDDING=true`)
- [x] Pytest `tests/test_alarm_history.py` (5 Tests) – gesamt 85/85 pass

### Grafana-Dashboards kombiniert & überarbeitet (09.06.2026)
- [x] Manuelle + provisionierte Variante aus EINER Quelle; neue Reihe „Netzbilanz & PV-Steuerung" (Netz Bezug/Einspeisung, Autarkie/Eigenverbrauch-Verlauf, Hoymiles-Limit, Victron-Akkuspannung je MPPT); 16 Panels/6 Reihen; README aktualisiert

### Grafana-Embed + Energiebilanz (08.06.2026)
- [x] Verlauf-Seite: einklappbares **Grafana-iframe-Panel** (`grafana-embed`), nutzt konfigurierbare `grafana_url` (Embedding im Compose aktiviert)
- [x] Neuer Endpoint `GET /api/energy/balance?period=day|month&limit=` (kWh aus Snapshots aggregiert; PV/Bezug/Einspeisung/Eigenverbrauch)
- [x] Frontend `EnergyBalance.jsx`: kWh-Balkendiagramm mit Tag/Monat-Umschaltung auf der Verlauf-Seite
- [x] Pytest `tests/test_energy_balance.py` (3 Tests) – gesamt 88/88 pass

## Bekannte False Positives / bewusste Design-Entscheidungen (NICHT „fixen")
- **React Hook Dependencies (Code Quality Report)**: Alle gemeldeten `useEffect`/`useCallback`-„missing deps" sind bewusste Mount-only-Poller mit `[]` (Intervalle). Der Report listet zudem lokale Variablen (`id`, `n`, `alive`, `d`) als Deps – technisch unmöglich. Hinzufügen würde Poller bei jedem Render neu starten (Endlosschleifen). → NICHT ändern.
- **Zirkulärer Import routes.py ↔ server.py**: Bewusst via späte Bindung am Dateiende gelöst (`server.py`, `# noqa` + Kommentar), Standard-FastAPI-Muster, keine Runtime-Fehler. → NICHT umbauen.
- **„High Complexity / Long Functions"**: Rein kosmetisch; Refactoring einer getesteten, laufenden App bringt keinen funktionalen Nutzen, nur Regressionsrisiko. → Bewusst belassen.
- **`is`-Vergleiche (Python)**: Alle geprüft. `is None`/`is not None` sind PEP8-konform. `routes.py:370-372` nutzen `r["ok"] is True/False/None` bewusst als **Tri-State** (bestanden/fehlgeschlagen/übersprungen). Umbau auf Truthiness (`not r["ok"]`) würde `None`-Skips fälschlich als Fail zählen → **echter Bug**. → NICHT ändern.
- **Verschachtelte Ternaries (React)**: Kosmetische Lesbarkeit, kein Bug. → Belassen.
- Entscheidung vom Nutzer bestätigt am 28.08.2026 und erneut am 30.08.2026 (Option a: nichts ändern, nur dokumentieren).

## Backlog / Roadmap (evolutionär, kein Rewrite)
- [x] **Phase A**: UI-Warnungen / Status-Alarme (feste Schwellwerte) – FERTIG 07.06.2026
- [x] **Phase B**: Geräte-Settings auslesen & Werte für Steuerung übernehmen (alle Geräte) – FERTIG 07.06.2026
- [x] **Alarm-Schwellwerte konfigurierbar** (Settings-UI) – FERTIG 07.06.2026
- [x] **Phase C**: Design-Evolution → Industrial/SCADA-Control-Room (Silber/Weiß/Schwarz/Grau, Tiefe, Design-System; Neon-Akzente bleiben) – FERTIG 07.06.2026 (global via index.css; Blueprint in design_guidelines.json)
- [x] **Phase D**: InfluxDB-Datenpunkte erweitern/aufräumen + Grafana-Dashboard – FERTIG 07.06.2026 (grid_import/export_w, trucki settings, alarms-Measurement, `mode`-Tag; Dashboard-JSON in `deploy/grafana/`)
- [x] **Grafana-URL konfigurierbar** – FERTIG 07.06.2026 (config `grafana_url`, Eingabe auf Geräte-Seite, Verlauf-Link nutzt Config)
- [x] **Alarm-Historie** mit Zeitstempel in Verlauf/Diagnose – FERTIG 08.06.2026 (MongoDB `alarm_events`, `/api/alarms/history`, `AlarmHistory.jsx`)
- [x] **Grafana Auto-Provisioning** (Datasource + Dashboard per YAML) – FERTIG 08.06.2026 (`deploy/grafana/provisioning/` + `docker-compose.yml`)
- [x] **Grafana eingebettet** (iframe) auf Verlauf-Seite – FERTIG 08.06.2026; ENTFERNT 04.10.2026 auf Nutzerwunsch (Link oben reicht), ungenutzte Imports/States bereinigt
- [x] **Tages-/Monatsbilanz** (kWh-Balken PV/Bezug/Einspeisung/Eigenverbrauch) – FERTIG 08.06.2026 (`/api/energy/balance`, `EnergyBalance.jsx`)

### Offener Backlog (nächste Kandidaten)
- [x] **Phase 1: Geräte-Erkennung & Anlagendokumentation** – FERTIG 04.10.2026
  - Backend `discovery.py` (Mock + Live best-effort je Gerät), Collection `device_info` (persistiert, letzte Werte bleiben bei Fehler erhalten)
  - Endpoints: `GET /api/devices/info`, `POST /api/devices/{key}/discover`, `POST /api/devices/discover-all`
  - Frontend: aufklappbare „Typenschild/Doku"-Karten auf Geräte-Seite, „Erkennen" + „Alle erkennen", Status-Badge (Demo/Erkannt/Fehlgeschlagen) + „zuletzt erkannt"
  - Tests: `tests/test_discovery.py` (unit) + `tests/test_discovery_endpoints.py` (HTTP) – 100% grün
- [x] **Firmware-Update-Hinweise** – FERTIG 04.10.2026 (discovery.py `_annotate_firmware` + `LATEST_FIRMWARE`; Doku-Feld bekommt Badge current/outdated/unknown, Karte zeigt amber „FW-UPDATE"-Chip; Ahoy & Victron veraltet im Demo). Tests in test_discovery.py.
- [x] **Phase 2: Dynamischer Plasma-Energiefluss** – FERTIG 04.10.2026 (EnergyFlow.jsx neu: gruppierte Knoten PV-Block/Akku/Netz/Haus mit lebendigen Emblemen – rotierende Plasma-Sonne, SoC-Ladering, Netz-Oszilloskop, Haus; Watt-abhängige Plasma-Ströme mit Photonen-Schwärmen; Knoten erscheinen/verschwinden je nach aktivem Gerät; Hover-Highlighting + Wert-Pills). Testing-Agent 100% (iteration_16).
- [x] **Fluss-Tooltip (Hover-Inspector)** – FERTIG 04.10.2026 (EnergyFlow.jsx `buildDetail`: Overlay-Panel beim Überfahren eines Knotens mit Spannung/Strom/SoC/Temperatur/Phasen je Knoten; Props shelly/ahoy/victron/trucki). Testing-Agent 100% (iteration_17).
- [x] **Doku-Vergleich (Änderungserkennung)** – FERTIG 04.10.2026 (discovery.py `annotate_changes` + routes `_save_device_info` `changed_count`/`prev_detected_at`; DeviceDocPanel zeigt „N geändert"-Chip, Feld-Badge „geändert" + „vorher: X", sonst „unverändert seit letztem Scan"). Tests in test_discovery.py.
- [x] **PV-Knoten nachts: „Sonnenaufgang in X h"** – FERTIG 04.10.2026 (EnergyFlow.jsx, UTC-Sonnenmodell 05–21 Uhr; Knoten-Sub + PV-Inspector-Zeile). Visuell verifiziert.
- [x] **Tagesverlauf-Sonnenbogen** – FERTIG 04.10.2026 (SunTimeline.jsx: Halbbogen Aufgang→Untergang mit Stundenpunkten, zentrale Rest-Sonnenstunden, Sonne/Mond-Marker; unter dem Energiefluss). Visuell verifiziert.
- [x] **Saisonale Sonnenzeiten (Standort)** – FERTIG 05.10.2026 (`sun.py` NOAA-Sonnenaufgangsgleichung; Config `location` {lat,lon,name}; `/api/live` liefert `sun.sunrise/sunset` (UTC); Geräte-Seite Standort-Eingabe). Unit-Tests `test_sun.py` (4) grün; curl-Round-trip (DE/Tromsø/Madrid) verifiziert. Demo-PV-Kurve nutzt jetzt dieselben realen Zeiten.
- [x] **Sonnenbogen-Füllung tagsüber** – FERTIG 05.10.2026 (SunTimeline amber `stroke-dasharray`-Fortschritt von Aufgang→aktueller Position; Zeiten lokal, Marker Sonne/Mond). Live verifiziert (Tag: gefüllter Bogen + aktiver PV-Block).
- [x] **Dämmerungsphasen im Sonnenbogen (blaue/goldene Stunde)** – FERTIG 05.10.2026 (`sun.event_times` für −6°/+6°; Payload `civil_dawn/dusk`, `golden_morning_end/evening_start`; SunTimeline markiert blaue Tails unter Horizont + goldene Segmente knapp darüber, inkl. Legende). Zeiten geprüft, visuell verifiziert.
- [x] **Astronomische Dämmerung (−18°) im Sonnenbogen** – FERTIG 05.10.2026 (`event_times(-18°)`; Payload `astro_dawn/astro_dusk`; SunTimeline zeigt dritte, dunkle Indigo-Zone unter der blauen Stunde; Tails visuell begrenzt; Legende mit 3 Phasen). Visuell verifiziert.
- [x] **Phasen-Zeiten als Hover-Tooltip** – FERTIG 05.10.2026 (SunTimeline: Hit-Flächen pro Dämmerungszone + Tooltip mit Phasenname & genauem Zeitbereich, z. B. „Blaue Stunde · 16:48–17:21"). Testing-Agent 100% (iteration_18).
- [x] **Energiefluss: Kompakt/Detail-Umschalter + SCADA-Optik-Upgrade** – FERTIG 06.06.2026
  - View-Umschalter Auto/Kompakt/Detail (Auto: Handy=Kompakt <1024px, Desktop=Detail), in localStorage (`solar.flowView`) gemerkt; Toggle im EnergyFlow-Header (flow-view-auto/compact/detail). Kompakt = 4 aggregierte Knoten (PV-Block/Netz/Akku/Haus), Detail = 6 Geräte-Knoten
  - MPPT-Inspektor zeigt nur echte Tracker-Messwerte: PV-Leistung, PV-Spannung, abgeleiteter PV-Strom (P/U), Batterie-Spannung, Status, Ertrag. String-Auslastung ergänzt (06.06.2026): MPPT 1 = 4× 425 Wp (1700 Wp), MPPT 2 = 4× 445 Wp (1780 Wp); Knoten zeigt Auslastungs-Balken + „V · %", Inspektor-Zeilen Modulfeld/String-Peak/Auslastung
  - Design-Agent-Blueprint (`/app/design_guidelines.json`) umgesetzt: maschinierte Titan-Knotenkarten (url(#nodeFill)-Gradient, Metall-Oberkanten-Hairline), taktische Eckwinkel, Geräte-Badges (1-STR·DC/AHOY-DTU/TRUCKI/AC-LAST/PRO 3EM), Status-Beacons, Laser-Reticle-Marken, aufgewertetes Inspektor-Panel (Titan-Glas + Badge)
  - Getestet (testing_agent iteration_21, 100 % / 5 Szenarien): kein Crash in Kompakt/Detail, Persistenz über In-App-Navigation, Mobile 390px→Kompakt ohne Overflow, Hover-Inspektor PV-Block AC/DC
  - Bekannt/harmlos: vorbestehende Recharts-Warnung width/height(-1) (verstecktes Sparkline-Container) – nicht blockierend
  - Feinschliff 06.06.2026: digitale Uhr (Neon-Chip) in die „Solar · Live"-Titelleiste verschoben (`dashboard-clock`), KPI-Sparklines feiner (non-scaling-stroke 1.25px), MPPT-Balken mit Tages-Peak-Marker (Reset bei Datumswechsel) + Inspektor-Zeile „Peak heute"
  - Typografie/Readout 06.06.2026: **KPI-Werte** jetzt DSEG7-7-Segment-LCD in eingelassenen Panels (Geister-Ziffern, Neon-Glow) via `.font-dseg` (CDN: dseg@0.46.0, Family `DSEG7-Classic`); **Grundschrift** auf **Sora** umgestellt (body; SCADA-Labels bleiben Chakra Petch, Zahlen JetBrains/DSEG)
  - **Verschattungs-Hinweis** 06.06.2026: MPPT-Knoten zeigt amber Warn-Dreieck + Inspektor-Hinweis, wenn ein String bei guter Produktion (>25 % Peak) >25 %-Punkte Auslastung hinter dem anderen liegt (mögliche Teilverschattung)
  - **Vorschau-Konzept aufbewahrt**: `/kpi-preview` (Route `KpiPreview.jsx`) mit Schrift-Umschalter (DSEG7/Orbitron/Share Tech Mono/JetBrains) + allgemeinem Schriftvergleich (Space Grotesk/Sora/IBM Plex) – als wiederverwendbares Muster für künftige Design-Previews behalten
  - **Grafana/InfluxDB-Ausbau** 06.06.2026: Dashboard `solar-scada` komplett überarbeitet auf 7 Reihen / 42 Panels, generiert aus `deploy/grafana/_generate_dashboard.py` (schema-konsistent, beide JSON-Dateien identisch). Deckt alle InfluxDB-Measurements ab (solar, shelly(_phase), hoymiles(_ch), victron(_mppt), trucki, alarms). Genutzte Plugins: Stat, **D3 Gauge** (`briangann-gauge-panel`, 4×: SoC/Autarkie/Eigenverbrauch/HM-Limit), **Pareto** (`isaozler-paretochart-panel`, MPPT-Ertrag) + Built-ins (Timeseries/Bargauge/Piechart/State-Timeline). App-Design (SCADA-Dark, Neon-Farben). README dokumentiert zusätzliche installierte Plugins (SCADAvis/Flow/Solar Flow/Arc/Gantt/Grafmaid) mit Panel-`type` + Einhäng-Anleitung. JSON-Validität & Layout (0 Overlaps) geprüft; Live-Grafana-Rendering der 2 Plugin-Panels ist beim User final zu bestätigen (hier keine Grafana-Instanz).
  - **Grafana-Fix** 07.10.2026: Fehler „Datasource influxdb-solar was not found" behoben – Proxmox-Provisioning `deploy/proxmox/grafana/influxdb-datasource.yaml` hatte keine feste `uid`; jetzt `uid: influxdb-solar` + Name auf „InfluxDB Solar" angeglichen (beide Provisioning-Dateien tragen nun dieselbe UID, auf die das Dashboard referenziert).
  - **SCADAvis-Synoptik-Vorschau** 07.10.2026: neue Design-Vorschau-Route `/scadavis-preview` (`ScadavisPreview.jsx`, analog zu `/kpi-preview`) – SVG-Synoptik mit animiertem Energiefluss (SMIL animateMotion), Quellen links (MPPT1/MPPT2/Hoymiles) → DC/AC-Kopplung → Senken rechts (Speicher/Haus/Netz), Szenario-Umschalter Tag/Abend (Einspeisung vs. Bezug, Laden vs. Entladen), SCADA-Dark + DSEG7-Werte. Reine Vorschau (keine Live-Daten) als Entscheidungsgrundlage vor Einhängen des Grafana-Plugins `scadavis-synoptic-panel`. Getestet (Screenshot Desktop 1920 + Mobil 390, 0 Overflow, Szenariowechsel ok).
  - **SunTimeline Balken/Bogen-Umschalter** 07.10.2026: Tagesverlauf hat jetzt zwei Ansichten – neue **Balken**-Ansicht (horizontale Zeitachse Aufgang→Untergang mit farbigen Dämmerungs-Segmenten astronomisch/blau/golden, Tagband-Gradient, vergangenem Tagesanteil, Stunden-Ticks, Sonne-/Mond-Marker + gestrichelte Jetzt-Linie, Hover-Tooltips) und die bisherige **Bogen**-Ansicht. Umschalter in der Kartenkopfzeile (`sun-view-toggle` → `sun-view-balken`/`sun-view-bogen`); **Balken = Standard**. Auswahl bleibt in localStorage `suntimeline-view`. Testids `sun-timeline-bar` / `sun-timeline-svg`. Getestet (testing_agent iteration_23, 100 %).
  - **Geräte-Favoriten (anpinnen)** 07.10.2026: Stern-/Pin-Button in jeder Dashboard-Sektion (`section-<x>-pin`); gepinnte Geräte erscheinen als kompakte DSEG7-KPI-Kacheln in neuer **„Favoriten"-Leiste ganz oben** (`FavoritesStrip.jsx`, `favorite-tile-<key>` + `favorite-unpin-<key>`). KPIs: Shelly=Σ Netz (Bezug/Einspeisung), Hoymiles(ahoy)=AC gesamt+Limit, Trucki=SoC+Akku-Leistung, Victron=PV-Leistung+Ertrag. Persistenz **serverseitig** in `config.favorites` (neuer Key in DEFAULT_CONFIG + `ConfigUpdate.favorites: Optional[List[str]]`, Merge in PUT `/api/config` ohne Integrations-Neustart). Mapping: battery→trucki, pv-grid→ahoy. Getestet (testing_agent iteration_23, 100 %, Persistenz über Reload).
  - **Grafana SCADAvis-Synoptik-Panel** 07.10.2026: Generator `_generate_dashboard.py` um `scadavis()`-Helper (Plugin `scadavis-synoptic-panel`, React-2.x-Optionsmodell: svgUrl/zoomLevel/autoResize/…) erweitert; in Reihe 1 ein zweites volle-Breite „Leistungsfluss · Synoptik"-Panel mit Flux-Bindings (PV/Haus/Netz/Akku als @1–@4). Beide JSON-Dateien regeneriert → **43 Panels, 0 Overlaps**. Eigenes Synoptik-SVG per Panel-Option `svgUrl`/Upload in Grafana final setzbar (ohne SVG zeigt das Plugin seine Demo-Synoptik).
  - **SunTimeline Balken verschlankt** 07.10.2026: Balken deutlich dünner (BH 42→18, BY 96) und Sonne-/Mond-Marker sitzt jetzt mittig **auf** dem Balken (BY+BH/2, größerer Radius) statt darüber – der Balken läuft hinter der Sonne durch. Getestet (testing_agent iteration_24).
  - **Granulare Favoriten + Drag&Drop** 07.10.2026: Favoriten unterstützen jetzt neben ganzen Geräten auch **einzelne MPPT-Strings** (`mppt:<idx>`, Pin in `MpptCompare` → `mppt-pin-<i>`) und **Shelly-Phasen** (`phase:<L1|L2|L3>`, Pin an den Phasen-Kacheln → `shelly-<L>-pin`). `FavoritesStrip.favItem()` löst alle Schlüsseltypen zu Live-KPIs auf (MPPT=PV-Leistung+Ertrag, Phase=Leistung Bezug/Einspeisung). Kacheln sind per **nativem HTML5-Drag&Drop** umsortierbar (Grip-Handle, `onReorder`→`putConfig`); Reihenfolge = `config.favorites`-Array und bleibt serverseitig erhalten. Testids: `favorite-tile-<key:→->>` (z. B. `favorite-tile-mppt-0`, `favorite-tile-phase-L1`) + `favorite-unpin-*`. Backend akzeptiert beliebige String-Keys (`favorites: Optional[List[str]]`). Getestet (testing_agent iteration_24, 100 %, inkl. DnD-Reorder + Persistenz über Reload).
  - **KPI-Leiste umbenannt/neu gefärbt** 29.10.2026 (`KpiStrip.jsx`): Kachel-Labels angepasst – „PV Gesamt"→**„Solar Ertrag Heute"** (jetzt **orange** `#F59E0B` + neue CSS-Klasse `neon-text-orange`, mit Sonnen-Icon am Label-Ende), „PV Aktuell"→**„Solar Erzeugung"**, „Netz Bezug (Gesamt)"→**„Netzbezug Heute"**. Die bisherige dynamische Kachel „Netz Bezug/Einspeisung (Aktuell)" ist nun **„Hauslast"** und zeigt den aktuellen Hausverbrauch `summary.house_power` (W, Testid `kpi-house-load`); ungenutzte Imports `exportNowW`/`isExporting` entfernt. Selbst getestet (Screenshot Desktop 1920 + Mobil 390, kein Overflow; Werte korrekt, z. B. Hauslast 454 W).
  - **Dashboard-Redesign (Geräte-Karten + Energiefluss + Kennzahlen)** 29.10.2026 – großer genehmigter Umbau der Übersicht:
    - **4 Geräte-KPI-Karten** (`DeviceCards.jsx`, ersetzen die 6 LCD-Kacheln von `KpiStrip`): Solar PV, Batterie 48V, Hausverbrauch, Stromnetz – je Statusbadge, großer LCD-Wert (DSEG7), Tageswert + 3 Unterzeilen. Testids `device-cards`, `device-card-{solar|battery|house|grid}` (+ `-value`). Werte aus `/api/live` + `/api/today`.
    - **Energiefluss-Umbau** (`EnergyFlow.jsx`): Kompakt = **5 Knoten** (pv/grid/house/battery/sun2000), Detail = **6 Knoten** (hoymiles/victron/grid/house/battery/sun2000), Auto nach Breite. Neuer **Sun-2000/Trucki-Knoten** (Bolt-Emblem) als Entlade-Regler. Kanten werden generisch über `edge()` aus Knotenpositionen berechnet. Neue Steuerleiste: **Fluss an/aus** (`flow-toggle-anim`, Partikel), **Tempo 1×/1.5×/2×** (`flow-tempo-*`, skaliert Partikeldauer), Ansicht `flow-view-*`. Alles in localStorage (`solar.flowView/flowOn/flowTempo`). Inspector um `victron`+`sun2000` erweitert.
    - **Kennzahlen-Zeile** (`FlowSummary.jsx`) unter dem Diagramm: Solar Ertrag Heute, Batterie Kapazität (SoC×9,6 kWh), Netzbezug Heute, Autarkiegrad. Testids `flow-summary`, `summary-{pv|battery|grid|autarky}`.
    - Annahmen lt. Plan: keine erfundenen Werte – statt „Zellendrift"/„50 Hz" werden Tagesenergie bzw. nichts gezeigt; nutzbare Akkukapazität fix 9,6 kWh (später konfigurierbar). Entfernte Features bleiben entfernt.
    - **Getestet**: testing_agent iteration_25 = 100 % funktional (Ansichtswechsel/Fluss/Tempo/Persistenz/Inspector/Regression). Danach Design-Fixes: NODE_W 182→205 + kleineres Label (keine Label/Badge-Überlappung), kürzerer Nacht-Sub (kein Überlauf), `f1` auf deutsche Dezimalkommas, Fluss-SVG in horizontal scrollbarem Container (Mobil lesbar, kein Seiten-Overflow), Inspector responsiv + Tap-to-dismiss, Tempo-Whitelist-Guard. Per Screenshot Desktop+Mobil verifiziert.
  - **Phase-2-Teil: Einstellungen (Kapazität + Gerätetexte) & Mobil-Hochkant-Fluss** 29.10.2026:
    - **Konfigurierbare Anzeige** (`config.display`): neuer Config-Block `{usable_kwh, labels:{solar,battery,house,grid}}` (DEFAULT_CONFIG + `ConfigUpdate.display`, nicht in `integration_keys` → kein Neustart). Einstell-Karte „Anlage & Anzeige" auf der Geräte-Seite (`Devices.jsx`, `display-settings-row`): Zahlen-Input `input-usable-kwh` + 4 Text-Inputs `input-label-{solar|battery|house|grid}`; wird mit dem bestehenden „Speichern" persistiert. `DeviceCards` liest `display.labels` (Prop `display`), `FlowSummary` liest `display.usable_kwh` (Prop `usableKwh`); Dashboard lädt/reicht `display` durch. Verifiziert: UI-Save → Persistenz über frischen Seitenaufruf (11,5 kWh / „8x LiFePO4 280Ah") → Karte & Kennzahl aktualisiert; danach auf Demo-Defaults zurückgesetzt.
    - **Mobil-Hochkant-Energiefluss**: statt seitlich scrollbarem Diagramm jetzt echte vertikale Anordnung bei schmalen Screens (`portrait = narrow && compact`): Portrait-viewBox 480×840, zwei Spalten gestapelt (links PV→Haus→Netz, rechts Akku→Sun-2000), kein horizontaler Scroll, Crosshair-Deko nur im Landscape. Desktop/Landscape unverändert. Per Screenshot Mobil 390 (viewBox 480×840, kein Seiten-Overflow) + Desktop verifiziert.
  - **Versions-Fußleiste, In-App-Roadmap & Anleitung (v1.4.0)** 29.10.2026:
    - **Zentrale Datenquelle** `src/lib/appmeta.js`: `APP_VERSION` (1.4.0), `APP_LAST_UPDATED`, `ROADMAP` (Status `done|wip|planned` + Datum) + `ROADMAP_GROUPS`. Einziger Pflegeort beim Ausliefern.
    - **Fixe Fußleiste** `VersionFooter.jsx` (in `Layout.jsx`, ersetzt den alten Footer; `main` → `pb-20` als Abstand): App-Name, Version (Link → `/doku`), Modus-Badge Demo/Live (aus `/api/config`), Stand-Datum, „Neu"-Pille bei neuer Version (localStorage `solar.seenVersion`). Emergent-Badge + Copyright bleiben. Testids `version-footer`, `footer-version`, `footer-mode`, `footer-version-new`, `footer-emergent-badge`.
    - **Doku-Seite** `pages/Docs.jsx` als Layout-Kindroute `/doku` (nicht im Nav): Tabs `Roadmap` (3 Spalten Erledigt/In Arbeit/Geplant aus `appmeta`) und `Anleitung` (4 aufklappbare Abschnitte: App-Bedienung, Anlage & Geräte, Energie-/Verkabelungsmodell, lokales Setup) mit eingeblendeten Live-Werten aus `/api/config` (Kapazität, Labels, Demo/Live) und `/api/devices/info` (Firmware, zuletzt erkannt). Testids `docs-page`, `docs-tab-{roadmap|guide}`, `roadmap-col-{done|wip|planned}`, `guide-{app|devices|model|setup}`.
    - **Fix**: `firmware` aus `/api/devices/info` ist ein Objekt `{status,current,latest}` → `fw()` extrahiert jetzt `current` (vorher React-Child-Crash).
    - **README**: Einleitungstext ersetzt durch „Autarkes Energiemanagement, Nulleinspeisung & Hardware-Diagnose …" mit vier Säulen (Visualisieren/Steuern/Analysieren/Diagnostizieren); Rest unverändert.
    - **Verifiziert** (Screenshots Desktop+Mobil): Fußleiste überall, Version→/doku, Roadmap 18/1/9, Anleitung-Akkordeon + Live-Firmware, kein Seiten-Overflow, Content nicht hinter fixer Leiste. Alte `RoadmapDialog.jsx` nicht mehr verwendet.
  - **Editierbare Roadmap (installationsweit) & „Was ist neu?" (v1.5.0)** 29.10.2026:
    - **Backend-Persistenz**: eigene Mongo-Collection `roadmap` (Doc `_id:"main"`), einmaliges Seed (28 Punkte, realer Projektstand: 20 erledigt / 8 geplant) aus `DEFAULT_ROADMAP` in `routes.py`. Endpunkte `GET /api/roadmap` (seedet bei leer) + `PUT /api/roadmap {items:[...]}` (ganze Liste ersetzen, dauerhaft). Pydantic `RoadmapItem {id,title,status,date,completed_at?}` + `RoadmapUpdate`. Status beim Wechsel auf `done` setzt `completed_at` (für „Was ist neu?").
    - **Editor** in `Docs.jsx` (Roadmap-Tab): Bearbeiten-Schalter `roadmap-edit-toggle`; je Punkt Titel-Input (`roadmap-item-title`), Status-Select (Erledigt/In Arbeit/Geplant), Löschen mit Inline-Bestätigung (`roadmap-item-delete`), Grip-Handle; **natives HTML5-Drag&Drop** zwischen/innerhalb der 3 Spalten; „+ Punkt"-Button je Spalte (`roadmap-add-{done|wip|planned}`). Jede Änderung wird (debounced) via `putRoadmap` persistiert. Kein Login – jeder lokale Zugriff darf editieren. Anleitung-Tab unverändert.
    - **„Was ist neu?"-Overlay** (`WhatsNew.jsx`, in `Layout.jsx`): öffnet automatisch bei Versionssprung (localStorage `solar.seenVersion`) **nur** wenn seit letztem Besuch neu auf „done" gesetzte Punkte existieren (Abgleich gegen `solar.seenDoneIds`). Wegklickbar (`whatsnew-close`), merkt Version+done-IDs. Erneut öffnbar über die **„Neu"-Pille an der Versionsnummer** in `VersionFooter` (`footer-version-new` → `onOpenWhatsNew`). Testids `whatsnew-dialog`/`whatsnew-item`.
    - **Verifiziert**: Backend GET seedet 28 / PUT persistiert (curl, externe URL); UI (Screenshot 1920): Bearbeiten-Modus + Hinzufügen (28→29), Auto-„Was ist neu?" mit 19 Punkten bei simuliertem Versions-/done-Sprung, Footer v1.5.0. Roadmap nach Test auf sauberen Seed zurückgesetzt. Entfernte Features (Watt-Labels, 48h-Prognose, CSV) weiterhin nicht eingeführt.
  - **Projektbericht-Seite „Was wir erreicht haben"** 29.10.2026 (`pages/Report.jsx`, Routen `/report-preview` + `/bericht`, **nicht im Menü**): eigenständige, von oben nach unten lesbare Lese-Seite im SCADA-Dark-Look. Sechs Abschnitte: (1) Kopf/Überblick mit Titel, Version/Stand und 5 KPI-Kacheln (erledigt/in Arbeit/geplant aus `ROADMAP`, Gerätetypen, Ausbaustufen); (2) **Funktions-Changelog** farbcodiert – Hinzugefügt (grün), Abgelöst/ersetzt als „vorher→nachher" (gelb), Komplett entfernt/abgelehnt mit Begründung (rot, inkl. 48h-Prognose, Watt-Labels, CSV); (3) senkrechte **Zeitachse** der Meilensteine; (4) **Arbeitsweise** (erst fragen+Freigabe, dann bauen, dann prüfen; Demo-Standard); (5) **Erkenntnisse/Stolpersteine** (Grafana-UID, Firmware-Objekt, Mobil-Hochformat, de-DE-Zahlen); (6) **Technik-Überblick** (Geräte + Bausteine, lokal). Sticky Sprungmarken-Leiste mit Scroll-Spy (`report-nav-*`), „Zurück nach oben"-Button (`report-back-to-top`), Scroll-Reveal via IntersectionObserver (`[data-reveal]`/`.reveal-in` in index.css, reduced-motion-fest), `.no-scrollbar`-Helper. Inhalt fest kuratiert (Stand v1.5.0), rein lesend – keine Bearbeitung/Steuerung/Export, keine neuen Integrationen. Testids `report-page`, `report-kpi-*`, `report-nav-*`, `report-back`, `report-back-to-top`. Verifiziert (Screenshots Desktop 1920 + Mobil 390: alle Abschnitte, Sprungmarken-Navigation, Back-to-top; 0 Seiten-Overflow – nur die bewusst scrollbare Nav-Leiste).
  - **Meilenstein-Vorschau (Vorher/Nachher-Mini-Mockups)** 29.10.2026 (`components/MiniMock.jsx`): jeder der 6 Zeitachsen-Einträge im Bericht zeigt ein kompaktes **SVG-Mini-Mockup-Paar** (Vorher → Nachher, viewBox 120×76, SCADA-Dark) statt KI-Screenshots – scharf, konsistent, responsiv. 12 Szenen: blank/dashboard, grafana-error/grafana-grid, dash-nofav/dash-fav, six-tiles/four-cards, popup/footer-docs, roadmap-static/roadmap-edit. „Nachher" mit Cyan-Akzentrahmen; Bildunterschriften „Vorher · …"/„Nachher · …" mit farbigem Punkt + Pfeil dazwischen. Testid `report-mock-pair-{i}`. Verifiziert (Screenshots Desktop 1920 + Mobil 390: 6 Paare, 0 Overflow).
  - **Bericht v1.6.0: Auto-Changelog, Druck/PDF & Doku-Link** 29.10.2026:
    - **„Hinzugefügt" automatisch aus der Roadmap** (`Report.jsx`): lädt `GET /api/roadmap`, zeigt alle `done`-Punkte (neueste zuerst, Datum de-DE) + Anzahl + Badge „Automatisch aus der Roadmap" (`report-added-source`, `report-added-count`, `report-added-item`). Optionale Beschreibung/Icon je Roadmap-ID über `ADDED_INFO`; neue Punkte erscheinen auch ohne Eintrag (Standard-Icon). KPI-Kacheln (erledigt/in Arbeit/geplant) ebenfalls live. Fallback: statisches `appmeta.ROADMAP`. Abgelöst/Entfernt/Zeitachse bleiben kuratiert.
    - **Druck/PDF** (`components/ReportPrint.jsx`): Knopf „Drucken / PDF" (`report-print-btn`) im Bericht-Kopf mit Auswahl **Hell · druckerfreundlich** (`report-print-light`) oder **Dunkel · wie am Bildschirm** (`report-print-dark`) → setzt `html[data-print]`, blendet alle Reveals ein, @page A4 (dunkel randlos) und öffnet den Browser-Druckdialog. Print-CSS in `index.css` (`@media print`): Kopfleiste/Back-to-top ausgeblendet, Karten ohne Seitenumbruch, Hell-Modus mappt Text-/Rahmen-/Akzentfarben auf druckbare Töne.
    - **Link „Projektbericht"** nur auf der Doku-Seite (`docs-report-link` → `/bericht`).
    - Seed + Preview-Roadmap: neue erledigte Punkte `report-page`, `changelog-auto` (vorher geplant), `report-print`. Version → **1.6.0**.
    - Verifiziert per Screenshot (Desktop 1920, Mobil 390, Print-Emulation hell + dunkel, 0 Overflow im Bericht).
  - **Zeitachse automatisch aus der Roadmap** 29.10.2026 (`Report.jsx`, `MiniMock.jsx` Variante `auto`): die 6 kuratierten Meilensteine bleiben (je `ids` = abgedeckte Roadmap-Punkte, `sort` = ISO-Datum). Alle übrigen erledigten Roadmap-Punkte (mit ID) werden **je Datum zu einem Eintrag gruppiert** und chronologisch eingereiht (**älteste oben**, gleiche Daten: kuratiert zuerst; Nicht-Datumswerte ans Ende). Auto-Eintrag: Datum + Badge „automatisch", Titel „N neue Funktionen", **Standard-Vorschaubild** (grüne Checklisten-Kachel, „Aus der Roadmap") + Punktliste. Grüner Zeitachsen-Punkt statt Cyan. KPI „Ausbaustufen" = Länge der gesamten Zeitachse. Testids `report-timeline-auto-<datum>`, `report-timeline-auto-item`; `report-mock-pair-{0..5}` unverändert. Druck-CSS (hell) ergänzt. Verifiziert per Screenshot (Desktop 1920, Mobil 390 ohne Overflow, Druck hell) inkl. temporärem Test-Punkt „11/2026" → eigener Eintrag am Ende (danach wieder entfernt).
  - **Visuelle Anpassungen** 30.10.2026: (1) **Tagesverlauf** (`SunTimeline`) vom Dashboard auf die Seite **Verlauf** verschoben – ganz unten nach Alarm-Historie; `History.jsx` lädt dafür `getLive()` (alle 60 s). (2) **Nav-Aktiv-Balken** (`Layout.jsx`) halb so breit (`left/right-[calc(25%+6px)]`). (3) **Energiefluss Detail**: Knoten **Victron MPPT** von links-mittig (155,210) **mittig über Hausverbrauch** (530,80) verschoben; Fluss Victron→Batterie folgt automatisch. Per Screenshot verifiziert (Desktop + Mobil).



- [x] **Energiefluss: 6 getrennte Geräte-Knoten** – FERTIG 06.06.2026
  - Statt aggregiertem „PV-Block" nun einzelne Knoten: MPPT 1, MPPT 2 (Victron DC), Hoymiles HM1500 (AC), Akku (Trucki/SUN), Netz (Shelly 3EM), Haus
  - DC-gekoppelte Topologie: MPPT1/2 → Akku, Akku → Haus, Hoymiles → Haus, Netz ↔ Haus; eigene Plasma-Flüsse + Watt-Pills je Pfad
  - Pro-Knoten-Inspektor: MPPT (PV-/Batterie-Spannung, Status, Ertrag), Hoymiles (4 Kanäle, Limit, Ø V / Σ A), Akku (SoC, DC-Ladung, Temp, ZEPC), Netz (L1/L2/L3), Haus (Quellen-Aufschlüsselung)
  - Node-Testids: flow-mppt1/flow-mppt2/flow-hoymiles/flow-battery/flow-house/flow-grid; viewBox 1060×420, Knoten 182×82; getestet (testing_agent iteration_20, 100 %)

- [x] **Phase 3: Feinschliff** – FERTIG 06.06.2026
  - Animations-Politur: weicheres Easing (cubic-bezier) für Energiefluss-Hover/Dimming; gestaffelte Seiten-/Karten-Einblendung (`.page-reveal` in index.css, auf allen 6 Seiten-Wurzeln)
  - **Reduced-Motion als Nutzer-Option** (`lib/motion.jsx` MotionProvider): Tri-State Automatisch/Immer an/Reduziert, in localStorage (`solar.motionPref`) persistiert, Segmented-Control auf Geräte-Seite (`motion-toggle`). Setzt `.reduce-motion` / `.motion-force-on` auf <html>; EnergyFlow & SunTimeline überspringen SMIL-Photonen/`flow-particles` im reduzierten Modus
  - Mobile/Tablet/Desktop-Responsive-Check: testing_agent iteration_19 – 0 horizontaler Overflow an 390/768/1024 auf allen 6 Routen, Reveals verdecken keine Inhalte; Nav schmalseitig scrollbar gemacht (`min-w-0 flex-1`, Untertitel `hidden sm:block`)
- [ ] Geräte-Favoriten aufs Dashboard pinnen
- [ ] Push-Benachrichtigungen / Alarm-Ton bei kritischen Alarmen
- [ ] Energiekosten (€/kWh) für Bezug/Einspeisung
- P3: CSV-Datenexport – vom Nutzer ABGELEHNT
- P3: Watt-Label am Energiefluss-Pfeil – vom Nutzer ABGELEHNT
