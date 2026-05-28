# Solar Dashboard · Proxmox LXC Deployment

Drei Schritte:

## 1. Quellcode auf den Proxmox-Host kopieren

**Variante A — von deinem Entwicklungsrechner via scp:**

```bash
# Auf deinem PC (im Verzeichnis mit /app)
cd /pfad/zu/projekt
tar czf solar-dashboard.tar.gz \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='.venv' \
    --exclude='build' \
    --exclude='.git' \
    backend frontend deploy
scp solar-dashboard.tar.gz root@192.168.0.200:/root/
```

**Variante B — direkt von GitHub** (wenn du die Emergent-Funktion „Push to GitHub" nutzt):
```bash
ssh root@192.168.0.200
# später im Container, siehe Schritt 3
```

## 2. LXC erstellen (auf dem Proxmox-Host)

```bash
ssh root@192.168.0.200
cd /tmp
# pve-create-lxc.sh und install.sh aus deinem Repo / Upload hierher legen
chmod +x pve-create-lxc.sh install.sh

# Optional: Konfiguration anpassen
export CT_ID=220
export CT_IP="192.168.0.210/24"
export CT_GW="192.168.0.1"
export CT_PASSWORD="dein-sicheres-pw"

bash pve-create-lxc.sh
```

Das Script erstellt einen Container mit ID 220, IP 192.168.0.210, installiert
MongoDB / Python / Node / nginx und richtet die systemd-Services ein.

## 3. App-Code in den Container kopieren und bauen

```bash
# Auf dem Proxmox-Host
pct push 220 /root/solar-dashboard.tar.gz /opt/solar-dashboard.tar.gz
pct exec 220 -- bash -lc 'cd /opt && tar xzf solar-dashboard.tar.gz -C solar-dashboard --strip-components=0 && rm solar-dashboard.tar.gz'
# ODER bei GitHub-Variante:
# pct exec 220 -- bash -lc 'cd /opt && git clone https://github.com/dein-user/solar-dashboard.git'

pct exec 220 -- bash -lc '/opt/solar-dashboard/deploy/proxmox/build-app.sh'
```

Fertig — Dashboard ist unter `http://192.168.0.210/` erreichbar.

---

## Konfiguration

In der Web-UI:
- **Geräte** → Demo-Modus **AUS**, IPs anpassen falls abweichend
- **Integrationen** → MQTT-Card → `192.168.0.201`, `mqttroot`/`mqttpw`, Toggle **AN** → *Speichern & Verbinden*
- **Integrationen** → Victron-MQTT-Card → VRM-ID `b827eb79321c`, Instances `288,289`, Toggle **AN**
- Optional: InfluxDB-Card → `http://192.168.0.203:8086`, Token einfügen

## Wartung

```bash
# In den Container einloggen
pct enter 220

# Backend-Logs verfolgen
journalctl -u solar-backend -f

# Backend neu starten (nach Code-Update)
systemctl restart solar-backend

# Frontend neu bauen (nach Code-Update im /opt/solar-dashboard/frontend)
/opt/solar-dashboard/deploy/proxmox/build-app.sh

# Container Backup vom Proxmox-Host
vzdump 220 --storage local --compress zstd
```

## Update-Workflow

1. Auf dem Dev-PC: Code ändern → Push to GitHub (Emergent-Feature)
2. Im LXC: `cd /opt/solar-dashboard && git pull && deploy/proxmox/build-app.sh`
3. Oder neue tar.gz hochladen und wieder mit `pct push` + `tar -x` deployen

## Ressourcen (Default)

| Resource | Default | Empfehlung |
|----------|---------|------------|
| CPU      | 2 cores | 2 cores reichen |
| RAM      | 1 GB    | 1 GB reicht, 2 GB komfortabler |
| Disk     | 8 GB    | wächst mit MongoDB-Snapshots — bei 15s/Snapshot ≈ 50 MB/Monat |
| Netz     | DHCP    | besser statische IP (z.B. 192.168.0.210) |
| Storage  | local-lvm | nach Wunsch |

## Häufige Probleme

**`mongod` startet nicht** → `journalctl -u mongod -n 50` zeigt meist fehlende AVX-Unterstützung in alten CPUs. Fallback: `apt install mongodb-org=7.0.5` (älter ohne AVX-Anforderung) oder LXC auf neueren Proxmox-Node migrieren.

**`yarn build` schlägt fehl mit OOM** → RAM des Containers temporär auf 2048 erhöhen:
```bash
pct set 220 --memory 2048
```
Nach erfolgreichem Build wieder runter auf 1024.

**`solar-backend` läuft nicht** → `journalctl -u solar-backend -n 50` → meist fehlende Python-Lib → `cd /opt/solar-dashboard/backend && .venv/bin/pip install -r requirements.txt`

**Webseite zeigt 502 Bad Gateway** → Backend nicht erreichbar. `curl http://localhost:8001/api/` im Container ausführen, dann `systemctl restart solar-backend`.

**MQTT verbindet nicht** → in der Integrationen-UI `last_error` prüfen. Häufig: Firewall auf Mosquitto-Host (Port 1883), oder Mosquitto erlaubt nur `localhost` (in `/etc/mosquitto/mosquitto.conf` muss `listener 1883 0.0.0.0` stehen, nicht nur `listener 1883`).
