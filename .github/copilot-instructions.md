# Copilot-Anleitung für Solar-Lokal-App

## Projektübersicht

**Solar-Lokal-App** ist eine cloudfrei betriebene Webanwendung zur Visualisierung, Analyse und intelligenten Steuerung von PV-Anlagen, Batteriespeichern, Wechselrichtern und Netzanschlüssen im eigenen Heimnetzwerk.

Kernfunktionen:
- Live-Energiefluss-Visualisierung mit animiertem DC-gekoppelten System
- Batterie-Rundlauf-Wirkungsgrad-Tracking (Live-Effizienzberechnung)
- Geräteebenen-Diagnose und Fehleranalyse
- Historische Auswertung via InfluxDB mit Grafana-Dashboards
- Optimiert für ressourcenschwache Umgebungen (Mini-PCs, Proxmox-LXC-Container)

**Repository**: [Perspektivlos/Solar-Lokal-App](https://github.com/Perspektivlos/Solar-Lokal-App)

---

## Build-, Test- und Lint-Befehle

### Frontend (React 19 + Tailwind CSS)

```bash
cd frontend

# Abhängigkeiten installieren
yarn install

# Entwicklungsserver starten (Craco wraps create-react-app)
yarn dev

# Produktions-Build
yarn build

# Tests ausführen
yarn test

# Build verwendet Craco mit:
# - Tailwind CSS + shadcn/ui-Komponentenbibliothek
# - Path-Alias: '@' → 'src/'
# - Visual Edits Support (Emergent-Plattform-Integration)
# - Überwachte Verzeichnisse exclude: node_modules, .git, build, dist
```

### Backend (FastAPI + Python 3.10+)

```bash
cd backend

# Abhängigkeiten installieren
pip install -r requirements.txt

# Alle Tests ausführen (nutzt pytest.ini mit pythonpath=backend)
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/

# Eine einzelne Test-Datei ausführen
PYTHONPATH=. python -m pytest tests/test_solar_dashboard.py -v

# Spezifischen Test nach Name ausführen
PYTHONPATH=. python -m pytest tests/test_mqtt_client.py::test_function_name -v

# Code formatieren (black ist in requirements.txt)
black backend/

# Code-Qualität prüfen (flake8 verfügbar)
flake8 backend/
```

**Hinweis**: Tests benötigen lokales MongoDB. Umgebungsvariablen:
- `MONGO_URL`: MongoDB-Verbindungszeichenfolge (Standard: `mongodb://localhost`)
- `DB_NAME`: Datenbankname für Tests (verwende `test`, um Produktionsdaten nicht zu beeinflussen)

---

## Architekturübersicht

### Systemdesign: DC-gekoppeltes Solarenergie-Modell

Das System implementiert **physikalisch korrekte Energiefluss-Abrechnung** für eine DC-gekoppelte Solaranlage:

```
Energiefluss-Formel:
Hausverbrauch = PV_AC (Hoymiles) + Batterie-Entladung (SUN) + Netzbezug/Einspeisung (Shelly)
```

#### Komponenten

1. **Victron SmartSolar MPPTs** (DC-Ladung)
   - Lädt Batterie direkt auf DC-Seite via MQTT-Bridge-Topics
   - Leistungswerte: `U_DC`, `I_DC`, `P_DC` (Spannung, Strom, Leistung)
   - **Kritisch**: MPPT-Ladeleistung wird NICHT als Hausverbrauch gezählt

2. **Hoymiles HM1500 + AhoyDTU** (AC-PV-Erzeugung)
   - Modulares Design mit Kanälen `ch1`–`ch4` (jedes Modul erzeugt separate MQTT-Topics)
   - Parser liest JSON-Payload aus `HM1500/ch1` bis `HM1500/ch4`
   - Extrahiert: `P_DC`, `U_DC`, `I_DC`, `YieldDay`, Leistungslimit aus `ack_pwr_limit`
   - AC-Ausgabeleistung (`PV_AC`) versorgt zunächst Haus, dann Batterie, dann Netz

3. **Trucki2Shelly Gateway + Wechselrichter/Lader (SUN)** (Batterie-AC-Interface)
   - Steuert Batterie-Entladung ins Hausnetz
   - Topics: `Trucki/ACDISPLAY` (Entladung), `Trucki/ACSETPOINT`, `Trucki/METER`
   - **Kritisch**: Batterie-Entladeleistung aus `Trucki/ACDISPLAY`, nicht aus Netzmesser

4. **Shelly Pro 3EM** (Netzüberwachung)
   - 3-Phasen-Netzanschluss-Überwachung
   - Misst Nettofluss (Import/Export) am Netzanschlusspunkt
   - Leistungen, Spannungen, Ströme, Leistungsfaktoren pro Phase

#### Dashboard-Modell

- **Live-Energiefluss** animierte Visualisierung (Kreisfluss-Diagramm)
- **Batterie-Effizienzkachel** berechnet täglichen Rundlauf-Wirkungsgrad:
  - Formel: `(AC-Energie entladen von SUN) / (DC-Energie geladen von MPPT) × 100`
  - Trapezintegration über 24h in Wh
  - Adaptive Farbausgabe (grün ≥85%, cyan ≥70%, orange sonst)
  - Blendet Anzeige aus, wenn tägliche Ladung < 0,05 kWh (verhindert Division-by-Zero am Morgen)

### Code-Organisation

```
solar-lokal-app/
├── backend/                           # FastAPI-Server + Parser + Tests
│   ├── server.py                      # FastAPI-App-Definition & MQTT-Integration
│   ├── mqtt_client.py                 # MQTT-Abonnement & Payload-Parsing
│   ├── requirements.txt                # Python-Abhängigkeiten
│   ├── tests/
│   │   ├── test_solar_dashboard.py    # Tests für Energiefluss-Modell
│   │   ├── test_mqtt_client.py        # Tests für Parser-Integration
│   │   ├── test_influx_points.py      # Tests für InfluxDB-Zeitreihen
│   │   └── test_get_config_merge.py   # Tests für Konfigurationsmerging
│   └── _run_local.py                  # Lokaler Entwicklungs-Runner
│
├── frontend/                          # React 19 + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── App.js                     # Root-Komponente
│   │   ├── components/                # Wiederverwendbare UI-Komponenten
│   │   │   ├── Dashboard.jsx          # Haupt-Energiefluss-Visualisierung
│   │   │   ├── RoundTripCard.jsx      # Batterie-Effizienzkachel
│   │   │   ├── DevicePanel.jsx        # Geräte-Status-Panel
│   │   │   └── ... (shadcn/ui + benutzerdefiniert)
│   │   ├── pages/                     # Seiten-level-Komponenten
│   │   ├── hooks/                     # Benutzerdefinierte React Hooks
│   │   └── lib/                       # Utility-Funktionen
│   ├── package.json                   # Node-Abhängigkeiten
│   ├── craco.config.js                # Craco Build-Konfiguration
│   └── public/                        # Statische Assets
│
├── deploy/                            # Deployment & Infrastruktur
│   └── proxmox/
│       ├── pve-create-lxc.sh          # LXC-Container-Erstellung
│       ├── install.sh                 # Basis-Installationsskript
│       ├── build-app.sh               # Frontend build + Backend packaging
│       ├── grafana/                   # Grafana-Dashboard JSON-Exporte
│       │   ├── solar-influxdb-dashboard.json
│       │   ├── solar-devices-dashboard.json
│       │   └── INFLUXDB-GRAFANA-SETUP.md
│       └── pve-create-influxdb-lxc.sh # InfluxDB-Container-Setup
│
├── tests/                             # Integrations- & End-to-End-Tests
├── pytest.ini                         # Pytest-Konfiguration
├── README.md                          # Hauptdokumentation
├── STATUS_UPDATE.md                   # Entwicklungsstand & aktuelle Änderungen
├── COPYRIGHT.md                       # Lizenz & Urheberrecht
└── design_guidelines.json             # UI/UX-Design-System
```

---

## Schlüsselkonventionen

### MQTT-Thema-Struktur & Parser-Robustheit

1. **AhoyDTU-Modul-Parsing**
   - Themen: `HM1500/ch1`, `HM1500/ch2`, ..., `HM1500/ch4` (JSON-Payloads)
   - Parser (`fetch_ahoy_from_mqtt`) extrahiert:
     - `P_DC`: DC-Leistung pro Modul (Watt)
     - `U_DC`: DC-Spannung (Volt)
     - `I_DC`: DC-Strom (Ampere)
     - `YieldDay`: Energieertrag seit Mitternacht (kWh)
     - Leistungslimit aus `ack_pwr_limit`
   - **Konvention**: JSON-Parsing immer defensiv durchführen; fehlende Schlüssel standardmäßig 0, nicht Fehler

2. **Trucki Batteriesteuerung**
   - Themen: `Trucki/ACDISPLAY` (Entladeleistung), `Trucki/ACSETPOINT`, `Trucki/METER`
   - **Kritische Quelle**: `Trucki/ACDISPLAY` für tatsächliche Batterieausgabe verwenden, nicht `METER`
   - Parser unterscheidet Laden/Entladen in der Visualisierung

3. **Shelly-Energiemesser**
   - Mehrphasen-Leistung, Spannung, Strom pro Phase
   - Integration in Gesamthaushalt + Nettonetzbezug
   - Konsolidierung von 3-Phasen-Daten für Dashboard-Aggregation

### Backend-Testing & Pytest

- Test-Dateien: `backend/tests/test_*.py`
- Pytest-Konfiguration in `pytest.ini`: `pythonpath = backend` (ermöglicht direkte Imports)
- Häufige Test-Muster:
  - Energiefluss-Berechnungen (Mock MQTT-Nachrichten)
  - Konfigurationsmerging aus JSON-Dateien
  - InfluxDB-Punkt-Generierung
  - Geräte-Parser-Robustheit (fehlende/fehlerhafte Payloads)
- Einzelnen Test ausführen: Füge `-v` für Ausführlichkeit hinzu, verwende `::test_name` für spezifischen Test

### Frontend-Architektur

- **Komponentenstruktur**: Funktionale React-Komponenten + React Hooks (v19 kompatibel)
- **shadcn/ui-Integration**: Vorgefertigte barrierefreie Komponenten (Alert, Card, Dialog, Tabs, etc.)
- **Tailwind CSS**: Utility-First-Styling; kein benutzerdef. CSS außer in `App.css`, `index.css`
- **Styling-Konvention**: Verwende Tailwind-Klassen + `clsx` für bedingte Klassen; vermeide Inline-Styles
- **Erzwungene ESLint-Regeln**:
  - React Hooks-Regeln: alle Dependencies aufgelistet, keine Rules-of-Hooks-Verletzungen
  - Path-Alias: Verwende `@/` für Imports aus `src/` (z.B. `@/components/Dashboard`)

### Konfiguration & Umgebung

- **Frontend-Umgebungsvariablen**: Gesetzt via `process.env.REACT_APP_*` in `craco.config.js`
  - `REACT_APP_VERSION`: Automatisch extrahiert aus `package.json` Version
  - `ENABLE_HEALTH_CHECK`: Auf `"true"` setzen für Dev-Server-Health-Checks
- **Backend-Umgebungsvariablen**: Bezogen aus `.env`-Datei oder direkte Exporte
  - `MONGO_URL`: MongoDB-Verbindung (Dev: `mongodb://localhost`)
  - `DB_NAME`: Datenbankname (Dev: `test`)
  - `PYTHONPATH`: Muss `backend/` für relative Imports enthalten

### InfluxDB & Grafana

- Zeitreihendaten alle 15 Sekunden in InfluxDB 2.x geschrieben
- Vorgefertigte Grafana-Dashboards in `deploy/proxmox/grafana/`:
  - `solar-influxdb-dashboard.json`: Langzeit-Energietrends
  - `solar-devices-dashboard.json`: Pro-Gerät-Überwachung
- Setup-Anleitung: `deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md`

### Dokumentations-Speicherorte

- **Benutzer-/Deploy-Dokumentation**: `README.md`, `deploy/proxmox/README.md`, `STATUS_UPDATE.md`
- **Urheberrecht/Lizenz**: `COPYRIGHT.md` (Privatprojekt, kontaktiere THCoding für Nutzung)
- **Grafana-Setup**: `deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md`
- **Design-System**: `design_guidelines.json` (UI/UX-Muster)

---

## Häufige Aufgaben

### Neue Energiemetrik hinzufügen

1. **Backend**: Parser in `mqtt_client.py` hinzufügen, um von MQTT-Thema zu extrahieren
2. **Tests**: Test-Fall in `backend/tests/test_mqtt_client.py` für Parser-Robustheit hinzufügen
3. **Dashboard**: Card-Komponente in `frontend/src/components/` hinzufügen (verwende shadcn/ui als Basis)
4. **InfluxDB**: Neues Feld in Backend's `influx_points`-Generator registrieren
5. **Grafana**: Panel in entsprechendem Dashboard-JSON hinzufügen

### Energiefluss-Berechnung reparieren

- **Nicht**: Hausverbrauch-Formel ändern, ohne alle drei Quellen (PV_AC, Batterie-Entladung, Netz) zu überprüfen
- **Tun**: Zuerst Energiefluss-Tests in `test_solar_dashboard.py` prüfen
- **Tun**: Sicherstellen, dass keine Doppelzählung erfolgt (MPPT-Ladung sollte nie als Hausverbrauch erscheinen)

### MQTT-Parser-Probleme debuggen

- Mock MQTT-Nachricht im Test mit echtem JSON-Payload erstellen
- Nach fehlenden/Null-Schlüsseln prüfen → Parser sollte standardmäßig 0, nicht Throw, sein
- Überprüfen, ob Topic-Abonnement aktiv ist in `mqtt_client.py`
- Verwende `test_mqtt_client.py` für End-to-End-Parser-Validierung

### Auf Proxmox bereitstellen

1. Stelle sicher, dass Backend & Frontend gebaut sind: `yarn build` + Python-Wheels/Virtualenv
2. Verwende Deployment-Skripte: `deploy/proxmox/pve-create-lxc.sh` → `install.sh` → `build-app.sh`
3. Separater InfluxDB-Container: `pve-create-influxdb-lxc.sh`
4. Grafana-Dashboards aus `deploy/proxmox/grafana/` importieren

---

## GitHub MCP Integration

Der GitHub MCP (Model Context Protocol) Server ist für dieses Repository konfiguriert, um Issue-Tracking, Pull-Request-Management und Repository-Operationen zu optimieren.

### Wichtigste Operationen

**Issue-Verwaltung**
```bash
# Mir zugewiesene Issues auflisten
gh issue list --assignee @me

# Neues Issue erstellen (z.B. Feature-Request)
gh issue create --title "Neue Metrik hinzufügen: Netzfrequenz" --body "Verfolgung von Netzfrequenz-Änderungen im Zeitablauf"

# Issues nach Label oder Status suchen
gh issue list --label "bug" --state open

# Issue-Details ansehen
gh issue view <issue-nummer>

# Kommentare zu Issues hinzufügen
gh issue comment <issue-nummer> --body "Ich arbeite daran"
```

**Pull-Request Workflow**
```bash
# PRs auflisten, die mir zugewiesen sind oder meine Überprüfung benötigen
gh pr list --assignee @me
gh pr list --state open

# Pull Request erstellen
gh pr create --title "Energiefluss-Berechnung reparieren" --body "Behebt #123"

# PR-Status prüfen
gh pr checks <pr-nummer>

# PR-Diff vor Überprüfung ansehen
gh pr view <pr-nummer> --web
```

**Repository-Status**
```bash
# Aktuellen Branch und Status prüfen
gh repo view
gh status

# Aktuelle Commits auflisten
gh api repos/Perspektivlos/Solar-Lokal-App/commits --paginate
```

### Häufige Workflows

1. **Feature-Entwicklung**: Issue erstellen → PR erstellen → Überprüfung anfordern → Merge
2. **Fehlerbehebungen**: Vorhandene Bug-Issues suchen → sich selbst zuweisen → PR mit Issue-Referenz erstellen
3. **Deployment-Updates**: Fortschritt in STATUS_UPDATE.md + zugehöriges Issue verfolgen
4. **Abhängigkeitsupdates**: Issue für Sicherheits-/Funktions-Updates erstellen + PR

### Anmerkungen für GitHub-Operationen

- **Repository**: `Perspektivlos/Solar-Lokal-App` (privat)
- **Branches**: Der Haupt-Entwicklungsbranch ist normalerweise `main` oder `fork-update`
- **Issue-Labels**: Für Kategorisierung verwenden (bug, feature, enhancement, documentation, deployment, etc.)
- **PR-Konventionen**: Zugehörige Issues mit `Resolves #123` oder `Fixes #456` im PR-Body referenzieren
- **CI/CD**: Deployment-Skripte in `deploy/proxmox/` auf automatisierte Build-/Test-Anforderungen prüfen

---

## Hinweise

- **Cloudfrei nach Design**: Alle Daten bleiben lokal; keine externen Cloud-Abhängigkeiten
- **Ressourcenoptimiert**: Designed für Mini-PCs & LXC-Container; vermeide schwere Operationen in Hot-Loops
- **Physikalische Korrektheit zuerst**: Energieabrechnung muss der realen DC-Kopplung entsprechen; kompromittiere nie für UI-Einfachheit
- **Test-Abdeckung**: MQTT-Parser & Energieberechnungen müssen robust getestet sein (Handling fehlerförmiger Eingaben)
- **Privatprojekt**: Respektiere COPYRIGHT.md; kontaktiere THCoding, bevor du Code wiederverwendest

---

**Zuletzt aktualisiert**: August 2026  
**Repository**: [Perspektivlos/Solar-Lokal-App](https://github.com/Perspektivlos/Solar-Lokal-App)
