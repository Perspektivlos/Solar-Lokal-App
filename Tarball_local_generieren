Ja, genau. Zuerst brauchst du den **aktuellen Code** auf dem PC, dann packst du `backend`, `frontend` und `deploy` in eine `.tar.gz`.

## 1. Aktuellen Code auf den PC holen
- Entweder über Emergent **„Save to GitHub"** → dann auf dem PC `git clone`/`git pull`
- Oder über den **Download-Button** in Emergent (lädt das Projekt als ZIP/Ordner)

## 2. Tarball erstellen (im Projektordner, der `backend/ frontend/ deploy/` enthält)

```bash
cd /pfad/zum/projekt

tar czf solar-dashboard.tar.gz \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='.venv' \
    --exclude='build' \
    --exclude='.git' \
    backend frontend deploy
```

Wichtig sind die `--exclude`-Angaben: `node_modules`, `.venv` und `build` würden den Tarball sonst riesig machen – sie werden ohnehin im LXC durch `build-app.sh` neu erzeugt.

## 3. Auf den Proxmox-Host kopieren

```bash
scp solar-dashboard.tar.gz root@192.168.0.200:/root/
```

## 4. Danach im LXC einspielen (auf dem Proxmox-Host)

```bash
pct push 220 /root/solar-dashboard.tar.gz /opt/solar-dashboard.tar.gz
pct exec 220 -- bash -lc 'cd /opt && tar xzf solar-dashboard.tar.gz -C solar-dashboard && rm solar-dashboard.tar.gz'
pct exec 220 -- bash -lc 'chmod +x /opt/solar-dashboard/deploy/proxmox/*.sh && /opt/solar-dashboard/deploy/proxmox/build-app.sh'
```

Die `backend/.env` im LXC bleibt erhalten (wird von `build-app.sh` nur angelegt, wenn sie fehlt). Da nur Dateien hinzugekommen sind (`mqtt_client.py` + neue Deploy-Dateien), gibt es keine Konflikte mit alten Ständen.

sobald `build-app.sh` durchgelaufen ist – prüfen `systemctl status solar-backend`.
