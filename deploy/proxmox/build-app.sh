#!/usr/bin/env bash
# =============================================================================
#  Solar Lokal-Dashboard · Build & Start (läuft im LXC, nach Quellcode-Upload)
# =============================================================================

set -euo pipefail

c_grn='\033[0;32m'; c_cyn='\033[0;36m'; c_red='\033[0;31m'; c_ylw='\033[1;33m'; c_off='\033[0m'
log()  { echo -e "${c_cyn}[BUILD]${c_off} $*"; }
ok()   { echo -e "${c_grn}[OK]  ${c_off} $*"; }
warn() { echo -e "${c_ylw}[WARN]${c_off} $*"; }
err()  { echo -e "${c_red}[ERR] ${c_off} $*" >&2; exit 1; }

APP_DIR="/opt/solar-dashboard"
[[ -d "$APP_DIR/backend" && -d "$APP_DIR/frontend" ]] \
  || err "Quellcode nicht gefunden unter $APP_DIR — bitte zuerst hochladen."

chown -R solar:solar "$APP_DIR"

# ---- Backend ----------------------------------------------------------------
log "Backend: Python venv + Dependencies …"
cd "$APP_DIR/backend"
sudo -u solar python3 -m venv .venv
sudo -u solar .venv/bin/pip install --upgrade pip --quiet
sudo -u solar .venv/bin/pip install -r requirements.txt --quiet

# .env nur erzeugen wenn noch nicht vorhanden
if [[ ! -f "$APP_DIR/backend/.env" ]]; then
  log "Backend: .env wird angelegt …"
  cat > "$APP_DIR/backend/.env" <<'ENV'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="solar_dashboard"
CORS_ORIGINS="*"
ENV
  chown solar:solar "$APP_DIR/backend/.env"
fi
ok "Backend bereit."

# ---- Backend-Service FRÜH starten (unabhängig vom Frontend-Build) -----------
# Wird bewusst vor dem Frontend-Build aktiviert: schlägt der Frontend-Build
# fehl (z.B. OOM auf 1 GB-LXC), läuft das Backend trotzdem weiter.
log "Backend-Service aktivieren und starten …"
systemctl enable solar-backend
systemctl restart solar-backend
sleep 2
systemctl --no-pager --lines=5 status solar-backend || true

# ---- Frontend ---------------------------------------------------------------
log "Frontend: Dependencies installieren …"
cd "$APP_DIR/frontend"
# Relative API-URL → funktioniert unter jeder IP / jedem Hostnamen
cat > .env <<'ENV'
REACT_APP_BACKEND_URL=
WDS_SOCKET_PORT=0
ENABLE_HEALTH_CHECK=false
ENV
sudo -u solar yarn install --silent --network-timeout 600000

# Speicher prüfen — der Webpack-Build braucht ~1.5 GB. Auf einem 1 GB-LXC
# wird der Prozess sonst vom Kernel OOM-gekillt ("Killed", ohne klare Meldung).
AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
log "Verfügbarer Speicher: ${AVAIL_MB:-?} MB"
if [[ "${AVAIL_MB:-0}" -lt 1200 ]]; then
  warn "Wenig freier RAM (<1.2 GB). Bricht der Build mit 'Killed'/OOM ab, RAM temporär erhöhen:"
  warn "   (auf dem Proxmox-Host)   pct set <CTID> --memory 2048 && pct reboot <CTID>"
  warn "   nach erfolgreichem Build wieder zurück:   pct set <CTID> --memory 1024"
fi
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB:-2048}"

log "Frontend: Production-Build (kann 2–3 min dauern) …"
sudo -u solar env GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true CI=false \
  NODE_OPTIONS="$NODE_OPTIONS" yarn build

log "Frontend: nach /var/www/solar-dashboard deployen …"
rm -rf /var/www/solar-dashboard/*
cp -r build/* /var/www/solar-dashboard/
chown -R www-data:www-data /var/www/solar-dashboard
ok "Frontend deployed."

# ---- nginx neu laden --------------------------------------------------------
log "nginx reload …"
systemctl reload nginx

IP=$(ip -4 addr show scope global | awk '/inet /{print $2}' | cut -d/ -f1 | head -n1)

echo ""
ok "================================================================"
ok " Solar Dashboard läuft auf:  http://${IP}/"
ok "================================================================"
echo ""
echo "Logs:"
echo "  journalctl -u solar-backend -f      (Backend-Live-Log)"
echo "  systemctl status solar-backend      (Service-Status)"
echo "  tail -f /var/log/nginx/access.log   (HTTP-Zugriffe)"
echo ""
echo "Empfehlung:"
echo "  - In der Web-UI unter 'Geräte' den Demo-Modus AUSschalten"
echo "  - Unter 'Integrationen' MQTT aktivieren (192.168.0.201, mqttroot/mqttpw)"
echo ""
