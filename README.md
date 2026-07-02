# Komplette Deployment-Anleitung Schritt für Schritt

## 🔧 Vorbereitung

Auf deinem PC (Linux/Mac/WSL):

```bash
# Variante GitHub:
git clone https://github.com/<dein-user>/<dein-repo>.git solar-dashboard
cd solar-dashboard
tar czf solar-dashboard.tar.gz \
    --exclude='node_modules' --exclude='__pycache__' --exclude='.venv' \
    --exclude='build' --exclude='.git' \
    backend frontend deploy

# Variante Download-ZIP:
unzip emergent-solar-dashboard.zip
cd solar-dashboard
# Hier ist evtl. schon ein .tar oder du machst:
tar czf solar-dashboard.tar.gz backend frontend deploy

# Tarball auf Proxmox-Host kopieren
scp solar-dashboard.tar.gz root@192.168.0.200:/root/
scp deploy/proxmox/*.sh root@192.168.0.200:/root/
```

## 🏗️ Schritt 1 — LXC erstellen (auf 192.168.0.200)

```bash
ssh root@192.168.0.200
cd /root
chmod +x pve-create-lxc.sh install.sh build-app.sh

# IP statisch setzen (passe an dein Netz an)
export CT_ID=220
export CT_IP="192.168.0.210/24"
export CT_GW="192.168.0.1"
export CT_PASSWORD="MeinSicheresPW123"

bash pve-create-lxc.sh
```

**Was läuft ab:**

1. Ubuntu 24.04 LXC-Template wird ggf. heruntergeladen (~250 MB)
2. Container 220 wird erstellt (2 CPU, 1 GB RAM, 8 GB Disk, IP 192.168.0.210)
3. Container startet
4. `install.sh` läuft automatisch im Container: MongoDB 7 + Python 3 + Node 20 (via corepack) + nginx
5. systemd-Unit `solar-backend.service` wird angelegt
6. nginx Reverse-Proxy konfiguriert (Port 80, `/api` → 127.0.0.1:8001)

**Dauer**: ~5–8 Minuten

## 📦 Schritt 2 — App-Code in Container kopieren und bauen

```bash
# Noch auf dem Proxmox-Host
pct push 220 /root/solar-dashboard.tar.gz /opt/solar-dashboard.tar.gz
pct exec 220 -- bash -lc '
  cd /opt
  rm -rf solar-dashboard
  mkdir solar-dashboard
  tar xzf solar-dashboard.tar.gz -C solar-dashboard
  rm solar-dashboard.tar.gz
  /opt/solar-dashboard/deploy/proxmox/build-app.sh
'
```

**Was läuft ab im Build-Script:**

1. Python venv unter `/opt/solar-dashboard/backend/.venv`
2. `pip install -r requirements.txt` (paho-mqtt, influxdb-client, httpx, motor, fastapi, …)
3. `backend/.env` wird angelegt (`MONGO_URL=mongodb://localhost:27017`, `DB_NAME=solar_dashboard`)
4. `frontend/.env` mit leerem `REACT_APP_BACKEND_URL=` → relative URLs
5. `yarn install` + `yarn build` → React-Bundle
6. Static-Files nach `/var/www/solar-dashboard/`
7. `systemctl restart solar-backend` + `systemctl reload nginx`

**Dauer**: ~3–5 Minuten (Frontend-Build ist der Flaschenhals)

## ✅ Schritt 3 — Im Browser öffnen

<http://192.168.0.210>

Du landest in der Live-Demo. Jetzt einrichten:

1. **Geräte** → Demo-Modus **AUS** (IPs sind schon korrekt vorbelegt)
2. **Integrationen** → MQTT-Card:
   - Host: `192.168.0.201`
   - Port: `1883`
   - User: `mqttvenus` (oder dein Wert)
   - Pass: `mqttpw`
   - Toggle **AN**, dann **Speichern & Verbinden**
3. **Integrationen** → Victron-MQTT (schon vorbelegt: VRM `b827eb79321c`, Instances `288,289`) → Toggle **AN**
4. (optional) **Integrationen** → InfluxDB: URL `http://192.168.0.203:8086`, Token, Bucket → Toggle **AN**

