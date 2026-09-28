FROM cyber-range-gui:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV USER=root
ENV HOME=/root

# Pre-configure debconf to prevent interactive prompts during installation
RUN echo "wireshark-common wireshark-common/install-setuid boolean true" | debconf-set-selections

# Install AttackBox tools, themes, fonts, and browsers
RUN apt-get update && apt-get install -y --no-install-recommends \
    firefox-esr \
    kali-themes \
    papirus-icon-theme \
    fonts-hack \
    git \
    wget \
    net-tools \
    iproute2 \
    dnsutils \
    iputils-ping \
    netcat-traditional \
    socat \
    tcpdump \
    tshark \
    gobuster \
    nikto \
    sqlmap \
    hydra \
    john \
    wordlists \
    librsvg2-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration, wallpaper, and desktop shortcuts
COPY wallpaper/ /tmp/wallpaper/
COPY config/ /tmp/config/
COPY desktop-shortcuts/ /tmp/desktop-shortcuts/
COPY terminalrc /tmp/terminalrc
COPY bashrc-attackbox /tmp/bashrc-attackbox
COPY setup-attackbox.sh /tmp/setup-attackbox.sh

# Run AttackBox environment setup
RUN cp /tmp/wallpaper/attackbox-wallpaper.svg /tmp/attackbox-wallpaper.svg && \
    bash /tmp/setup-attackbox.sh && \
    rm -rf /tmp/config /tmp/desktop-shortcuts /tmp/wallpaper /tmp/terminalrc /tmp/bashrc-attackbox /tmp/setup-attackbox.sh /tmp/attackbox-wallpaper.svg

# Copy updated supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Patch noVNC web client for bidirectional postMessage and clipboard synchronization
COPY patch_novnc.py /tmp/patch_novnc.py
RUN python3 /tmp/patch_novnc.py && rm /tmp/patch_novnc.py

EXPOSE 6901

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
