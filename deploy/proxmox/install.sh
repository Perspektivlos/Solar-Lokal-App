#!/usr/bin/env bash
# =============================================================================
#  Solar Lokal-Dashboard · Container Installer (läuft im LXC)
#  -----------------------------------------------------------------------------
#  Installiert: MongoDB 7, Python 3.11, Node 20, nginx
#  Bereitet alle systemd-Services + nginx-Config vor
#  Erwartet, dass der Quellcode später unter /opt/solar-dashboard liegt
# =============================================================================

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

c_grn='\033[0;32m'; c_cyn='\033[0;36m'; c_off='\033[0m'
log() { echo -e "${c_cyn}[INSTALL]${c_off} $*"; }
ok()  { echo -e "${c_grn}[OK]    ${c_off} $*"; }

APP_DIR="/opt/solar-dashboard"
APP_USER="solar"

log "System-Update …"
apt-get update -qq
apt-get upgrade -y -qq

log "Basis-Pakete …"
apt-get install -y -qq \
  curl wget gnupg ca-certificates lsb-release \
  build-essential git unzip \
  nginx \
  python3 python3-venv python3-pip \
  software-properties-common

# ---- MongoDB 7 --------------------------------------------------------------
log "Installiere MongoDB 7 …"
if ! command -v mongod >/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  UBU_CODENAME=$(lsb_release -cs)
  # MongoDB unterstützt offiziell jammy/noble — bei neueren Ubuntu auf noble fallback
  case "$UBU_CODENAME" in
    noble|jammy|focal) MONGO_CODENAME="$UBU_CODENAME" ;;
    *)                 MONGO_CODENAME="jammy" ;;
  esac
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${MONGO_CODENAME}/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi
systemctl enable --now mongod
ok "MongoDB läuft."

# ---- Node.js 20 -------------------------------------------------------------
log "Installiere Node.js 20 + yarn …"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1)" != "v20" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g yarn --silent
ok "Node $(node -v), Yarn $(yarn -v)"

# ---- App-User ---------------------------------------------------------------
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -r -m -d /home/$APP_USER -s /bin/bash $APP_USER
fi
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---- systemd Service Backend -----------------------------------------------
log "Schreibe systemd-Unit …"
cat > /etc/systemd/system/solar-backend.service <<'UNIT'
[Unit]
Description=Solar Lokal-Dashboard Backend (FastAPI)
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=solar
WorkingDirectory=/opt/solar-dashboard/backend
EnvironmentFile=/opt/solar-dashboard/backend/.env
ExecStart=/opt/solar-dashboard/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload

# ---- nginx Site -------------------------------------------------------------
log "Konfiguriere nginx …"
cat > /etc/nginx/sites-available/solar-dashboard <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    root /var/www/solar-dashboard;
    index index.html;

    # FastAPI Backend (alle /api/* Requests)
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # React SPA (alles andere)
    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    client_max_body_size 5M;
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/solar-dashboard /etc/nginx/sites-enabled/solar-dashboard
mkdir -p /var/www/solar-dashboard
echo "<h1>Solar Dashboard – warte auf Build</h1>" > /var/www/solar-dashboard/index.html
chown -R www-data:www-data /var/www/solar-dashboard

nginx -t
systemctl enable --now nginx
systemctl reload nginx

ok "================================================================"
ok " Basisinstallation abgeschlossen."
ok "================================================================"
echo ""
echo "Nächste Schritte:"
echo "  1) Quellcode in den Container kopieren — siehe README.md"
echo "  2) Im Container ausführen:"
echo "       /opt/solar-dashboard/deploy/proxmox/build-app.sh"
echo ""
