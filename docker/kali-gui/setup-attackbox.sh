#!/bin/bash
set -e

echo "=== [1/7] Setting up Student Workspaces & Tool Categories ==="
mkdir -p /root/Lab /root/Evidence /root/Notes /root/Scripts /root/Tools /root/Desktop
mkdir -p /etc/skel/Lab /etc/skel/Evidence /etc/skel/Notes /etc/skel/Scripts /etc/skel/Tools /etc/skel/Desktop

mkdir -p /root/Tools/01-recon
mkdir -p /root/Tools/02-web
mkdir -p /root/Tools/03-passwords
mkdir -p /root/Tools/04-network
ln -sfn /usr/share/wordlists /root/Tools/05-wordlists

# Create Helpful Workspace Documentation
cat << 'EOF' > /root/Lab/README.md
# Student Lab Workspace

Welcome to your active lab directory. Use this space to write attack scripts, exploit code, and temporary files during your mission.

- Keep your engagement files organized here.
- For evidence and proof-of-concept capture, save files into `~/Evidence/`.
- For engagement notes, use `~/Notes/`.
EOF

cat << 'EOF' > /root/Evidence/README.md
# Evidence & Proof-of-Concept Store

Store all scenario evidence, loot, flags, packet captures (`.pcap`), and screenshots here.

Recommended naming:
- `flag_<task_id>.txt`
- `capture_<interface>.pcap`
- `loot_<target_ip>.txt`
EOF

cat << 'EOF' > /root/Notes/README.md
# Mission Notes

Use this directory to keep structured notes as you enumerate the target network.

Recommended structure:
1. Target IP & Hostnames
2. Open Ports & Services
3. Vulnerability Findings
4. Exploitation Steps & Flags Captured
EOF

cat << 'EOF' > /root/Tools/README.md
# Cyber-Range Tools Arsenal

This workstation is provisioned with core offensive and defensive security tooling:

### 01-recon
- `nmap` - Network port scanner and service detection (`scan <target>`)
- `tcpdump` / `tshark` - Packet capture & live network analysis

### 02-web
- `gobuster` - Fast directory & DNS enumeration
- `nikto` - Web server vulnerability assessment
- `sqlmap` - Automated SQL injection exploitation
- `dirb` - Classic content scanner
- `curl` / `wget` - HTTP testing and payload delivery

### 03-passwords
- `hydra` - Multi-protocol network login cracker
- `john` - Password hash cracker (John the Ripper)

### 04-network
- `nc` (netcat) - Socket utility and reverse shell listener (`listener <port>`)
- `socat` - Multipurpose bidirectional relay
- `wireshark` - Full graphical protocol analyzer

### 05-wordlists
- `/usr/share/wordlists` (rockyou, dirb, etc.)
EOF

echo "=== [2/7] Installing Wallpaper & Themes ==="
mkdir -p /usr/share/backgrounds/cyberrange
cp /tmp/attackbox-wallpaper.svg /usr/share/backgrounds/cyberrange/attackbox-wallpaper.svg
# Fallback replacement for default XFCE wallpaper
if [ -f /usr/share/backgrounds/xfce/xfce-blue.jpg ]; then
    rm -f /usr/share/backgrounds/xfce/xfce-blue.jpg
    ln -s /usr/share/backgrounds/cyberrange/attackbox-wallpaper.svg /usr/share/backgrounds/xfce/xfce-blue.jpg
fi

echo "=== [3/7] Deploying Desktop Shortcuts ==="
for d in /root/Desktop /etc/skel/Desktop; do
    cp /tmp/desktop-shortcuts/*.desktop "$d/"
    chmod +x "$d"/*.desktop
done

echo "=== [4/7] Applying XFCE Configuration Profiles ==="
for cdir in /root/.config/xfce4/xfconf/xfce-perchannel-xml \
            /etc/skel/.config/xfce4/xfconf/xfce-perchannel-xml \
            /etc/xdg/xfce4/xfconf/xfce-perchannel-xml; do
    mkdir -p "$cdir"
    cp /tmp/config/xsettings.xml "$cdir/xsettings.xml"
    cp /tmp/config/xfce4-desktop.xml "$cdir/xfce4-desktop.xml"
    cp /tmp/config/xfce4-panel.xml "$cdir/xfce4-panel.xml"
    cp /tmp/config/xfwm4.xml "$cdir/xfwm4.xml"
done

# Ensure power manager never sleeps, blanks, or locks virtual display
cat << 'EOF' > /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xfce4-power-manager.xml
<?xml version="1.1" encoding="UTF-8"?>
<channel name="xfce4-power-manager" version="1.0">
  <property name="xfce4-power-manager" type="empty">
    <property name="blank-on-ac" type="int" value="0"/>
    <property name="dpms-on-ac-sleep" type="int" value="0"/>
    <property name="dpms-on-ac-off" type="int" value="0"/>
    <property name="presentation-mode" type="bool" value="true"/>
    <property name="lock-screen-suspend-hibernate" type="bool" value="false"/>
  </property>
</channel>
EOF
cp /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xfce4-power-manager.xml /root/.config/xfce4/xfconf/xfce-perchannel-xml/

echo "=== [5/7] Configuring Terminal & Shell Experience ==="
mkdir -p /root/.config/xfce4/terminal /etc/xdg/xfce4/terminal /etc/skel/.config/xfce4/terminal
cp /tmp/terminalrc /root/.config/xfce4/terminal/terminalrc
cp /tmp/terminalrc /etc/xdg/xfce4/terminal/terminalrc
cp /tmp/terminalrc /etc/skel/.config/xfce4/terminal/terminalrc

# Deploy customized bashrc
cp /tmp/bashrc-attackbox /root/.bashrc
cp /tmp/bashrc-attackbox /etc/skel/.bashrc

echo "=== [6/7] Optimizing Browser Defaults (Firefox ESR) ==="
mkdir -p /etc/firefox-esr/syspref
cat << 'EOF' > /etc/firefox-esr/syspref/attackbox.js
// Disable first-run / onboarding tabs
pref("browser.aboutwelcome.enabled", false);
pref("datareporting.policy.firstRunURL", "");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_welcome_url.additional", "");
pref("trailhead.firstrun.didSeeAboutWelcome", true);
pref("browser.startup.page", 1);
pref("browser.startup.homepage", "about:blank");
// Performance & security lab tuning
pref("browser.shell.checkDefaultBrowser", false);
pref("security.insecure_connection_icon.enabled", true);
pref("devtools.theme", "dark");
EOF

echo "=== [7/7] AttackBox Workspace Customization Complete ==="
