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
- `config`: `{"_id": "main", "demo_mode": bool, "devices": {}, "mqtt": {}, "victron_mqtt": {}, "influx": {}}`
- `snapshots`: Zeitreihen-Dokumente vom Poller (15s-Intervall)

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

## Bekannte False Positives / bewusste Design-Entscheidungen (NICHT „fixen")
- **React Hook Dependencies (Code Quality Report)**: Alle gemeldeten `useEffect`/`useCallback`-„missing deps" sind bewusste Mount-only-Poller mit `[]` (Intervalle). Der Report listet zudem lokale Variablen (`id`, `n`, `alive`, `d`) als Deps – technisch unmöglich. Hinzufügen würde Poller bei jedem Render neu starten (Endlosschleifen). → NICHT ändern.
- **Zirkulärer Import routes.py ↔ server.py**: Bewusst via späte Bindung am Dateiende gelöst (`server.py`, `# noqa` + Kommentar), Standard-FastAPI-Muster, keine Runtime-Fehler. → NICHT umbauen.
- **„High Complexity / Long Functions"**: Rein kosmetisch; Refactoring einer getesteten, laufenden App bringt keinen funktionalen Nutzen, nur Regressionsrisiko. → Bewusst belassen.
- **`is`-Vergleiche (Python)**: Alle geprüft. `is None`/`is not None` sind PEP8-konform. `routes.py:370-372` nutzen `r["ok"] is True/False/None` bewusst als **Tri-State** (bestanden/fehlgeschlagen/übersprungen). Umbau auf Truthiness (`not r["ok"]`) würde `None`-Skips fälschlich als Fail zählen → **echter Bug**. → NICHT ändern.
- **Verschachtelte Ternaries (React)**: Kosmetische Lesbarkeit, kein Bug. → Belassen.
- Entscheidung vom Nutzer bestätigt am 28.08.2026 und erneut am 30.08.2026 (Option a: nichts ändern, nur dokumentieren).

## Backlog
- P3: CSV-Datenexport für Verlaufsdaten
- P3: Alarm-Schwellwerte (konfigurierbare Warnungen)
- P3: Geräte-Favoriten im Dashboard
