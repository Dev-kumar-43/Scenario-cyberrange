#!/bin/bash
docker run --rm cyber-range-gui:latest bash -c '
echo "=== [1] Verifying Directories ==="
ls -la /root/
echo "--- Tools Arsenal ---"
ls -la /root/Tools/

echo "=== [2] Verifying Desktop Shortcuts ==="
ls -la /root/Desktop/

echo "=== [3] Verifying Security Tools ==="
for t in nmap gobuster nikto sqlmap hydra john tcpdump tshark nc socat wireshark firefox-esr; do
    if command -v "$t" >/dev/null 2>&1; then
        echo "✔ $t: $(command -v $t)"
    else
        echo "✘ $t: NOT FOUND"
    fi
done

echo "=== [4] Verifying Wordlists ==="
ls -la /root/Tools/05-wordlists/ | head -5

echo "=== [5] Verifying Appearance Configs ==="
echo "Theme in xsettings: $(grep -o "ThemeName.*value=\"[^\"]*\"" /root/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml)"
echo "Icons in xsettings: $(grep -o "IconThemeName.*value=\"[^\"]*\"" /root/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml)"
echo "Font in xsettings:  $(grep -o "FontName.*value=\"[^\"]*\"" /root/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml)"
echo "DPI in xsettings:   $(grep -o "DPI.*value=\"[^\"]*\"" /root/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml)"
echo "Wallpaper path:     $(grep -o "/usr/share/backgrounds/[^\"]*" /root/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml | head -1)"

echo "=== [6] Verifying Terminal Config ==="
grep -E "FontName|ColorBackground|MiscShowUnsafePasteDialog" /root/.config/xfce4/terminal/terminalrc

echo "=== [7] Test Shell Startup & Prompt ==="
bash -i -c "exit" 2>&1 | head -15
'
