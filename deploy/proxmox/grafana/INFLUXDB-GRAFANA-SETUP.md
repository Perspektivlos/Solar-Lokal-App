# InfluxDB + Grafana – Setup-Guide (Langzeit-Analyse)

Diese Anleitung verbindet das **Solar Lokal-Dashboard** mit **InfluxDB 2.x** (Time-Series-Speicher)
und visualisiert die Langzeit-Daten in deiner **bestehenden Grafana-Instanz** (LXC 102,
`http://192.168.0.91:3000`).

```
   Solar-Dashboard ──(schreibt alle 15s)──▶  InfluxDB 2.x  ◀──(liest, Flux)──  Grafana
   (Backend, LXC 220)                        (LXC 203, :8086)                  (LXC 102, :3000)
```

Datenmodell, das das Dashboard schreibt (sobald InfluxDB aktiv ist):

| Measurement     | Tags         | Felder                                                                 |
|-----------------|--------------|------------------------------------------------------------------------|
| `solar`         | –            | `pv_power`, `grid_power`, `battery_power`, `house_power`, `battery_soc`, `autarky_pct`, `self_consumption_pct` |
| `shelly_phase`  | `phase`      | `power`, `voltage`, `current`, `pf`                                     |
| `shelly`        | –            | `total_power`                                                          |
| `hoymiles`      | –            | `total_power`, `limit_percent`                                         |
| `hoymiles_ch`   | `ch`         | `power`, `voltage`, `current`, `yield_day`                             |
| `victron`       | –            | `total_power`                                                         |
| `victron_mppt`  | `mppt`       | `pv_power`, `pv_voltage`, `battery_voltage`, `yield_today`, `state`     |
| `trucki`        | –            | `vbat`, `ac_power`, `soc`, `zepc`, `temperature`, `ac_setpoint`, `ac_display`, `day_energy`, `total_energy` |

Leistungen in Watt, SoC/Autarkie/Eigenverbrauch in %, Energie in kWh.

Org = `Solar Lokal` · Bucket = `solar`

---

## ✅ Check & Repair – deine Werte (THcoding / Solar Lokal)

| Einstellung    | Wert |
|----------------|------|
| InfluxDB-URL   | `http://192.168.0.203:8086` |
| Organisation   | `Solar Lokal` *(mit Leerzeichen!)* |
| Bucket         | `solar` |
| Grafana-URL    | `http://192.168.0.91:3000` |

> **WICHTIG – reiche Daten erst nach Backend-Update:** Erscheinen im InfluxDB
> *Data Explorer* nur die 5 alten Felder (`pv_power`, `grid_power`,
> `battery_power`, `house_power`, `battery_soc`) und **keine** Tags
> (`No tag keys found`), dann läuft auf der Backend-LXC (220) noch die **alte
> Version**. Nach dem Update (neueste Code-Version pullen + Backend neu starten)
> schreibt das Backend zusätzlich `autarky_pct`, `self_consumption_pct` sowie die
> Measurements `shelly_phase`, `hoymiles`, `hoymiles_ch`, `victron`,
> `victron_mppt`, `trucki`. Erst danach zeigen beide Grafana-Dashboards alle Panels.
>
> ```bash
> # auf der Backend-LXC 220
> cd /opt/solar-dashboard        # oder dein Repo-Pfad
> git pull
> systemctl restart solar-backend
> # Prüfen: Diagnose-Tab -> InfluxDB "verbunden, Writes steigen",
> #         InfluxDB Data Explorer -> Measurements shelly_phase/trucki/... sichtbar
> ```

---

## Schritt 1 — InfluxDB als LXC installieren

