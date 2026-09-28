#!/bin/bash
set -e

# Find active lab namespace
NS=$(kubectl get namespaces -o name 2>/dev/null | grep lab | head -1 | cut -d/ -f2)
if [ -z "$NS" ]; then
  echo "ERROR: No lab namespace found"
  exit 1
fi

POD=$(kubectl -n "$NS" get pods -o name 2>/dev/null | head -1 | cut -d/ -f2)
echo "=== Active Lab ==="
echo "NS=$NS"
echo "POD=$POD"

echo ""
echo "=== OS Release ==="
kubectl -n "$NS" exec "$POD" -- cat /etc/os-release 2>/dev/null | head -6

echo ""
echo "=== Desktop Environment ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'which xfce4-session startxfce4 xfwm4 xfdesktop xfce4-terminal 2>/dev/null; echo "---"; dpkg -l 2>/dev/null | grep -i xfce | head -20'

echo ""
echo "=== Display Server ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'which Xvnc xrandr 2>/dev/null; Xvnc -version 2>&1 | head -3; echo "---"; xrandr --display :0 2>/dev/null | head -5'

echo ""
echo "=== Firefox ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'which firefox firefox-esr 2>/dev/null; dpkg -l 2>/dev/null | grep -i firefox | head -5'

echo ""
echo "=== Security Tools Installed ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'for tool in nmap nikto gobuster dirb dirbuster sqlmap hydra john hashcat enum4linux smbclient netcat-traditional ncat wireshark-cli tshark burpsuite msfconsole searchsploit wfuzz ffuf responder crackmapexec evil-winrm bloodhound impacket-scripts aircrack-ng kismet recon-ng maltego; do which $tool 2>/dev/null && echo "  FOUND: $tool"; done 2>/dev/null'

echo ""
echo "=== Desktop Configuration ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'ls -la /etc/xdg/xfce4/ 2>/dev/null; echo "---"; ls -la /root/.config/xfce4/ 2>/dev/null; echo "---"; cat /root/.config/xfce4/terminal/terminalrc 2>/dev/null'

echo ""
echo "=== Shell Configuration ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'cat /root/.bashrc 2>/dev/null | head -30; echo "---"; cat /root/.zshrc 2>/dev/null | head -10'

echo ""
echo "=== Wallpaper ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'find /usr/share/backgrounds /usr/share/wallpapers -maxdepth 2 -type f 2>/dev/null | head -10; echo "---"; cat /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml 2>/dev/null | head -20'

echo ""
echo "=== Panel/Dock ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'cat /etc/xdg/xfce4/panel/default.xml 2>/dev/null | head -30'

echo ""
echo "=== Installed Packages Count ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'dpkg -l 2>/dev/null | wc -l'

echo ""
echo "=== Supervisord Processes ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'supervisorctl status 2>/dev/null || ps aux | head -20'

echo ""
echo "=== Icon Themes ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'ls /usr/share/icons/ 2>/dev/null'

echo ""
echo "=== GTK/Theme Config ==="
kubectl -n "$NS" exec "$POD" -- bash -c 'cat /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml 2>/dev/null | head -30; echo "---"; ls /usr/share/themes/ 2>/dev/null'
