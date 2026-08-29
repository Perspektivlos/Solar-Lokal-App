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
- [x] Live-Dashboard mit EnergyFlow-Animation
- [x] 6-KPI-Strip (PV, Netz, Haus, Akku-SoC, Autarkie, Eigenverbrauch)
- [x] Round-Trip-Effizienz-Kachel
- [x] MPPT-Vergleichskachel & 3-Phasen-Schieflast
- [x] Control-Seite (Hoymiles + Trucki)
- [x] Diagnostics mit Self-Test
- [x] History-Seite mit Recharts
- [x] Dark Glassmorphism UI (solar-ui.jsx)
- [x] Frontend-Komponentenextraktion (KpiStrip, Cards etc.)
- [x] Backend: mocks.py, influx_points.py, routes.py, collectors.py extrahiert
- [x] Lifespan-Migration (on_event → asynccontextmanager)
- [x] Forecast komplett entfernt (FE+BE)
- [x] Security Audit (dokumentiert; Risiken vom Nutzer bewusst akzeptiert – LAN-only Betrieb: keine Auth, MQTT-Klartext-Creds, offene CORS)
- [x] 57/57 Pytest-Tests bestanden
- [x] Fonts umgestellt: Space Grotesk (Text) + JetBrains Mono (Zahlen), app-weit inkl. SVG/Charts (28.08.2026)
- [x] Design-Refinement (29.08.2026): Palette Schwarz/Mitternachtsblau/Mattgrau/Silber ergänzt (semantische Neon-Akzente bleiben für Datenzustände); einheitliche Kachel-Anatomie via GlassCard (Card-Lift-Hover, Header-Gradient, Silber-Rand); Glas-/Glow-Effekte verstärkt (blur 18px, abgedunkeltes glass-inset rgba(5,5,5,0.7)); Sparklines mit Flächenfüllung; 3-Font-System (Outfit=Labels, IBM Plex Sans=Body, JetBrains Mono=Zahlen). Rein visuell – KEINE angezeigten Werte/Labels geändert. Zentral in index.css/tailwind.config/solar-ui.jsx (kaskadiert auf alle Kacheln). Verifiziert per Screenshots (Dashboard + Geräte + Integrationen).
- [x] PR-Review-Triage (28.08.2026): valide Findings behoben – defensive .get()-Zugriffe (collectors.py/routes.py), try/finally in Config-Test, WARN-Badge für Schieflast, History-Fehlerstatus, Batterietitel Totband-konsistent, NavLink aria-label, README-tar & .gitignore (.env/.copilot), design_guidelines Fonts. Halluzinierte/Nitpick-Findings übersprungen (kein /api/forecast, @import-Stil, Zirkulär-Import).
- [x] Footer/Versionierung (29.08.2026): Version auto aus package.json (v1.3.0) + Build-Datum (craco), Footer-Styling an Palette angepasst.
- [x] Runtime-Fix (29.08.2026): "TRAIL_WINDOW_MS / buildTrail is not defined" behoben – beide Helfer von Modul- in Komponenten-Scope verschoben (Fast-Refresh/visual-edits-Closure-Problem). Verifiziert per testing_agent (iteration_12.json: 100% Frontend, 0 ReferenceErrors, alle 6 Routen sauber). Zudem 6. KPI-Kachel "Einspeisung (Gesamt)" Sparkline ergänzt (nun alle 6 konsistent).
- [x] Deploy-Vorabprüfung (29.08.2026): build-app.sh prüft 10 Kern-Dateien vor Build, klare Fehlermeldung bei unvollständigem Upload.
- [x] Deploy-Fix Proxmox (29.08.2026): `build-app.sh` selbstheilend – erzeugt minimale craco.config.js Fallback (Webpack '@'-Alias, in ~47 Imports genutzt), falls im Upload fehlt. Ursache des "craco: Config file not found"-Builds war unvollständiger Quellcode-Upload. Fallback per echtem Production-Build verifiziert (Build erfolgreich, @-Alias aufgelöst).

## Bekannte False Positives / bewusste Design-Entscheidungen (NICHT „fixen")
- **React Hook Dependencies (Code Quality Report)**: Alle gemeldeten `useEffect`/`useCallback`-„missing deps" sind bewusste Mount-only-Poller mit `[]` (Intervalle). Der Report listet zudem lokale Variablen (`id`, `n`, `alive`, `d`) als Deps – technisch unmöglich. Hinzufügen würde Poller bei jedem Render neu starten (Endlosschleifen). → NICHT ändern.
- **Zirkulärer Import routes.py ↔ server.py**: Bewusst via späte Bindung am Dateiende gelöst (`server.py`, `# noqa` + Kommentar), Standard-FastAPI-Muster, keine Runtime-Fehler. → NICHT umbauen.
- **„High Complexity / Long Functions"**: Rein kosmetisch; Refactoring einer getesteten, laufenden App bringt keinen funktionalen Nutzen, nur Regressionsrisiko. → Bewusst belassen.
- Entscheidung vom Nutzer bestätigt am 28.08.2026 (Option a: nichts ändern, nur dokumentieren).

## Backlog
- P3: CSV-Datenexport für Verlaufsdaten
- P3: Alarm-Schwellwerte (konfigurierbare Warnungen)
- P3: Geräte-Favoriten im Dashboard
