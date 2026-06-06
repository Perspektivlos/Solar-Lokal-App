#!/usr/bin/env bash
# =============================================================================
#  Solar Lokal-Dashboard · Proxmox LXC Installer für InfluxDB 2.x
#  -----------------------------------------------------------------------------
#  Auf dem PROXMOX-HOST (192.168.0.200) als root ausführen:
#      bash pve-create-influxdb-lxc.sh
#
#  Erstellt einen unprivilegierten LXC-Container und installiert darin:
#      - InfluxDB 2.7 (Time-Series-DB) + influx-CLI
#      - Automatisches Setup: Org "home", Bucket "solar", Admin-Token
#      - Lauscht auf 0.0.0.0:8086 (vom Dashboard-Backend & Grafana erreichbar)
#
#  Am Ende wird der API-TOKEN ausgegeben — diesen brauchst du für:
#      1. Solar-Dashboard  → Integrationen → InfluxDB-Card → Token einfügen
#      2. Grafana          → Data Source → InfluxDB → Token einfügen
#
#  Hinweis: Grafana wird NICHT installiert — du nutzt deine bestehende
#  Instanz (LXC 102, http://192.168.0.91:3000). Siehe grafana/INFLUXDB-GRAFANA-SETUP.md
# =============================================================================

set -euo pipefail

# ---- Konfiguration (per ENV überschreibbar) ---------------------------------
CT_ID="${CT_ID:-203}"                              # Container ID (passend zur PRD-IP .203)
CT_HOSTNAME="${CT_HOSTNAME:-influxdb}"
CT_PASSWORD="${CT_PASSWORD:-influx}"               # bitte ändern!
CT_DISK_GB="${CT_DISK_GB:-16}"                     # Time-Series wächst — 16 GB Puffer
CT_RAM_MB="${CT_RAM_MB:-1024}"
CT_CORES="${CT_CORES:-2}"
CT_STORAGE="${CT_STORAGE:-local-lvm}"
CT_BRIDGE="${CT_BRIDGE:-vmbr0}"
CT_IP="${CT_IP:-192.168.0.203/24}"                 # z.B. "192.168.0.203/24" oder "dhcp"
CT_GW="${CT_GW:-192.168.0.1}"                      # nur bei statischer IP
OS_TEMPLATE="${OS_TEMPLATE:-ubuntu-24.04-standard_24.04-2_amd64.tar.zst}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"

# ---- InfluxDB-Setup (passend zur Dashboard-Default-Config) ------------------
INFLUX_ORG="${INFLUX_ORG:-home}"
INFLUX_BUCKET="${INFLUX_BUCKET:-solar}"
INFLUX_USER="${INFLUX_USER:-admin}"
INFLUX_PASSWORD="${INFLUX_PASSWORD:-solardashboard}"   # min. 8 Zeichen, bitte ändern!
INFLUX_TOKEN="${INFLUX_TOKEN:-}"                       # leer = wird zufällig generiert
INFLUX_RETENTION="${INFLUX_RETENTION:-0}"             # 0 = unbegrenzt, sonst z.B. "90d"
# -----------------------------------------------------------------------------

