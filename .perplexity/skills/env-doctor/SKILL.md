---
name: env-doctor
description: "Diagnoses and fixes project environment issues. Use when the user says something is not working, a project will not start, dependencies fail to install, environment variables are missing, or ports are already in use. Checks Node, Python, Docker, MQTT, InfluxDB, MongoDB, Proxmox, env vars, ports, and dependencies systematically."
---

# Env Doctor

Systematisch diagnostizieren, warum ein Projekt nicht läuft. Alles prüfen, was ein Entwickler manuell prüfen würde — aber schneller und ohne Schritte zu vergessen.

## Workflow

1. **Projekttyp identifizieren**: Wurzelverzeichnis lesen:
   - `package.json` → Node.js
   - `pyproject.toml` / `requirements.txt` / `setup.py` → Python
   - `Cargo.toml` → Rust
   - `go.mod` → Go
   - `Gemfile` → Ruby
   - `docker-compose.yml` / `Dockerfile` → Docker
   - Mehrere Indikatoren → Monorepo oder Polyglot

2. **Diagnosen ausführen** in dieser Reihenfolge (nicht zutreffende überspringen):

   ### Runtime & Tooling
   - Benötigte Runtime installiert? Version prüfen:
     - `node --version`, `npm --version` oder `yarn --version` oder `pnpm --version`
     - `python3 --version`, `pip --version`
     - `docker --version`, `docker compose version`
   - Gegen Projekt-Anforderungen vergleichen (z. B. `engines` in package.json, `python_requires` in pyproject.toml)
   - Versionskonflikte klar markieren: "Projekt benötigt Node >= 18, du hast 16.14.0"

   ### Dependencies
   - Sind Dependencies installiert?
     - Node: Existiert `node_modules/`? `npm ls --depth=0 2>&1 | grep ERR`
     - Python: Virtualenv existiert und aktiviert? `pip check`
   - Fehlende Dependencies → Installationsbefehl vorschlagen
   - Lockfile-Konflikte prüfen (package-lock.json vs yarn.lock vs pnpm-lock.yaml)

   ### Environment Variables
   - `.env.example`, `.env.sample` oder `.env.template` prüfen
   - `.env` existiert?
   - Wenn `.env.example` existiert, `.env` aber nicht: als Problem markieren und fehlende Variablen zeigen
   - Wenn beide existieren: diffen, um fehlende Variablen zu finden
   - Platzhalter-Werte prüfen (z. B. `DATABASE_URL=your_database_url_here`)
   - Niemals tatsächliche Werte von Secrets ausgeben. Nur Keys melden: vorhanden, fehlend oder leer.

   ### Database & Services
   - Wenn Projekt Datenbank nutzt (DATABASE_URL, POSTGRES_*, MONGO_*):
     - Dienst läuft? (`pg_isready`, `docker ps | grep postgres`, etc.)
     - Verbindungsstring gültig?
   - `docker-compose.yml`: Container laufen? (`docker compose ps`)
   - Redis, Elasticsearch oder andere Dienste prüfen

   ### MQTT Broker (IoT-Projekte)
   - Wenn das Projekt MQTT nutzt (paho-mqtt, mosquitto, etc.):
     - Mosquitto läuft? (`systemctl status mosquitto` oder `docker ps | grep mosquitto`)
     - Port erreichbar? (`ss -tlnp | grep 1883` für unverschlüsselt, `ss -tlnp | grep 8883` für TLS)
     - TLS-Zertifikat gültig? (`openssl s_client -connect localhost:8883 -CAfile /path/to/ca.crt`)
     - ACL-User konfiguriert? (`mosquitto_passwd` oder `mosquitto.conf` prüfen)
     - Test-Verbindung: `mosquitto_sub -h localhost -p 8883 -t "test/#" -u <user> -P <pass> --cafile <ca.crt> -C 1`
     - Niemals MQTT-Passwörter ausgeben. Nur Usernamen melden.

   ### InfluxDB
   - Wenn das Projekt InfluxDB nutzt:
     - Dienst läuft? (`systemctl status influxdb` oder `docker ps | grep influxdb`)
     - Port erreichbar? (`ss -tlnp | grep 8086`)
     - Health-Check: `curl -s http://localhost:8086/health`
     - Bucket und Token konfiguriert?

   ### MongoDB
   - Wenn das Projekt MongoDB nutzt (motor, pymongo, etc.):
     - Dienst läuft? (`systemctl status mongod` oder `docker ps | grep mongo`)
     - Port erreichbar? (`ss -tlnp | grep 27017`)
     - Verbindungsstring gültig (nicht Platzhalter)?

   ### Proxmox / LXC
   - Wenn das Projekt auf Proxmox läuft:
     - LXC-Container aktiv? (`pct status <vmid>` oder `pct list`)
     - Netzwerk erreichbar? (`ping <vm-ip>`)
     - SSH-Zugang? (`ssh root@<vm-ip>`)
     - Docker im Container? (`docker ps` — sofern installiert)
     - nginx läuft? (`systemctl status nginx` oder `docker ps | grep nginx`)

   ### Ports
   - Welchen Port möchte das Projekt nutzen?
   - Port bereits belegt? (`lsof -i :<port>` oder `ss -tlnp | grep <port>`)
   - Wenn belegt: Prozess identifizieren und Vorschlag machen (killen oder anderer Port)

   ### Build Artifacts
   - Build-Schritt nötig aber nicht ausgeführt? (`dist/` oder `build/` fehlt)
   - TypeScript-Kompilierung? (`npx tsc --noEmit 2>&1 | head -20`)
   - CRACO-Build? (`./node_modules/.bin/craco build` für React-Projekte mit CRACO)