> **Bereits vorhanden?** Läuft InfluxDB schon (in dieser Umgebung: **LXC ID 101**,
> `http://192.168.0.203:8086`), dann **diesen Schritt überspringen** und direkt mit
> Schritt 2 weitermachen. Stelle in deiner InfluxDB nur sicher, dass es eine
> **Organisation** (`Solar Lokal`), einen **Bucket** (`solar`) und einen **API-Token** gibt:
>
> ```bash
> # in der bestehenden InfluxDB-LXC (z.B. ID 101)
> pct enter 101    # oder per SSH
> influx org create   --name "Solar Lokal"                 2>/dev/null || true
> influx bucket create --name solar --org "Solar Lokal"    2>/dev/null || true
> influx auth create  --org "Solar Lokal" --all-access --description "solar-dashboard"
> #  -> den ausgegebenen Token notieren (für Schritt 2 + Grafana)
> ```
> Org/Bucket dürfen auch anders heißen – dann in Schritt 2 (Integrationen) und in
> Grafana entsprechend eintragen.

Falls **noch keine** InfluxDB existiert, auf dem **Proxmox-Host** (`192.168.0.200`) als root:

```bash
# Script auf den Host kopieren (Teil des Repos: deploy/proxmox/)
cd /pfad/zu/deploy/proxmox
chmod +x pve-create-influxdb-lxc.sh

# Optional anpassen (Defaults passen zur PRD):
export CT_ID=203
export CT_IP="192.168.0.203/24"
export CT_GW="192.168.0.1"
export INFLUX_PASSWORD="dein-sicheres-pw"   # min. 8 Zeichen
# export INFLUX_TOKEN="..."                 # leer = wird zufällig generiert

bash pve-create-influxdb-lxc.sh
```

Am Ende gibt das Script **URL, Org, Bucket und den API-Token** aus. **Token notieren!**

> InfluxDB-UI danach erreichbar unter `http://192.168.0.203:8086`
> (Login: `admin` / dein `INFLUX_PASSWORD`).

---

## Schritt 2 — Dashboard-Backend mit InfluxDB verbinden

Im Solar-Dashboard (Web-UI):

1. **Integrationen** → Karte **InfluxDB**
2. Werte eintragen:
   - **URL**: `http://192.168.0.203:8086`
   - **Org**: `Solar Lokal`
   - **Bucket**: `solar`
   - **Token**: `<Token aus Schritt 1>`
3. Toggle **AN** → **Speichern**
4. Auf **Diagnose** prüfen: Zeile *InfluxDB* sollte **grün** sein und „verbunden · N Writes" zeigen.

Ab jetzt schreibt das Backend alle 15 Sekunden einen Datenpunkt.

---

## Schritt 3 — Datenquelle in Grafana anlegen

In deiner bestehenden Grafana (`http://192.168.0.91:3000`):

**Variante A — über die Oberfläche (empfohlen):**

1. **Connections → Data sources → Add data source → InfluxDB**
2. Einstellungen:
   - **Name**: `InfluxDB-Solar`
   - **Query Language**: **Flux**
   - **URL**: `http://192.168.0.203:8086`
   - **Auth**: alle Toggles aus (keine Basic-Auth)
   - **InfluxDB Details**:
     - **Organization**: `Solar Lokal`
     - **Token**: `<Token aus Schritt 1>`
     - **Default Bucket**: `solar`
3. **Save & test** → muss „datasource is working" melden.

**Variante B — per Provisioning (Datei `influxdb-datasource.yaml`):**

Datei `deploy/proxmox/grafana/influxdb-datasource.yaml` in der Grafana-LXC nach
`/etc/grafana/provisioning/datasources/influxdb-solar.yaml` kopieren (Org `Solar Lokal`
und Token sind dort bereits eingetragen), dann `systemctl restart grafana-server`.

---

## Schritt 4 — Dashboards importieren

Es gibt **zwei** Dashboards – beide gleich importieren:

