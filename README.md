# Solar-Lokal-App

Die Solar-Lokal-App ist eine modulare Webanwendung zur lokalen Visualisierung und Steuerung von Energieanlagen (z. B. PV, Batteriespeicher, Wechselrichter, IoT‑Sensoren). Sie läuft ohne externen Cloud-Dienst im eigenen Netzwerk und kommuniziert typischerweise über MQTT und REST APIs mit angebundenen Geräten.

  <p align="center"><img width="810" height="922" alt="Screenshot 2026-07-15 221159" src="https://github.com/user-attachments/assets/b7e91deb-9916-4f55-abad-7cd10c3761bc" /></p>


## Überblick
[page:1]
Modernes Dashboard für Solarenergie im lokalen Netzwerk, um Messwerte abzurufen, Geräte zu steuern und zu konfigurieren.

Der Fokus liegt auf:
- Übersichtlichen Live-Daten (Leistung, Energie, Zustände)
- Konfiguration und Steuerung von Geräten
- Lokalem Betrieb (Proxmox / Home-Lab / Edge-Geräte)

## Architektur

Die Anwendung ist in **Frontend** und **Backend** getrennt und wird durch zusätzliche Komponenten unterstützt.

- `frontend/`  
  JavaScript-basierte Single-Page-App (SPA) mit modernen UI-Komponenten für Dashboards, Diagramme und Konfigurationsseiten.

- `backend/`  
  Python‑basierte API-Schicht, die Datenquellen (z. B. MQTT-Broker, Messgeräte, Datenbanken) abfragt, aufbereitet und dem Frontend via HTTP/JSON bereitstellt.

- `memory/`  
  Persistente Ablage für historische Daten, Konfigurationen oder interne Zustände der App (z. B. Zeitreihen, Geräteeinstellungen, User-Settings).

- `tests/` und `test_reports/`  
  Automatisierte Tests und generierte Testberichte zur Sicherstellung der Funktionalität.

- `deploy/proxmox/`  
  Deployment-Artefakte und Skripte, um die App in einer Proxmox-Umgebung (z. B. LXC/VM) bereitzustellen.

## Hauptfunktionen

Die Solar-Lokal-App stellt typischerweise folgende Funktionen bereit:

- Live-Dashboard für PV‑Leistung, Netzbezug, Batteriestatus und weitere Energieflüsse  
- Darstellung historischer Daten (Energieerträge, Verbrauch, Zustände)  
- Steuerung und Konfiguration angeschlossener Geräte über das lokale Netzwerk  
- MQTT‑Integration zur Kopplung mit vorhandenen IoT‑Setups und Energie-Monitoring-Stacks  
- Lokale, browserbasierte Weboberfläche ohne Cloud-Abhängigkeit

Konkrete Endpunkte und UI-Funktionen ergeben sich aus der jeweils konfigurierten Umgebung und angeschlossenen Geräten.

## Installation & Setup

### Voraussetzungen

- Proxmox-Host oder anderer Linux-Server für den Backend‑Dienst  
- Node.js/Yarn oder ein bestehendes Build-Artefakt für das Frontend  
- Python-Umgebung für das Backend (z. B. `venv`)  
- Lokaler MQTT‑Broker (z. B. Mosquitto), falls MQTT genutzt wird  

### Backend

1. Repository klonen:
   ```bash
   git clone https://github.com/Perspektivlos/Solar-Lokal-App.git
   cd Solar-Lokal-App/backend
   ```
2. Python-Abhängigkeiten installieren (Beispiel):
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Backend starten (Beispiel):
   ```bash
   python main.py
   ```

### Frontend

1. In das Frontend-Verzeichnis wechseln:
   ```bash
   cd ../frontend
   ```
2. Abhängigkeiten installieren:
   ```bash
   yarn install
   ```
3. Entwicklung oder Produktion:
   ```bash
   # Entwicklung
   yarn dev

   # Produktion (Beispiel)
   yarn build
   yarn start
   ```

Je nach tatsächlicher Projektstruktur können die konkreten Skripte (`package.json` / Backend-Entry-Point) abweichen.

## Konfiguration

Typische Konfigurationsparameter (je nach Implementierung):

- Backend:
  - MQTT-Broker-Adresse, Port, Benutzer/Passwort
  - Datenquellen (z. B. Topics, REST-Endpunkte, Modbus-Gateways)
  - Speicherpfade für historische Daten (`memory/`)

- Frontend:
  - Basis-URL des Backends (API-Endpoint)
  - Anzeigeeinstellungen für Diagramme und Widgets
  - Lokale Sprache und Einheiten (z. B. kW, kWh)

Konfigurationsdateien sind in der Regel im Backend/Frontend-Verzeichnis oder als `.env` abgelegt.

## Proxmox-Deployment

Im Verzeichnis `deploy/proxmox/` liegen Skripte und/oder Templates, um die Solar-Lokal-App in einer Proxmox-Umgebung auszurollen.[page:1] Übliche Schritte:

- Erstellen einer VM oder eines LXC-Containers mit geeigneter Basis-Distribution  
- Ausführen der Deployment-Skripte aus `deploy/proxmox/`  
- Konfiguration von Netzwerk und ggf. Reverse-Proxy, um die Weboberfläche im LAN verfügbar zu machen

Details hängen von den dort hinterlegten Skripten und Templates ab.

## Entwicklung & Tests

- Quellcode ist überwiegend in **JavaScript** (Frontend) und **Python** (Backend) implementiert; Shell-Skripte unterstützen Deployment und Hilfsfunktionen.
- Tests und Testberichte befinden sich in `tests/` und `test_reports/` und können über die jeweils vorgesehenen Test-Skripte ausgeführt werden.

Beispiel (Frontend):
```bash
cd frontend
yarn test
```

Beispiel (Backend):
```bash
cd backend
pytest
```

## Mitwirkung

Pull Requests, Issues und Erweiterungen sind willkommen, insbesondere für:

- Neue Datenquellen (Inverter, Batteriemanagement, IoT‑Devices)  
- Erweiterte Dashboards und Visualisierungen  
- Verbesserte Proxmox-Deployment-Templates  
- Integration mit gängigen Energie-Management-Systemen und MQTT‑Stacks

Bitte vor größeren Änderungen ein Issue anlegen und die geplanten Anpassungen kurz beschreiben.

## Lizenz

Hinweis in der Copyright.md !