Innerhalb von ~10 s sollte oben in der Statusleiste **MQTT: verbunden** stehen + Snapshot-Counter beginnt zu steigen.

## 🧪 Schritt 4 — Verifikation

```bash
# Auf dem Proxmox-Host
pct exec 220 -- bash -lc '
  systemctl status solar-backend --no-pager -l --lines=5
  curl -s http://localhost/api/integrations/status | python3 -m json.tool
'
```

Erwartete Werte nach erfolgreicher MQTT-Verbindung:

- `mqtt.connected: true`
- `mqtt.messages: > 0` und steigt
- `device_mqtt.shelly_last`, `trucki_last`, `ahoy_last`, `victron_last`: alle mit Zeitstempel
- `victron_mqtt.instances`: 288 + 289 mit Feld-Anzahl > 0

Im UI dann unter **Diagnose** → **Selbst-Test starten** → alle 9 Checks sollten grün sein.

## 🩹 Falls etwas hakt

| Symptom | Fix |
| ----- | ----- |
| `mongod` startet nicht | `journalctl -u mongod -n 30` → bei AVX-Fehler: LXC auf anderem Proxmox-Node testen |
| `yarn build` OOM | `pct set 220 --memory 2048` → erneut bauen → wieder auf 1024 |
| 502 Bad Gateway | `systemctl restart solar-backend` und `journalctl -u solar-backend -f` prüfen |
| MQTT bleibt rot | unter Diagnose `last_error` lesen — meist Auth-Problem oder Listener nicht auf `0.0.0.0` |
| Frontend zeigt Demo statt Live | Geräte-Tab: Demo-Modus aus + Speichern |

## Setup Fehler

Wenn du beim Setup hängst, schick mir die Ausgabe von:

```bash
pct exec 220 -- curl -s http://localhost/api/integrations/status
pct exec 220 -- journalctl -u solar-backend --no-pager -n 30
```

…und ich helfe live durch das Debugging.

Klassisch nach `rsync` — die Execute-Bits sind nicht persistent kopiert worden. Schnell nachholen + bauen:

```bash
pct exec 220 -- bash -lc '
  find /opt/solar-dashboard/deploy -name "*.sh" -exec sed -i "s/\r\$//" {} \;
  chmod +x /opt/solar-dashboard/deploy/proxmox/*.sh
  ls -la /opt/solar-dashboard/deploy/proxmox/
  /opt/solar-dashboard/deploy/proxmox/build-app.sh
'
```

**Was passiert:**

1. `sed` entfernt CRLF (falls Windows beim Push reingespielt hat)
2. `chmod +x` setzt das Execute-Bit auf alle drei `.sh`-Files
3. `ls -la` zeigt zur Bestätigung die Rechte (`-rwxr-xr-x` sollte da stehen)
4. Build startet

## Warum passiert das?

`rsync -a` überträgt Permissions normalerweise korrekt. Aber: wenn die Quelle (Tarball auf Proxmox-Host) **ohne** Execute-Bits ausgepackt wurde (z. B. weil das Tarball selbst die Bits nicht hatte — etwa nach scp aus Windows oder Download aus GitHub via HTTPS), dann fehlt's auch im rsync-Ziel.

## Dauerfix für nächste Updates

Erweitere meinen Build-Update-Befehl um die `chmod`-Zeile **vor** `build-app.sh`:

```bash
pct exec 220 -- bash -lc '
  cd /opt && rm -rf solar-dashboard-new && mkdir solar-dashboard-new
  tar xzf solar-dashboard.tar.gz -C solar-dashboard-new
  rsync -a solar-dashboard-new/ solar-dashboard/
  rm -rf solar-dashboard-new solar-dashboard.tar.gz
  sed -i "/^emergentintegrations/d" /opt/solar-dashboard/backend/requirements.txt
  find /opt/solar-dashboard/deploy -name "*.sh" -exec sed -i "s/\r\$//" {} \;
  chmod +x /opt/solar-dashboard/deploy/proxmox/*.sh
  /opt/solar-dashboard/deploy/proxmox/build-app.sh
'
```
