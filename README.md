# Solar-Lokal-App

Die **Solar-Lokal-App** ist eine hochgradig modulare, lokale Webanwendung zur Visualisierung, Analyse und intelligenten Steuerung von Energieanlagen (Photovoltaik, Batteriespeicher, Wechselrichter und Stromzähler) im eigenen Heimnetzwerk.

Die App arbeitet komplett **cloudfrei**, ist für den ressourcensparenden Betrieb auf Mini-PCs (z. B. via Proxmox LXC) optimiert und bietet eine moderne Steuerzentrale im **Dark Glassmorphism Sci-Fi-Stil** mit Neon-Akzenten.

<div align="center">
  <img width="428" height="447" alt="Vorschau Dashboard" src="https://github.com/user-attachments/assets/cb13afc1-8cc3-4a2b-8972-1b870d9c063c" />
</div>

---

## 1. Systemarchitektur & Physik (DC-Kopplung)

Die App basiert auf einem physikalisch präzisen Modell eines **DC-gekoppelten Systems**. Im Gegensatz zu reinen AC-Systemen fließen die Energieströme hier auf unterschiedlichen Ebenen zusammen:

1. **Victron SmartSolar MPPTs**: Laden die Batterie direkt auf der **DC-Seite** (Gleichstrom).
2. **Hoymiles HM1500 (über AhoyDTU)**: Wandelt PV-Energie direkt in **AC-Wechselstrom** für das Hausnetz um.
3. **Trucki2Shelly Gateway + Lader/Inverter (SUN)**: Entlädt die Batterie kontrolliert auf die **AC-Seite** (Wechselstrom) ins Hausnetz bzw. regelt die Nulleinspeisung.
4. **Shelly Pro 3EM**: Misst den tatsächlichen Stromaustausch am Netzanschlusspunkt (3-phasig).

### Das Energie- und Verbrauchmodell (Formel)

Um Fehlberechnungen und die Doppelzählung von Ladeleistungen zu vermeiden, ermittelt das Backend die tatsächliche Hauslast (**House Consumption**) nach folgender, physikalisch korrekter Formel:

$$\text{Hausverbrauch} = \text{PV\_AC (Hoymiles)} + \text{Batterie-Entladung (SUN)} + \text{Netzbezug/Einspeisung (Shelly)}$$

*Hinweis:* Die DC-Ladeleistung der Victron MPPTs lädt direkt die Batterie und wird **nicht** direkt als Hauslast gezählt. Das Laden und Entladen der Batterie wird im animierten Energiefluss-Diagramm getrennt und überschneidungsfrei visualisiert:

- **Laden (MPPT/DC)**: Eine diagonale Energiefluss-Linie führt direkt von den Solarpanels (PV) zur Batterie.
- **Entladen (SUN/AC)**: Der Fluss läuft von der Batterie zurück ins Hausnetz.

---

## 2. Unterstützte Geräte & Parsing-Logik

Das Backend fragt die Geräte im lokalen Netzwerk via MQTT (über einen zentralen Mosquitto-Broker) und REST-APIs ab:

*   **Shelly Pro 3EM (Netzzähler)**:
    *   3-Phasen-Energiemessung (L1, L2, L3) für Wirkleistung, Spannung, Stromstärke und Leistungsfaktor (PF).
    *   Schnittstelle: MQTT oder direkte REST-Abfrage (`/rpc/EM.GetStatus`) mit Fallback.
*   **Hoymiles HM1500 + AhoyDTU**:
    *   **Kanalgenaues Parsing**: Die App parst die JSON-Payloads je Solarmodul-Kanal (`HM1500/ch1` bis `HM1500/ch4`) für DC-Leistung, Spannung und Stromstärke, anstatt nur den aggregierten Kanal 0 anzuzeigen.
    *   Wirkleistungslimit-Rücklesung direkt aus dem Topic `ack_pwr_limit`.
*   **Trucki2Shelly Gateway**:
    *   **Batterieleistung**: Wird aus dem Topic `Trucki/ACDISPLAY` (tatsächlicher Wechselrichter-Ausgang) bezogen, mit Fallback auf `Trucki/ACSETPOINT`. Dies behebt Messwert-Kopplungen, bei denen fälschlicherweise das Rückmeldesignal `Trucki/METER` (Netz-Zähler) genutzt wurde.
    *   **Lastkompensation**: Dynamische Schätzung des Ladezustands (SoC) aus der Batteriespannung ($16\text{S } \text{LiFePO}_4$ Kurve), korrigiert um den Spannungsabfall unter Last (Batteriestromstärke).
*   **Victron SmartSolar MPPTs (VenusOS Large)**:
    *   Direktes Abgreifen der DC-Ertragsdaten pro MPPT-Instanz via MQTT-Bridge-Topics (`N/<vrm_id>/solarcharger/<instance>/...`).