| Datei | Inhalt | UID |
|-------|--------|-----|
| `solar-influxdb-dashboard.json` | **Übersicht**: PV/Netz/Haus/SoC-Kacheln, Leistungsfluss, SoC-Verlauf, kWh-Energie, Autarkie heute | `solar-lokal` |
| `solar-devices-dashboard.json`  | **Geräte-Detail**: Shelly pro Phase, Hoymiles CH1–CH4, Victron pro MPPT, Trucki (VBAT/AC/SoC/Temp), Autarkie & Eigenverbrauch-Verlauf | `solar-geraete` |

Pro Datei:

1. In Grafana: **Dashboards → New → Import**
2. **Upload JSON file** → die jeweilige Datei wählen (oder Inhalt einfügen).
3. Beim Import erscheint die Auswahl **„InfluxDB (Solar)"** → deine Datenquelle
   `InfluxDB-Solar` auswählen.
4. **Import**.

Das **Übersichts-Dashboard** (`solar-lokal`) enthält:
- Live-Kacheln: PV-Leistung, Netz, Hausverbrauch, Batterie-SoC (Gauge)
- Leistungsfluss-Verlauf (PV / Netz / Batterie / Haus)
- Batterie-SoC-Verlauf
- Energie im Zeitraum (kWh, per Integral)
- **Autarkie heute** (Gauge in %): Anteil des Hausverbrauchs, der NICHT aus dem Netz bezogen wurde — berechnet als `(Hausenergie − Netzbezug) / Hausenergie`.

Das **Geräte-Detail-Dashboard** (`solar-geraete`) enthält gruppierte Zeilen:
- **Shelly Pro 3EM**: Leistung & Spannung je Phase (L1–L3)
- **Hoymiles HM1500**: Leistung je Kanal (CH1–CH4), Gesamt-AC, Leistungslimit
- **Victron MPPT**: PV-Leistung & PV-Spannung je MPPT-Instanz
- **Trucki2Shelly**: Akku-Spannung (VBAT), AC-Ausgang/Entladung, SoC-Gauge, Temperatur
- **Autarkie & Eigenverbrauch** (momentaner Verlauf in %)

> Beide Dashboards sind oben über das „Dashboards"-Dropdown verlinkt.
> Auto-Refresh **15s**, Standard-Zeitraum **letzte 24h**.

---

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---------|------------------|
| Grafana „Save & test" schlägt fehl | Falscher Token/Org, oder InfluxDB-LXC nicht erreichbar. `curl http://192.168.0.203:8086/health` testen. |
| Panels „No data" | Demo-Modus zählt nicht? Doch — auch im Demo-Modus wird geschrieben, **sobald InfluxDB in den Integrationen aktiv ist**. Diagnose-Tab prüfen (Writes > 0). |
| Diagnose: InfluxDB rot, „unauthorized" | Token falsch oder Org stimmt nicht (muss exakt `Solar Lokal` sein, mit Leerzeichen). |
| Panels zeigen nur PV/Netz/Haus/SoC, keine Geräte-Details | Backend-LXC läuft noch auf alter Version → neueste Version pullen + `systemctl restart solar-backend` (siehe „Check & Repair" oben). |
| Energie-kWh wirkt zu niedrig | `integral` braucht den vollen Zeitraum — Zeitfenster auf „Today" stellen. |
| Daten brechen ab | Backend lief nicht (15s-Poller). `journalctl -u solar-backend -f` im Dashboard-LXC prüfen. |

---

## Retention / Speicherplatz

Mit dem erweiterten Datenmodell (Summary + Shelly-Phasen + Hoymiles-Kanäle +
Victron-MPPTs + Trucki) werden ca. **40–60 Felder × alle 15s ≈ 250k–350k Punkte/Tag**
geschrieben. InfluxDB komprimiert das stark (typisch < 150 MB/Monat). Für
automatisches Löschen alter Daten kann beim Setup
`INFLUX_RETENTION="365d"` gesetzt werden (Default `0` = unbegrenzt). Nachträglich:

```bash
pct enter 203
influx bucket update --name solar --retention 365d
```