c_red='\033[0;31m'; c_grn='\033[0;32m'; c_ylw='\033[1;33m'; c_cyn='\033[0;36m'; c_off='\033[0m'
log()  { echo -e "${c_cyn}[INFO]${c_off} $*"; }
ok()   { echo -e "${c_grn}[OK]  ${c_off} $*"; }
warn() { echo -e "${c_ylw}[WARN]${c_off} $*"; }
err()  { echo -e "${c_red}[ERR] ${c_off} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Bitte als root ausführen (sudo bash pve-create-influxdb-lxc.sh)"
command -v pct >/dev/null || err "Dieses Script muss auf dem Proxmox-Host laufen."

# Token generieren falls nicht gesetzt
if [[ -z "$INFLUX_TOKEN" ]]; then
  INFLUX_TOKEN="$(openssl rand -hex 32)"
fi

# ---- Vorhandenen Container prüfen -------------------------------------------
if pct status "$CT_ID" >/dev/null 2>&1; then
  warn "Container $CT_ID existiert bereits."
  read -rp "Löschen und neu erstellen? [y/N] " yn
  if [[ "${yn,,}" == "y" ]]; then
    pct stop "$CT_ID" 2>/dev/null || true
    pct destroy "$CT_ID"
  else
    err "Abbruch."
  fi
fi

# ---- Template prüfen --------------------------------------------------------
TEMPLATE_PATH="/var/lib/vz/template/cache/${OS_TEMPLATE}"
if [[ ! -f "$TEMPLATE_PATH" ]]; then
  log "Template $OS_TEMPLATE nicht gefunden — lade herunter…"
  pveam update
  pveam download "$TEMPLATE_STORAGE" "$OS_TEMPLATE"
fi

# ---- Netzwerkkonfig ---------------------------------------------------------
NET_CONFIG="name=eth0,bridge=${CT_BRIDGE}"
if [[ "$CT_IP" == "dhcp" ]]; then
  NET_CONFIG+=",ip=dhcp"
else
  NET_CONFIG+=",ip=${CT_IP}"
  [[ -n "$CT_GW" ]] && NET_CONFIG+=",gw=${CT_GW}"
fi

# ---- Container anlegen ------------------------------------------------------
log "Erstelle LXC $CT_ID ($CT_HOSTNAME) …"
pct create "$CT_ID" "${TEMPLATE_STORAGE}:vztmpl/${OS_TEMPLATE}" \
  --hostname "$CT_HOSTNAME" \
  --password "$CT_PASSWORD" \
  --unprivileged 1 \
  --features "nesting=1,keyctl=1" \
  --cores "$CT_CORES" \
  --memory "$CT_RAM_MB" \
  --swap 512 \
  --rootfs "${CT_STORAGE}:${CT_DISK_GB}" \
  --net0 "$NET_CONFIG" \
  --onboot 1 \
  --start 0

ok "Container erstellt."

log "Starte Container …"
pct start "$CT_ID"
sleep 6

# ---- IP ermitteln -----------------------------------------------------------
LXC_IP=$(pct exec "$CT_ID" -- bash -lc "ip -4 addr show eth0 | awk '/inet /{print \$2}' | cut -d/ -f1" 2>/dev/null || true)
log "Container-IP: ${LXC_IP:-<unbekannt>}"

# ---- InfluxDB im Container installieren -------------------------------------
log "Installiere InfluxDB 2.7 (kann 3–5 min dauern) …"
pct exec "$CT_ID" -- bash -lc '
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl gnupg ca-certificates openssl

# InfluxData APT-Repo (signiert)
curl --silent --location -O https://repos.influxdata.com/influxdata-archive_compat.key
echo "393e8779c89ac8d958f81f942f9ad7fb82a25e133faddaf92e15b16e6ac9ce4c  influxdata-archive_compat.key" | sha256sum -c -
cat influxdata-archive_compat.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null
echo "deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main" | tee /etc/apt/sources.list.d/influxdata.list > /dev/null

apt-get update -qq
apt-get install -y -qq influxdb2 influxdb2-cli

systemctl enable --now influxdb
'

# InfluxDB braucht ein paar Sekunden zum Hochfahren
log "Warte auf InfluxDB-Start …"
pct exec "$CT_ID" -- bash -lc '
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8086/health >/dev/null 2>&1; then exit 0; fi
  sleep 2
done
echo "InfluxDB nicht erreichbar nach 60s" >&2; exit 1
'

# ---- Automatisches Setup (Org / Bucket / Token) -----------------------------
log "Richte Org='${INFLUX_ORG}', Bucket='${INFLUX_BUCKET}' ein …"
pct exec "$CT_ID" -- bash -lc "
influx setup --force \
  --host http://localhost:8086 \
  --org '${INFLUX_ORG}' \
  --bucket '${INFLUX_BUCKET}' \
  --username '${INFLUX_USER}' \
  --password '${INFLUX_PASSWORD}' \
  --token '${INFLUX_TOKEN}' \
  --retention '${INFLUX_RETENTION}'
"

ok "InfluxDB eingerichtet."

# ---- Zusammenfassung --------------------------------------------------------
echo ""
ok "================== FERTIG =================="
echo -e "  Container ID:    ${c_cyn}$CT_ID${c_off}"
echo -e "  Hostname:        ${c_cyn}$CT_HOSTNAME${c_off}"
echo -e "  IP-Adresse:      ${c_cyn}${LXC_IP:-${CT_IP%/*}}${c_off}"
echo -e "  InfluxDB UI:     ${c_grn}http://${LXC_IP:-${CT_IP%/*}}:8086${c_off}"
echo -e "  SSH-Login:       ${c_cyn}root / $CT_PASSWORD${c_off}"
echo ""
echo -e "  ${c_ylw}--- InfluxDB Zugangsdaten (NOTIEREN!) ---${c_off}"
echo -e "  URL:             ${c_grn}http://${LXC_IP:-${CT_IP%/*}}:8086${c_off}"
echo -e "  Org:             ${c_cyn}${INFLUX_ORG}${c_off}"
echo -e "  Bucket:          ${c_cyn}${INFLUX_BUCKET}${c_off}"
echo -e "  UI-Login:        ${c_cyn}${INFLUX_USER} / ${INFLUX_PASSWORD}${c_off}"
echo -e "  API-Token:       ${c_grn}${INFLUX_TOKEN}${c_off}"
echo ""
echo "Nächste Schritte:"
echo -e "  1. Solar-Dashboard → ${c_cyn}Integrationen → InfluxDB${c_off}:"
echo -e "     URL=${c_grn}http://${LXC_IP:-${CT_IP%/*}}:8086${c_off}  Org=${INFLUX_ORG}  Bucket=${INFLUX_BUCKET}  Token=<obiger Token>  → AN → Speichern"
echo -e "  2. Grafana (${c_cyn}http://192.168.0.91:3000${c_off}) → Data Source + Dashboard importieren:"
echo -e "     Siehe ${c_cyn}deploy/proxmox/grafana/INFLUXDB-GRAFANA-SETUP.md${c_off}"
echo ""