---

## 3. Hauptfunktionen & UI-Highlights

*   **Live-Dashboard mit animiertem Fluss**:
    *   Ein interaktives SVG-Flussdiagramm verbindet Solarmodule, Wechselrichter, Batterie, Haus und Stromnetz.
    *   Die Animationsgeschwindigkeit und die Flussrichtung der Partikel (`stroke-dasharray`) passen sich dynamisch und stufenlos den realen Watt-Leistungen an.
    *   Richtungspfeile direkt auf den Linien ersetzen überflüssige doppelte Zahlenwerte für maximale Übersicht.
*   **Batterie Wirkungsgrad-Kachel (Round-Trip-Efficiency)**:
    *   Errechnet tagesaktuell das Verhältnis der entnommenen AC-Energie zur geladenen DC-Energie:
        $$\text{Effizienz \%} = \frac{\text{Entladene AC-Energie (SUN) heute in kWh}}{\text{Geladene DC-Energie (MPPT) heute in kWh}} \times 100$$
    *   Farblich adaptive Anzeige (grün bei hoher Effizienz $\ge 85\%$, cyan $\ge 70\%$, sonst orange) inklusive tagesaktueller kWh-Zähler für Ladung und Entladung.
*   **Diagnose-Zentrale (Self-Tests & Raw Data)**:
    *   **Automatisierter Selbsttest**: Prüft auf Knopfdruck die Erreichbarkeit und Integrität des Backends, der MongoDB-Datenbank, des Hintergrund-Pollers, des MQTT-Brokers sowie aller 4 Energiekomponenten.
    *   **Rohdaten-Tabellen**: Direkte Einsicht in die zuletzt empfangenen JSON-Payloads und MQTT-Rohdaten aller Hardwaregeräte zur schnellen Fehlerdiagnose.
*   **Integrationen & Konfiguration**:
    *   Einstellungs-UI für MQTT-Broker (Server, Port, User, Passwort), InfluxDB-Verbindung und Victron-MPPT-Instanzen.
    *   **Intelligenter Neustart**: Das Backend startet Integrationsprozesse bei Einstellungsänderungen nur dann neu, wenn verbindungsrelevante Keys geändert wurden (z. B. IP-Adressen). Kleinere UI-Anpassungen unterbrechen den Datenfluss nicht.

---

## 4. Langzeit-Analyse mit InfluxDB & Grafana

Für detaillierte historische Analysen bietet das Projekt eine vollständige InfluxDB 2.x und Grafana Integration:

### Reiche Datenpunkte (Measurements)
Im 15-Sekunden-Takt schreibt das Backend detaillierte, mehrdimensionale Datenpunkte in InfluxDB:
-   `solar`: Gesamtsystem-Metriken inkl. `pv_power`, `grid_power`, `battery_power`, `house_power`, `battery_soc`, sowie sekündlich berechneter Autarkie- und Eigenverbrauchsrate (`autarky_pct`, `self_consumption_pct`).
-   `shelly_phase`: Einzelphasen-Leistung, -Spannung und -Strom (L1, L2, L3).
-   `hoymiles_ch`: Modulspezifische Erträge der Kanäle CH1 bis CH4.
-   `victron_mppt`: Ertragsdaten und Gerätestatus (Bulk, Absorption, Float) je MPPT-Laderegler.
-   `trucki`: Detaillierte Batterie-Betriebsdaten (Zellspannung `vbat`, AC-Ausgang, ZEPC-Status, Temperatur).

### Zwei vorgefertigte Grafana-Dashboards (`deploy/proxmox/grafana/`)
1.  **Übersichts-Dashboard (`solar-influxdb-dashboard.json`)**: Visualisiert die wichtigsten KPIs des aktuellen Tages, den Leistungsverlauf und den Ladezustand der Batterie.
2.  **Geräte-Detail-Dashboard (`solar-devices-dashboard.json`)**: Zeigt detaillierte Phasen-Belastungen des Shellys, Modul-Erträge des Hoymiles, Ladekurven der Victron MPPTs sowie Status-Metriken des Trucki-Gateways.

*Styling-Highlights:* Beide Dashboards sind im **App-Neon-Design** gestaltet (PV Gelb `#FACC15`, Netz Rot `#F87171`, Autarkie/Einspeisung Grün `#10B981`, Batterie Cyan `#06B6D4`, Haus Silber `#cbd5e1`), verwenden transparente Panel-Hintergründe und bieten gegenseitige Cross-Links für eine nahtlose Navigation.

---

## 5. Installation & Deployment auf Proxmox VE

Das Projekt liefert automatisierte Skripte im Verzeichnis `deploy/proxmox/`, um die Anwendung sicher und isoliert als LXC-Container unter Proxmox bereitzustellen.

