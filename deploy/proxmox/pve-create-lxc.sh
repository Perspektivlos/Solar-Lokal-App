#!/usr/bin/env bash
# =============================================================================
#  Solar Lokal-Dashboard · Proxmox LXC Installer
#  -----------------------------------------------------------------------------
#  Auf dem PROXMOX-HOST (192.168.0.200) ausführen:
#      bash pve-create-lxc.sh
#
#  Erstellt einen unprivilegierten LXC-Container und installiert darin:
#      - MongoDB 7
#      - Python 3 + FastAPI Backend (systemd-Service)
#      - Node.js 20 + React Frontend (gebaut, durch nginx ausgeliefert)
#      - nginx Reverse-Proxy (/ → Frontend, /api → Backend)
#
#  Quellcode muss separat in den Container kopiert werden — siehe README.md
# =============================================================================

set -euo pipefail

# ---- Konfiguration (anpassbar) ----------------------------------------------
CT_ID="${CT_ID:-220}"                               # Container ID
CT_HOSTNAME="${CT_HOSTNAME:-solar-dashboard}"
CT_PASSWORD="${CT_PASSWORD:-solar}"                 # bitte ändern!
CT_DISK_GB="${CT_DISK_GB:-8}"
CT_RAM_MB="${CT_RAM_MB:-1024}"
CT_CORES="${CT_CORES:-2}"
CT_STORAGE="${CT_STORAGE:-local-lvm}"
CT_BRIDGE="${CT_BRIDGE:-vmbr0}"
CT_IP="${CT_IP:-dhcp}"                              # z.B. "192.168.0.210/24" oder "dhcp"
CT_GW="${CT_GW:-}"                                  # z.B. "192.168.0.1" (nur bei statisch)
OS_TEMPLATE="${OS_TEMPLATE:-ubuntu-24.04-standard_24.04-2_amd64.tar.zst}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
# -----------------------------------------------------------------------------

c_red='\033[0;31m'; c_grn='\033[0;32m'; c_ylw='\033[1;33m'; c_cyn='\033[0;36m'; c_off='\033[0m'
log()  { echo -e "${c_cyn}[INFO]${c_off} $*"; }
ok()   { echo -e "${c_grn}[OK]  ${c_off} $*"; }
warn() { echo -e "${c_ylw}[WARN]${c_off} $*"; }
err()  { echo -e "${c_red}[ERR] ${c_off} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Bitte als root ausführen (sudo bash pve-create-lxc.sh)"
command -v pct >/dev/null || err "Dieses Script muss auf dem Proxmox-Host laufen."

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

# ---- Installer kopieren und ausführen ---------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_SCRIPT="${SCRIPT_DIR}/install.sh"

if [[ ! -f "$INSTALL_SCRIPT" ]]; then
  err "install.sh nicht gefunden im selben Verzeichnis ($SCRIPT_DIR)."
fi

log "Kopiere install.sh in Container …"
pct push "$CT_ID" "$INSTALL_SCRIPT" /root/install.sh
pct exec "$CT_ID" -- bash -lc "chmod +x /root/install.sh"

log "Führe Installation aus (kann 5–10 min dauern) …"
pct exec "$CT_ID" -- bash -lc "/root/install.sh"

echo ""
ok "================== FERTIG =================="
echo -e "  Container ID:    ${c_cyn}$CT_ID${c_off}"
echo -e "  Hostname:        ${c_cyn}$CT_HOSTNAME${c_off}"
echo -e "  IP-Adresse:      ${c_cyn}${LXC_IP:-(bitte mit 'pct exec $CT_ID -- ip a' prüfen)}${c_off}"
echo -e "  Dashboard URL:   ${c_grn}http://${LXC_IP:-CONTAINER-IP}/${c_off}"
echo -e "  SSH-Login:       ${c_cyn}root / $CT_PASSWORD${c_off}"
echo ""
echo "Quellcode kopieren (auf dem Proxmox-Host):"
echo "    pct push $CT_ID /pfad/zum/solar-dashboard.tar.gz /opt/solar-dashboard.tar.gz"
echo "    pct exec $CT_ID -- bash -lc 'cd /opt && tar xzf solar-dashboard.tar.gz && /opt/solar-dashboard/deploy/proxmox/build-app.sh'"
echo ""
