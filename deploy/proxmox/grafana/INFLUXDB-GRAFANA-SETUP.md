# InfluxDB + Grafana – Setup-Guide (Langzeit-Analyse)

Diese Anleitung verbindet das **Solar Lokal-Dashboard** mit **InfluxDB 2.x** (Time-Series-Speicher)
und visualisiert die Langzeit-Daten in deiner **bestehenden Grafana-Instanz** (LXC 102,
`http://192.168.0.91:3000`).

```
   Solar-Dashboard ──(schreibt alle 15s)──▶  InfluxDB 2.x  ◀──(liest, Flux)──  Grafana
   (Backend, LXC 220)                        (LXC 203, :8086)                  (LXC 102, :3000)
```

Datenmodell, das das Dashboard schreibt:

| Measurement | Felder (alle in Watt, SoC in %)                                          |
|-------------|---------------------------------------------------------------------------|
| `solar`     | `pv_power`, `grid_power`, `battery_power`, `house_power`, `battery_soc`   |

Org = `home` · Bucket = `solar`

---

## Schritt 1 — InfluxDB als LXC installieren

> **Bereits vorhanden?** Läuft InfluxDB schon (in dieser Umgebung: **LXC ID 101**,
> `http://192.168.0.203:8086`), dann **diesen Schritt überspringen** und direkt mit
> Schritt 2 weitermachen. Stelle in deiner InfluxDB nur sicher, dass es eine
> **Organisation** (`home`), einen **Bucket** (`solar`) und einen **API-Token** gibt:
>
> ```bash
> # in der bestehenden InfluxDB-LXC (z.B. ID 101)
> pct enter 101    # oder per SSH
> influx org create   --name home            2>/dev/null || true
> influx bucket create --name solar --org home 2>/dev/null || true
> influx auth create  --org home --all-access --description "solar-dashboard"
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
   - **Org**: `home`
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
     - **Organization**: `home`
     - **Token**: `<Token aus Schritt 1>`
     - **Default Bucket**: `solar`
3. **Save & test** → muss „datasource is working" melden.

**Variante B — per Provisioning (Datei `influxdb-solar.yaml`):**

Datei `deploy/proxmox/grafana/influxdb-datasource.yaml` in der Grafana-LXC nach
`/etc/grafana/provisioning/datasources/` kopieren, Token eintragen, dann
`systemctl restart grafana-server`. (Details in der YAML-Datei.)

---

## Schritt 4 — Dashboard importieren

1. In Grafana: **Dashboards → New → Import**
2. **Upload JSON file** → `deploy/proxmox/grafana/solar-influxdb-dashboard.json` wählen
   (oder Inhalt in das Textfeld einfügen).
3. Beim Import erscheint die Auswahl **„InfluxDB (Solar)"** → deine Datenquelle
   `InfluxDB-Solar` auswählen.
4. **Import**.

Das Dashboard enthält:
- Live-Kacheln: PV-Leistung, Netz, Hausverbrauch, Batterie-SoC (Gauge)
- Leistungsfluss-Verlauf (PV / Netz / Batterie / Haus)
- Batterie-SoC-Verlauf
- Energie im Zeitraum (kWh, per Integral)
- **Autarkie heute** (Gauge in %): Anteil des Hausverbrauchs, der NICHT aus dem Netz bezogen wurde — berechnet als `(Hausenergie − Netzbezug) / Hausenergie`.

> Auto-Refresh steht auf **15s**, Standard-Zeitraum **letzte 24h**.
> Für Tageswerte oben rechts auf **„Today"** umstellen.

---

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---------|------------------|
| Grafana „Save & test" schlägt fehl | Falscher Token/Org, oder InfluxDB-LXC nicht erreichbar. `curl http://192.168.0.203:8086/health` testen. |
| Panels „No data" | Demo-Modus zählt nicht? Doch — auch im Demo-Modus wird geschrieben, **sobald InfluxDB in den Integrationen aktiv ist**. Diagnose-Tab prüfen (Writes > 0). |
| Diagnose: InfluxDB rot, „unauthorized" | Token falsch oder Org stimmt nicht (`home`). |
| Energie-kWh wirkt zu niedrig | `integral` braucht den vollen Zeitraum — Zeitfenster auf „Today" stellen. |
| Daten brechen ab | Backend lief nicht (15s-Poller). `journalctl -u solar-backend -f` im Dashboard-LXC prüfen. |

---

## Retention / Speicherplatz

5 Felder × alle 15s ≈ 28.800 Punkte/Tag. InfluxDB komprimiert das stark
(typisch < 50 MB/Monat). Für automatisches Löschen alter Daten kann beim Setup
`INFLUX_RETENTION="365d"` gesetzt werden (Default `0` = unbegrenzt). Nachträglich:

```bash
pct enter 203
influx bucket update --name solar --retention 365d
```