3. **Ergebnisse berichten**:

```
## Environment Health Check

### ✅ Passing
- Node.js 20.11.0 (required: >= 18) 
- Dependencies installed (347 packages, 0 issues)
- Port 3000 is available

### ❌ Issues found

**Missing .env file**
You have a `.env.example` but no `.env` file. Copy it and fill in your values:
\`\`\`bash
cp .env.example .env
\`\`\`
These variables need real values:
- `DATABASE_URL` (currently empty)
- `MQTT_BROKER_HOST` (currently a placeholder)

**PostgreSQL is not running**
The project expects PostgreSQL on localhost:5432 but no service is listening.
\`\`\`bash
# If using Docker:
docker compose up -d postgres

# If using system service (Linux):
sudo systemctl start postgresql
\`\`\`

### 💡 Suggestions
- You have both `package-lock.json` and `yarn.lock`. Pick one package
  manager and delete the other lockfile to avoid conflicts.
```

4. **Fix anbieten**: Für jedes Problem den Fix-Befehl anbieten, wenn er sicher und nicht-destruktiv ist. Niemals Daten löschen oder destruktive Befehle ohne ausdrückliche Bestätigung anbieten.

## Rules

- Always check environment variables first. Missing env vars are the #1 cause of "it works on my machine" problems.
- Never print secret values. Report keys only, never values. Say "STRIPE_SECRET_KEY is empty" not "STRIPE_SECRET_KEY=sk_test_abc123..."
- If everything passes, say so clearly: "Everything looks good. The project should be ready to run." Then suggest the start command.
- If the project has a README with setup instructions, read it and verify each step has been completed.
- Run checks in dependency order. There is no point checking if the database connection works if the database service is not running.
- For each issue, always provide the exact command to fix it. Do not just describe the problem.
- If you are unsure about the fix, say so. "This might be the issue, but I am not certain" is better than a confident wrong answer.
- Limit the diagnostic to 60 seconds of work. If the project has deep issues, report what you found and suggest the user focus on the most critical issue first.
- For IoT/MQTT projects, always check TLS certificate validity and ACL configuration — these are common failure points.
- For Proxmox deployments, always verify LXC container status and network reachability first.
