#!/bin/bash
set -e

echo "=== [1/7] Setting up Corporate Workstation Directories ==="
mkdir -p /root/Documents /root/Downloads /root/Projects /root/Logs /root/Notes /root/Desktop
mkdir -p /etc/skel/Documents /etc/skel/Downloads /etc/skel/Projects /etc/skel/Logs /etc/skel/Notes /etc/skel/Desktop

# Create Workspace Documentation
cat << 'EOF' > /root/Documents/README.md
# Corporate Workstation — Documents

This is the primary document workspace for the internal corporate workstation.

- `/root/Projects/` — Active project files
- `/root/Logs/` — System and application logs
- `/root/Notes/` — Personal notes and observations
- `/root/Downloads/` — Downloaded files
EOF

cat << 'EOF' > /root/Notes/README.md
# Workstation Notes

Use this directory for personal notes, meeting summaries, and operational observations.
EOF

cat << 'EOF' > /root/Logs/README.md
# System Logs

Application and system log files are stored here for audit and review.
EOF

echo "=== [2/7] Installing Wallpaper & Themes ==="
mkdir -p /usr/share/backgrounds/cyberrange
cp /tmp/ubuntu-target-wallpaper.svg /usr/share/backgrounds/cyberrange/ubuntu-target-wallpaper.svg
# Fallback replacement for default XFCE wallpaper
if [ -f /usr/share/backgrounds/xfce/xfce-blue.jpg ]; then
    rm -f /usr/share/backgrounds/xfce/xfce-blue.jpg
    ln -s /usr/share/backgrounds/cyberrange/ubuntu-target-wallpaper.svg /usr/share/backgrounds/xfce/xfce-blue.jpg
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
cp /tmp/bashrc-ubuntu-target /root/.bashrc
cp /tmp/bashrc-ubuntu-target /etc/skel/.bashrc

echo "=== [6/7] Optimizing Browser Defaults (Firefox ESR) ==="
mkdir -p /etc/firefox-esr/syspref
cat << 'EOF' > /etc/firefox-esr/syspref/ubuntu-target.js
// Disable first-run / onboarding tabs
pref("browser.aboutwelcome.enabled", false);
pref("datareporting.policy.firstRunURL", "");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_welcome_url.additional", "");
pref("trailhead.firstrun.didSeeAboutWelcome", true);
pref("browser.startup.page", 1);
pref("browser.startup.homepage", "about:blank");
// Performance & security
pref("browser.shell.checkDefaultBrowser", false);
pref("security.insecure_connection_icon.enabled", true);
pref("devtools.theme", "dark");
EOF

echo "=== [7/7] Ubuntu Target Workstation Customization Complete ==="
