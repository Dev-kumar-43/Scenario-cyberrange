FROM cyber-range-gui:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV USER=root
ENV HOME=/root

# Install Ubuntu-appropriate packages: Greybird theme, text editor, monitoring tools
# No offensive security tools — this is a corporate target workstation
RUN apt-get update && apt-get install -y --no-install-recommends \
    firefox-esr \
    greybird-gtk-theme \
    papirus-icon-theme \
    fonts-hack \
    mousepad \
    htop \
    net-tools \
    iproute2 \
    dnsutils \
    iputils-ping \
    curl \
    wget \
    librsvg2-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration, wallpaper, and desktop shortcuts
COPY wallpaper/ /tmp/wallpaper/
COPY config/ /tmp/config/
COPY desktop-shortcuts/ /tmp/desktop-shortcuts/
COPY terminalrc /tmp/terminalrc
COPY bashrc-ubuntu-target /tmp/bashrc-ubuntu-target
COPY setup-ubuntu-target.sh /tmp/setup-ubuntu-target.sh

# Run Ubuntu Target environment setup
RUN cp /tmp/wallpaper/ubuntu-target-wallpaper.svg /tmp/ubuntu-target-wallpaper.svg && \
    bash /tmp/setup-ubuntu-target.sh && \
    rm -rf /tmp/config /tmp/desktop-shortcuts /tmp/wallpaper /tmp/terminalrc /tmp/bashrc-ubuntu-target /tmp/setup-ubuntu-target.sh /tmp/ubuntu-target-wallpaper.svg

# Copy updated supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Reuse the identical noVNC postMessage clipboard patch from the Kali build
# ponytail: patch_novnc.py is a verbatim copy from kali-gui/ — keep them in sync
COPY patch_novnc.py /tmp/patch_novnc.py
RUN python3 /tmp/patch_novnc.py && rm /tmp/patch_novnc.py

EXPOSE 6901

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
