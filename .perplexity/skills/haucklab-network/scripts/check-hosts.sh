#!/usr/bin/env bash
# Prüft alle Hosts mit bekannter IP aus references/ip-plan.md (Ping + TCP-Port).
plan="$(dirname "$0")/../references/ip-plan.md"
grep -E '^\| [a-z]' "$plan" | grep -v '^| name' | while IFS='|' read -r _ name ip port _ status; do
  name=$(echo $name); ip=$(echo $ip); port=$(echo $port)
  [[ "$ip" == "–" || -z "$ip" ]] && { printf '%-18s IP unbekannt\n' "$name"; continue; }
  ping -c1 -W1 "$ip" >/dev/null 2>&1 && p=ok || p=FAIL
  timeout 2 bash -c "</dev/tcp/$ip/$port" 2>/dev/null && t=ok || t=FAIL
  printf '%-18s %-15s ping=%-4s port %-5s=%s\n' "$name" "$ip" "$p" "$port" "$t"
done
