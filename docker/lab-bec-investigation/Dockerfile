FROM axllent/mailpit:latest AS mailpit-source

FROM cyber-range-gui:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV USER=root
ENV HOME=/root

# Extract static Mailpit binary from official image
COPY --from=mailpit-source /mailpit /usr/local/bin/mailpit
RUN chmod 755 /usr/local/bin/mailpit

# Install lightweight tools (mousepad for briefing, python3 for portal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    mousepad \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy artifacts, autostart entries, and services
COPY case-files/ /tmp/case-files/
COPY config/ /tmp/config/
COPY service/ /tmp/service/
COPY setup-bec.sh /tmp/setup-bec.sh

RUN bash /tmp/setup-bec.sh && rm -rf /tmp/case-files /tmp/config /tmp/service /tmp/setup-bec.sh

# Copy deterministic Priority 10/15/20/30 supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Patch noVNC for clipboard bridge
COPY patch_novnc.py /tmp/patch_novnc.py
RUN python3 /tmp/patch_novnc.py && rm /tmp/patch_novnc.py

# Exposed Ports:
# 6901: Desktop VNC Stream
# 8025: Mailpit Web Client (Webmail tab)
# 8080: Apex Corporate Intranet / Rule Auditor (Browser tab)
# 1025: Internal SMTP
EXPOSE 6901 8025 8080 1025

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
