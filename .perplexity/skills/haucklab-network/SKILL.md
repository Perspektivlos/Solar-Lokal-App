---
name: haucklab-network
description: "HauckLab-Heimnetz 192.168.0.0/24: IP-Plan, Erreichbarkeit, Ports, Firewall, DNS, Proxmox-Host, Samba/NFS und Härtung diagnostizieren oder dokumentieren. Verwenden bei Fragen wie 'Gerät nicht erreichbar', 'welche IP hat', 'Port blockiert', 'Netz absichern'. Nicht für App-Code oder MQTT-Payload-Parsing (dafür haucklab-local-apps bzw. haucklab)."
metadata:
  author: HauckLab - THCoding
  version: '1.0'
---

# HauckLab Netzwerk

## Grundregeln

- Nutze den IP-Plan in `references/ip-plan.md` als Quelle. Lies ihn vor jeder Antwort mit IPs, Ports oder Hosts.
- Markiere Werte mit Status `unsicher` im IP-Plan als solche und bitte den User um Bestätigung, statt sie als Fakt auszugeben.
- Gib exakte Befehle aus (Bash auf Linux/Proxmox, PowerShell auf dem Windows-PC „Haucki-PC“). Keine Platzhalter, wenn der IP-Plan den Wert kennt.
- Schreibe nie Passwörter, Tokens oder Zertifikatsinhalte in Antworten, Dateien oder Commits. Verwende `.env`-Variablen.
- Dienste sind nur im LAN erreichbar. Schlage keine Portfreigaben ins Internet vor; für Fernzugriff WireGuard oder Tailscale empfehlen.

## Diagnose-Ablauf „nicht erreichbar"

1. Host aus `references/ip-plan.md` bestimmen (IP, Port, Protokoll).
2. Schicht 3 prüfen: `ping -c3 <ip>` bzw. `Test-Connection <ip> -Count 3`.
3. Port prüfen: `nc -zv <ip> <port>` bzw. `Test-NetConnection <ip> -Port <port>`.
4. Auf dem Zielhost Listener prüfen: `ss -tlnp | grep <port>`.
5. Firewall prüfen: `nft list ruleset`, `iptables -S`, Proxmox `pve-firewall status`.
6. Bei Proxmox-Containern: `pct list`, `pct status <ctid>`, `pct exec <ctid> -- ip -4 a`.
Abgeschlossen, wenn die fehlende Schicht benannt ist (Netz, Listener, Firewall oder Dienst).

Für einen Komplettcheck aller Hosts: `scripts/check-hosts.sh` ausführen (liest die Tabelle aus `references/ip-plan.md`, prüft Ping und Port).

## Interpretationen

- `ECONNREFUSED` = Host erreichbar, aber kein Listener auf dem Port. Nicht Passwort oder TLS prüfen, sondern Dienstkonfiguration (z. B. fehlender `listener 8883` in Mosquitto).
- Timeout = Firewall, falsches Subnetz oder Host aus.
- Hostname löst nicht auf (`ahoydtu.local`, mDNS) = IP aus dem Plan verwenden; mDNS nicht über VLAN/Proxmox-Bridges voraussetzen.

## Härtung und Speicher

Lies `references/hardening.md`, wenn der User Absicherung, Firewall-Regeln, Samba/NFS oder SSH-Konfiguration anfragt.

## IP-Plan pflegen

Ändert sich eine Adresse, aktualisiere `references/ip-plan.md` und weise darauf hin, dass `.env` der Solar-Lokal-App, README und Grafana-Datenquellen ebenfalls angepasst werden müssen.
