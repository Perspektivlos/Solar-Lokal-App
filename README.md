# Solar-Lokal-App

Die **Solar-Lokal-App** ist eine lokal betriebene Webanwendung zur Visualisierung, Analyse und intelligenten Steuerung von PV-Anlagen, Batteriespeichern, Wechselrichtern und Netzanschlüssen im eigenen Heimnetzwerk.

Die App ist komplett **cloudfrei** ausgelegt und für den ressourcensparenden Betrieb auf Mini-PCs oder in Proxmox-LXC-Containern optimiert.

<p align="center">
  <img width="810" height="922" alt="Solar-Lokal-App Dashboard" src="https://github.com/user-attachments/assets/b7e91deb-9916-4f55-abad-7cd10c3761bc" />
</p>

---

## Übersicht

Solar-Lokal-App verbindet mehrere lokale Energiekomponenten in einem physikalisch korrekten DC-gekoppelten System:

- **Victron SmartSolar MPPTs** laden die Batterie direkt auf der DC-Seite.
- **Hoymiles HM1500 + AhoyDTU** wandeln PV-Energie in AC für das Hausnetz.
- **Trucki2Shelly Gateway + Lader/Inverter (SUN)** steuern die Batterie-Entladung ins Hausnetz.
- **Shelly Pro 3EM** misst den Netto-Stromfluss am Netzanschlusspunkt dreiphasig.

Die Architektur vermeidet Doppelzählungen, indem sie die Batterie-Ladeleistung nicht als Hausverbrauch einbezieht und stattdessen die tatsächlichen Flüsse von PV, Batterie und Netz sauber trennt.

---

## Kernfunktionen

- **Live-Energiefluss-Dashboard** mit animierter Visualisierung von PV, Batterie, Netz und Hausverbrauch.
- **Batterie Round-Trip-Wirkungsgrad** als Live-Kachel auf dem Dashboard.
- **Diagnose-Zentrale** mit Selbsttests, Rohdatenansicht und Fehleranalyse.
- **Konfigurierbare Integration** für MQTT-Broker, InfluxDB, Victron MPPTs und lokale Geräte.
- **Historische Auswertung** über InfluxDB 2.x und fertige Grafana-Dashboards.

---

## Unterstützte Geräte

- **Shelly Pro 3EM** (Netzanschlusspunkt, 3-Phasen-Leistung, Spannung, Strom, PF)
- **Hoymiles HM1500 + AhoyDTU** (modulgenaue Kanalwerte `ch1`–`ch4`)
- **Trucki2Shelly Gateway** (`Trucki/ACDISPLAY`, `Trucki/ACSETPOINT`, `Trucki/METER`)
- **Victron SmartSolar MPPTs** via MQTT-Bridge-Topics

---

## Architektur-Highlights

- Physikalisch korrektes Verbrauchsmodell mit der Formel:

  ```text
  Hausverbrauch = PV_AC (Hoymiles) + Batterie-Entladung (SUN) + Netzbezug/Einspeisung (Shelly)
  ```

- Unterschiedliche Darstellung von:
  - **Laden (MPPT/DC)**
  - **Entladen (SUN/AC)**
  - **Netzbezug / Einspeisung**

- Robuste Parser-Logik für MQTT/JSON-Payloads und lokale REST-Schnittstellen.

---

## Deployment

Die Proxmox-Deploymentskripte befinden sich in `deploy/proxmox/`.

- `deploy/proxmox/pve-create-lxc.sh`
- `deploy/proxmox/install.sh`
- `deploy/proxmox/build-app.sh`
- `deploy/proxmox/pve-create-influxdb-lxc.sh`

### Grafana-Setup

Fertige Dashboards liegen in `deploy/proxmox/grafana/`:

- `solar-influxdb-dashboard.json`
- `solar-devices-dashboard.json`
- `INFLUXDB-GRAFANA-SETUP.md`

Weitere Details zum InfluxDB/Grafana-Setup finden Sie hier:

- `deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md`

---

## Entwicklung & Tests

### Backend

Im Verzeichnis `backend/` befindet sich das FastAPI-Backend mit MQTT-Parsern, InfluxDB-Writer und Tests.

Installieren und ausführen:

```bash
cd backend
pip install -r requirements.txt
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/
```

### Frontend

Das React-Frontend im Verzeichnis `frontend/` verwendet React 19, Tailwind CSS und shadcn/ui-Komponenten.

Installieren und starten:

```bash
cd frontend
yarn install
yarn dev
```

Build für Produktion:

```bash
yarn build
```

---

## Aktueller Status

- Physikalisch korrekte Abbildung des DC-gekoppelten Energieflusses
- Batterie-Ladeleistung wird nicht mehr als Hausverbrauch doppelt gezählt
- Gehartete, modulgenaue Hoymiles/AhoyDTU-Auswertung
- Live-Round-Trip-Wirkungsgrad für die Batterie
- InfluxDB-Integration mit fertigen Grafana-Dashboards
- Deployment-Härtungen für Proxmox LXC

Siehe auch den aktuellen Entwicklungsstand in `STATUS_UPDATE.md`.

---

## Wichtige Dateien

- `README.md` — Projektbeschreibung und GitHub-Startseite
- `STATUS_UPDATE.md` — aktueller Stand und Release-Übersicht
- `COPYRIGHT.md` — rechtliche Hinweise
- `deploy/proxmox/` — Deployment- und Grafana-Skripte
- `backend/` — Backend-Code, Parser, Tests
- `frontend/` — Frontend-Code, UI und Dashboard

---

## Lizenz & Copyright

**Solar-Lokal-App**

Copyright (c) 2026 T. Hauck (GitHub: [Perspektivlos](https://github.com/Perspektivlos)), Organisation: **THCoding**.

Dieses Projekt ist aktuell privat und nicht zur freien Wiederverwendung lizenziert. Details entnehmen Sie bitte `COPYRIGHT.md` oder kontaktieren Sie uns über [THCentral.de](https://THCentral.de).
