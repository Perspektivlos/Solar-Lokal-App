#!/usr/bin/env bash
# =============================================================================
#  Solar Lokal-Dashboard · Build & Start (läuft im LXC, nach Quellcode-Upload)
# =============================================================================

set -euo pipefail

c_grn='\033[0;32m'; c_cyn='\033[0;36m'; c_red='\033[0;31m'; c_off='\033[0m'
log() { echo -e "${c_cyn}[BUILD]${c_off} $*"; }
ok()  { echo -e "${c_grn}[OK]  ${c_off} $*"; }
err() { echo -e "${c_red}[ERR] ${c_off} $*" >&2; exit 1; }

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

log "Frontend: Production-Build (kann 2–3 min dauern) …"
sudo -u solar env GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true CI=false yarn build

log "Frontend: nach /var/www/solar-dashboard deployen …"
rm -rf /var/www/solar-dashboard/*
cp -r build/* /var/www/solar-dashboard/
chown -R www-data:www-data /var/www/solar-dashboard
ok "Frontend deployed."

# ---- Services starten -------------------------------------------------------
log "Backend-Service aktivieren und starten …"
systemctl enable solar-backend
systemctl restart solar-backend
sleep 2
systemctl --no-pager --lines=5 status solar-backend || true

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
