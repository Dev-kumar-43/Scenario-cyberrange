#!/bin/bash
docker run --rm cyber-range-gui:latest bash -c '
apt-get update >/dev/null 2>&1
echo "=== kali-themes ==="
apt-cache search "^kali-theme"
echo "=== papirus ==="
apt-cache search "^papirus-icon-theme"
echo "=== fonts ==="
apt-cache search "fonts-hack"
apt-cache search "fonts-jetbrains-mono"
echo "=== firefox ==="
apt-cache search "^firefox-esr"
echo "=== tools ==="
for p in gobuster nikto sqlmap hydra john tcpdump tshark netcat-traditional socat wordlists seclists; do
  apt-cache show "$p" >/dev/null 2>&1 && echo "AVAILABLE: $p" || echo "NOT_FOUND: $p"
done
'