### Ressourcen-Empfehlungen für den LXC-Container:
-   **CPU**: 2 vCPUs (reicht vollkommen aus).
-   **RAM**: 1 GB (2 GB empfohlen für den initialen Build-Prozess).
-   **Speicher**: 8 GB (der Speicherbedarf für MongoDB-Snapshots beträgt bei einem 15s-Intervall nur ca. 50 MB pro Monat).

### Schnell-Installation (Schritt für Schritt)

1.  **Repository klonen & Code vorbereiten**:
    Klonen Sie das Repository auf Ihrem lokalen Rechner und packen Sie die relevanten Verzeichnisse:
    ```bash
    tar czf solar-dashboard.tar.gz --exclude='node_modules' --exclude='__pycache__' --exclude='.venv' --exclude='build' --exclude='.git' backend frontend deploy
    scp solar-dashboard.tar.gz root@<DEIN_PROXMOX_IP>:/root/
    ```

2.  **LXC-Container erstellen (auf dem Proxmox-Host)**:
    Legen Sie die Skripte `pve-create-lxc.sh` und `install.sh` im Proxmox-Host unter `/tmp` ab und führen Sie sie aus:
    ```bash
    bash pve-create-lxc.sh
    ```
    Das Skript erstellt einen Debian-basierten LXC-Container, installiert MongoDB, Python 3, Node.js, Yarn, Nginx und konfiguriert die Systemd-Dienste.

3.  **Code übertragen und App bauen**:
    ```bash
    pct push 220 /root/solar-dashboard.tar.gz /opt/solar-dashboard.tar.gz
    pct exec 220 -- bash -lc 'cd /opt && mkdir -p solar-dashboard && tar xzf solar-dashboard.tar.gz -C solar-dashboard && rm solar-dashboard.tar.gz'
    pct exec 220 -- bash -lc '/opt/solar-dashboard/deploy/proxmox/build-app.sh'
    ```
    Die App ist nun im lokalen Netzwerk unter der konfigurierten Container-IP erreichbar (Standard: `http://192.168.0.220/`).

### InfluxDB & Grafana Setup
-   Führen Sie das Skript `pve-create-influxdb-lxc.sh` auf dem Proxmox-Host aus, um InfluxDB 2.7 in einem separaten LXC-Container mit der Organisation `Solar Lokal` und dem Bucket `solar` zu installieren.
-   Importieren Sie die Dashboards aus `deploy/proxmox/grafana/` in Ihr bestehendes Grafana. Detaillierte Schritte finden Sie im Setup-Guide: **[`INFLUXDB-GRAFANA-SETUP.md`](deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md)**.

---

## 6. Entwicklung & Lokales Testen

### Backend (FastAPI + Pytest)
1.  Python-Abhängigkeiten im `backend`-Verzeichnis installieren:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```
2.  Tests ausführen (erfordert gesetzte Dummy-Umgebungsvariablen für MongoDB-Importe):
    ```bash
    MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. python -m pytest tests/
    ```

### Frontend (React 19 + Tailwind)
1.  Abhängigkeiten installieren:
    ```bash
    cd frontend
    yarn install
    ```
2.  Entwicklungsserver starten:
    ```bash
    yarn dev
    ```
3.  Produktions-Build manuell erstellen:
    ```bash
    yarn build
    ```

---

## 7. Troubleshooting & Wartung

*   **MongoDB startet nicht (`mongod` status failed)**:
    Ältere CPUs unterstützen eventuell kein AVX. Prüfen Sie die Logs mit `journalctl -u mongod -n 50`. Weichen Sie im LXC ggf. auf eine ältere MongoDB-Version aus (z. B. `mongodb-org=7.0.5`) oder migrieren Sie den Container auf einen moderneren CPU-Kern.
*   **Yarn Build bricht mit Out-of-Memory (OOM) ab**:
    Erhöhen Sie den RAM des LXC-Containers während des Builds temporär auf 2 GB:
    ```bash
    pct set 220 --memory 2048
    ```
    Das Skript `build-app.sh` limitiert die Node-Speichernutzung automatisch via `NODE_OPTIONS=--max-old-space-size=2048` und startet das Backend vor dem Frontend-Build, damit die API auch bei Build-Verzögerungen erreichbar bleibt.
*   **Service-Logs einsehen**:
    ```bash
    # Backend-Dienst live verfolgen
    journalctl -u solar-backend -f
    ```

---

## 8. Rechtliches & Mitwirkung

**Solar-Lokal-App**

Copyright (c) 2026 T. Hauck (GitHub: [Perspektivlos](https://github.com/Perspektivlos)), Organisation: **THCoding**.

Dieses Projekt ist aktuell privat und nicht zur freien Wiederverwendung lizenziert. Details entnehmen Sie bitte `COPYRIGHT.md` oder kontaktieren Sie uns über [THCentral.de](https://THCentral.de).
