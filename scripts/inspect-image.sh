#!/bin/bash
echo "=== Docker Images ==="
docker images | grep -E "cyber-range|kali"
echo "---"
echo "=== Docker History ==="
docker history cyber-range-gui:latest 2>/dev/null | head -20
echo "---"
echo "=== Base Image Inspection ==="
docker run --rm cyber-range-gui:latest cat /etc/os-release 2>/dev/null | head -6
echo "---"
echo "=== Installed Desktop ==="
docker run --rm cyber-range-gui:latest bash -c 'dpkg -l 2>/dev/null | grep -iE "xfce|vnc|novnc|websockify|supervisor|firefox|nmap|terminal" | head -30'
echo "---"
echo "=== Icon themes ==="
docker run --rm cyber-range-gui:latest bash -c 'ls /usr/share/icons/ 2>/dev/null'
echo "---"
echo "=== GTK themes ==="
docker run --rm cyber-range-gui:latest bash -c 'ls /usr/share/themes/ 2>/dev/null'
echo "---"
echo "=== Shell configs ==="
docker run --rm cyber-range-gui:latest bash -c 'cat /root/.bashrc 2>/dev/null | head -20; echo "===ZSHRC==="; cat /root/.zshrc 2>/dev/null | head -10'
echo "---"
echo "=== Desktop shortcuts ==="
docker run --rm cyber-range-gui:latest bash -c 'ls -la /root/Desktop/ 2>/dev/null'
echo "---"
echo "=== Wallpapers ==="
docker run --rm cyber-range-gui:latest bash -c 'find /usr/share/backgrounds /usr/share/wallpapers -maxdepth 2 -type f 2>/dev/null | head -10'
echo "---"
echo "=== Panel config ==="
docker run --rm cyber-range-gui:latest bash -c 'find /etc/xdg/xfce4 -type f 2>/dev/null; find /root/.config/xfce4 -type f 2>/dev/null' | head -30
