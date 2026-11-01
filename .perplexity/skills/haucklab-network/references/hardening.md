# Härtung HauckLab

## Mosquitto
- Nur LAN binden: `listener 1883 192.168.0.201`; `allow_anonymous false`; `password_file` + `acl_file`.
- ACL-User: `<MQTT_APP_USER>` (lesen `N/#`, `shellies/#`, `ahoy/#`, `trucki/#`), `<MQTT_SHELLY_USER>` (schreiben `shellies/#`), `<MQTT_DTU_USER>` (schreiben `ahoy/#`). Venus-Bridge eigener User.
- TLS 8883 (derzeit NICHT aktiv; nur auf ausdrücklichen Wunsch einrichten): `listener 8883`, `cafile`, `certfile`, `keyfile`; nach Änderung `systemctl restart mosquitto` und `ss -tlnp | grep 8883`.

## Proxmox
- Web-UI 8006 nur aus LAN; `pve-firewall` auf Datacenter-Ebene aktivieren, Regel „ACCEPT 192.168.0.0/24 → 8006,22“ vor „DROP“.
- Unprivilegierte LXC bevorzugen; Backups per `vzdump` auf getrenntes Storage.

## SSH
- `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, Schlüssel ed25519.

## Samba/NFS (1 TB SSD, LVM-thin)
- Samba: `server min protocol = SMB2_10`, `hosts allow = 192.168.0.`, `valid users` statt `guest ok`.
- NFS: Export nur `192.168.0.0/24(rw,sync,root_squash,no_subtree_check)`; danach `exportfs -ra`.

## Geräte
- Shelly/AhoyDTU: Web-Login-Passwort setzen, Cloud deaktivieren, Firmware aktuell.
