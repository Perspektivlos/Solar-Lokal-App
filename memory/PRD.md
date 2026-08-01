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
- **Frontend**: React 19 + CRA/craco, React Router, Recharts, shadcn/ui, IBM Plex Sans/Mono.
- **DB**: MongoDB (collections: `config`, `snapshots`).
- **Background**: Poller asyncio task → Snapshot alle 15s.
- **Design**: Dark Glassmorphism / Sci-Fi Control Room, Neon-Akzente (PV gelb, Bezug rot, Einspeisung emerald, Akku cyan), deutsche Oberfläche.

## Personas
- Solar-Anlagenbesitzer im Heimnetz (lokale Steuerung, keine Auth nötig).

## Systemphysik (WICHTIG – DC-gekoppelt, vom User bestätigt)
- Victron-MPPTs laden den Akku direkt (DC), speisen NICHT ins Haus.
- Hoymiles HM1500 speist AC direkt ins Haus/Netz.
- Trucki/SUN entlädt den Akku ins AC-Netz.
- Hausverbrauch = Hoymiles-AC + Trucki-Entladung + Netzbezug. Victron-Ladeleistung NIE in den Hausverbrauch einrechnen.

## Core Requirements
- Live-Daten aller Geräte aggregiert (3-Phasen, 4 Kanäle, SoC, 2 MPPTs)
- Energiefluss-Visualisierung (animiertes SVG, DC-gekoppelt)
- Historie (Recharts, 1h/6h/12h/24h)
- Tageswerte mit Trapez-Integration (kWh PV/Verbrauch/Bezug/Einspeisung, Autarkie %)
- Geräte-Konfig, Steuerung Hoymiles & Trucki, Diagnose/Selbst-Test
- MQTT-Subscriber & InfluxDB-Writer mit UI-Konfig + Live-Status
- Demo-Modus als Default für Cloud-Demo (Mock-Generatoren)

## Endpoints
- GET /api/live, /api/history, /api/today, /api/config (GET/PUT), /api/control/hoymiles, /api/control/trucki, /api/integrations/status, /api/diagnostics/run, /api/diagnostics/raw, /api/forecast (bleibt, UI nutzt es nicht mehr).

## Entfernte Features (NICHT wieder hinzufügen)
- Forecast-Tab (UI) + Autarkie-Ziel-Kachel: vom User explizit entfernt.
- Telegram-Integration: vom User abgelehnt.

## Changelog (aktuell)
### 2026-08: Dashboard-Umgruppierung nach Themen
- Akku-Kacheln in eigener Zeile (`data-testid="battery-row"`): Akku-Netto + Trucki-Speicher + Round-Trip-Effizienz.
- MPPT-Kacheln in eigener Zeile (`data-testid="mppt-row"`): Victron MPPT + MPPT-Vergleich.
- Zusätzliche Zeile: 3-Phasen-Schieflast + Hoymiles (Netz/PV-AC). Summary-Spalte neben Energiefluss nur noch PV + Netz. Reine Layout-Änderung, per Screenshot verifiziert.

### 2026-07: MPPT-Vergleich + 3-Phasen-Schieflast (P2)
- `PhaseBalance.jsx`: prominente 3-Phasen-Schieflast-Kachel (Balken je Phase, Spread in W, Unbalance %, Status grün/orange/rot ab 15%/30%). Aus `shelly.phases`.
- `MpptCompare.jsx`: MPPT #1 vs #2 (aktuelle Leistung + Yield heute als Balken, „Top"-Badge für Führenden, Yield-Differenz). Aus den ersten zwei `victron.mppts`.
- Platzierung: neue 2-Spalten-Zeile zwischen Shelly-Karte und Hoymiles/Trucki/Victron. Rein Frontend, keine Backend-Änderung.
- Verifiziert: testing_agent iteration_7 (Frontend 100%, Werte konsistent, Live-Polling ok, keine Konsolenfehler).

### 2026-07: Round-Trip-Effizienz-Kachel (P2)
- `RoundTripCard.jsx` im Dashboard (Summary-Spalte unter Akku): Ring-Gauge Akku-Wirkungsgrad (AC-Entladeenergie ÷ DC-Ladeenergie) + Geladen (MPPT/DC) vs. Entladen (SUN/AC) kWh heute. Ringfarbe adaptiv (≥85% grün / ≥70% cyan / sonst orange). „–" + Hinweis bei <0,05 kWh Ladung.
- Backend: Poller-Snapshot um `battery_charge_w`/`battery_discharge_w` erweitert; `/api/today` liefert `battery_charge_kwh`, `battery_discharge_kwh`, `round_trip_pct` (Trapez, 0–100 geclamped, Fallback aus netto `battery_power` für Alt-Snapshots).

### 2026-07: Bugfix Backend-Startup-Crash (KeyError: 'forecast')
- Ursache: `get_config()`-Merge lief über hartkodierte Key-Liste `[..., "forecast"]`; bei Config-Drift (Key fehlt in DEFAULT_CONFIG) → KeyError beim Startup → uvicorn Exit-Code 3 (Restart-Loop auf LXC 220).
- Fix: Merge iteriert jetzt über `DEFAULT_CONFIG.items()` (nur Nested-Dicts) → driftsicher, kein KeyError mehr.
- Tests: `test_get_config_merge.py` (2) + `test_today_round_trip_fields`. Gesamt 41 pytest grün. testing_agent iteration_6: 40/41 (1 flaky Poller-Test, kein App-Bug), keine kritischen Issues.
- Deployment: User muss auf LXC 220 `git pull` + `systemctl restart solar-backend`.

## Frühere Meilensteine (Kurzfassung)
- DC-gekoppeltes Energiemodell + Hoymiles/AhoyDTU-Parser + Netz/Akku-Trennung (Trucki ACDISPLAY/ACSETPOINT).
- InfluxDB/Grafana-Ausbau: 2 Dashboards (Org `Solar Lokal`, Bucket `solar`), reiche Measurements pro Gerät/Phase/Kanal/MPPT.
- MQTT-Logik in `mqtt_client.py` ausgelagert; Victron-Keepalive.
- Proxmox-LXC-Deployment-Skripte (`deploy/proxmox/*`), Build-Härtung.

## Backlog (P1/P2)
- P2: MPPT-Vergleich/Schieflast auch als Grafana/InfluxDB-Verlaufspanel.
- P2: Round-Trip-Effizienz als Grafana/InfluxDB-Verlaufspanel (Akku-Alterung über Wochen/Monate).
- P2: Config Export/Import (JSON), Wochen-/Monats-Verlauf + CSV-Export.
- Refactor (aufgeschoben, Regressionsrisiko): große UI-Komponenten (`Dashboard.jsx`/`EnergyFlow.jsx`), server.py >700 Zeilen aufteilen, on_event → lifespan.
- P1: reale Victron-Endpunkte je nach VenusOS-Setup, MQTT Topic-Mapping zu Live-Werten.

## Mocked vs. Live
- MOCKED im Demo-Modus: Shelly/Ahoy/Trucki/Victron aus Generatoren.
- LIVE bei deaktiviertem Demo-Modus: MQTT bevorzugt, HTTP-Fallback.
