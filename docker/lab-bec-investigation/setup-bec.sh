#!/bin/bash
set -e

echo "=== [1/4] Preparing Desktop & Case Files ==="
mkdir -p /root/Desktop/Case_Files
mkdir -p /etc/skel/Desktop/Case_Files

cp /tmp/case-files/* /root/Desktop/Case_Files/
cp /tmp/case-files/* /etc/skel/Desktop/Case_Files/
chmod -R 755 /root/Desktop/Case_Files
chmod -R 755 /etc/skel/Desktop/Case_Files

echo "=== [2/4] Installing Incident Briefing Autostart ==="
mkdir -p /etc/xdg/autostart
cp /tmp/config/briefing.desktop /etc/xdg/autostart/
chmod 644 /etc/xdg/autostart/briefing.desktop

echo "=== [3/4] Installing Lab Services & Seeder in /opt/lab ==="
mkdir -p /opt/lab
cp /tmp/service/* /opt/lab/
chmod +x /opt/lab/*.py

echo "=== [4/4] Environment Setup Complete ==="
