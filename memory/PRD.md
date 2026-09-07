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
- `config`: `{"_id": "main", "demo_mode": bool, "devices": {}, "mqtt": {}, "victron_mqtt": {}, "influx": {}, "retention": {"enabled": bool, "days": int}}`
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

## Bekannte False Positives / bewusste Design-Entscheidungen (NICHT „fixen")
- **React Hook Dependencies (Code Quality Report)**: Alle gemeldeten `useEffect`/`useCallback`-„missing deps" sind bewusste Mount-only-Poller mit `[]` (Intervalle). Der Report listet zudem lokale Variablen (`id`, `n`, `alive`, `d`) als Deps – technisch unmöglich. Hinzufügen würde Poller bei jedem Render neu starten (Endlosschleifen). → NICHT ändern.
- **Zirkulärer Import routes.py ↔ server.py**: Bewusst via späte Bindung am Dateiende gelöst (`server.py`, `# noqa` + Kommentar), Standard-FastAPI-Muster, keine Runtime-Fehler. → NICHT umbauen.
- **„High Complexity / Long Functions"**: Rein kosmetisch; Refactoring einer getesteten, laufenden App bringt keinen funktionalen Nutzen, nur Regressionsrisiko. → Bewusst belassen.
- **`is`-Vergleiche (Python)**: Alle geprüft. `is None`/`is not None` sind PEP8-konform. `routes.py:370-372` nutzen `r["ok"] is True/False/None` bewusst als **Tri-State** (bestanden/fehlgeschlagen/übersprungen). Umbau auf Truthiness (`not r["ok"]`) würde `None`-Skips fälschlich als Fail zählen → **echter Bug**. → NICHT ändern.
- **Verschachtelte Ternaries (React)**: Kosmetische Lesbarkeit, kein Bug. → Belassen.
- Entscheidung vom Nutzer bestätigt am 28.08.2026 und erneut am 30.08.2026 (Option a: nichts ändern, nur dokumentieren).

## Backlog / Roadmap (evolutionär, kein Rewrite)
- [x] **Phase A**: UI-Warnungen / Status-Alarme (feste Schwellwerte) – FERTIG 07.06.2026
- [ ] **Phase B**: Geräte-Settings auslesen & Werte für Steuerung übernehmen (alle Geräte)
- [ ] **Phase C**: Design-Evolution → Industrial/SCADA-Control-Room (Silber/Weiß/Schwarz/Grau, Tiefe, Design-System; Neon-Akzente bleiben)
- [ ] **Phase D**: InfluxDB-Datenpunkte erweitern/aufräumen + Grafana-Dashboard-Design an App anpassen (JSON-Export)
- P3: CSV-Datenexport – vom Nutzer ABGELEHNT
- P3: Watt-Label am Energiefluss-Pfeil – vom Nutzer ABGELEHNT
