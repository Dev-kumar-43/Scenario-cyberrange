# Cyber-Range Kali Workstation Architecture & Kubernetes Operator Guide

This comprehensive technical guide explains how the **Kali Linux AttackBox Workstation** is provisioned, orchestrated, and operated within the Cyber-Range platform. It covers the underlying architecture, resource consumption metrics, step-by-step launch lifecycle, and an exhaustive **Kubernetes / K3s command handbook** designed for engineers, instructors, and system operators.

---

## Table of Contents
1. [Architecture & Technology Stack](#1-architecture--technology-stack)
2. [End-to-End Launch Lifecycle](#2-end-to-end-launch-lifecycle)
3. [Resource Consumption Metrics (CPU, Memory, Storage)](#3-resource-consumption-metrics-cpu-memory-storage)
4. [Master Kubernetes & K3s Command Handbook](#4-master-kubernetes--k3s-command-handbook)
5. [In-Depth Technology Deep Dive](#5-in-depth-technology-deep-dive)
6. [Operator Troubleshooting Runbook](#6-operator-troubleshooting-runbook)

---

## 1. Architecture & Technology Stack

### Why a Containerized Workstation Instead of a Heavy VM?
Traditional cyber ranges run full hardware virtualization using hypervisors (e.g. VMware ESXi, Proxmox, or QEMU/KVM). While hypervisors provide hardware-level isolation, they introduce massive overhead:
- **Boot time**: 45–90 seconds per VM.
- **Resource overhead**: 2–4 GB static RAM reservation, heavy kernel overhead, static virtual disk images (20–40 GB per VM).
- **Scalability**: A single server can only support 10–20 concurrent student VMs.

Our platform uses **containerized micro-workstations** orchestrated by **K3s (Lightweight Kubernetes)**:
- **Instant startup**: Containers spin up in **2 to 5 seconds**.
- **Shared host kernel**: Linux kernel namespaces (`pid`, `net`, `ipc`, `mnt`, `uts`) provide process-level sandboxing.
- **Dynamic memory management**: Linux cgroups dynamically allocate memory on-demand up to a hard ceiling (`1536Mi`).
- **High density**: 50–100 concurrent student attackboxes on modest infrastructure.

### System Architecture & Data Flow Diagram

```
+-----------------------------------------------------------------------------------+
|                                STUDENT WEB BROWSER                                |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | Next.js Frontend HUD (Mission Control, Arsenal, Session Timer, Clipboard) |   |
|   +---------------------------------------------------------------------------+   |
|                                         |                                         |
|                                         | <iframe> postMessage Bridge             |
|                                         v                                         |
|   +---------------------------------------------------------------------------+   |
|   | noVNC Web Client (HTML5 Canvas + WebSockets + RFB Protocol Handler)       |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
                                          |
                      WSS / HTTPS :6901   | (NodePort or Traefik Ingress)
                                          v
+-----------------------------------------------------------------------------------+
|                            K3s KUBERNETES POD CONTAINER                           |
|                         (Namespace: lab-<sessionId>)                              |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | Supervisord (PID 1 Process Manager)                                       |   |
|   |                                                                           |   |
|   |  1. websockify (Port 6901 -> localhost:5900 TCP/WebSocket bridge)         |   |
|   |  2. TigerVNC Xvnc (Port 5900, Display :0, X11 Server + RANDR Extension)   |   |
|   |  3. autocutsel (CLIPBOARD <-> PRIMARY selection bridge)                   |   |
|   |  4. XFCE4 Desktop (xfwm4, xfsettingsd, xfce4-panel, xfdesktop, Thunar)    |   |
|   |  5. Student Tooling (Terminal, Firefox, Nmap, Gobuster, Wireshark, etc.)  |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 2. End-to-End Launch Lifecycle

When a student clicks **"Launch Lab"** or navigates to an offensive scenario requiring the graphical AttackBox, the platform executes an automated 7-stage lifecycle:

```
[Student Clicks Launch]
         |
         v
1. REST API Request (POST /api/labs/start)
         |
         v
2. Authentication & Database State (Prisma + PostgreSQL)
         |
         v
3. Dedicated Namespace Isolation (lab-<sessionId>)
         |
         v
4. Kubernetes Manifest Generation & Application:
   ├── a. NetworkPolicy (Ingress :6901, Egress DNS :53 + HTTP :80/443)
   ├── b. Deployment (image: cyber-range-gui:latest, limits: 1 CPU, 1.5GB RAM)
   ├── c. Service (type: NodePort, port: 6901)
   └── d. Traefik IngressRoute (http://lab-<sessionId>.local)
         |
         v
5. Container Boot & Supervisord Initialization:
   ├── Xvnc starts on virtual display :0 (1920x1080 native with RANDR dynamic resizing)
   ├── autocutsel launches dual synchronization for CLIPBOARD and PRIMARY buffers
   ├── XFCE4 session manager loads Kali-Dark theme and Papirus-Dark icons
   └── websockify serves noVNC static web assets and bridges WebSocket traffic to :5900
         |
         v
6. Health Check & Ready State:
   Backend verifies Pod reaches 'Ready' condition and retrieves allocated NodePort/URL
         |
         v
7. Browser Rendering:
   Frontend loads noVNC iframe with autoconnect=true, establishing bidirectional postMessage
```

---

## 3. Resource Consumption Metrics (CPU, Memory, Storage)

### A. Memory (RAM) Consumption

| Component / State | Memory Footprint (RSS) | Description |
| :--- | :--- | :--- |
| **Supervisord (PID 1)** | ~28 MiB | Process supervisor managing 4 child services |
| **TigerVNC Xvnc (:0)** | ~118 MiB | Combined X11 display server and RFB VNC frame buffer |
| **websockify (Python 3)** | ~38 MiB | Asynchronous WebSocket-to-TCP socket bridge |
| **autocutsel (x2 daemons)** | ~8 MiB total | X11 CUTBUFFER0 / CLIPBOARD sync daemons |
| **XFCE4 Core Stack** | ~280 MiB combined | `xfwm4` (123 MB), `xfce4-panel` (42 MB), `xfdesktop` (59 MB), `Thunar` (26 MB), `xfsettingsd` (26 MB) |
| **Total Workstation Idle** | **~470 – 540 MiB** | Base memory consumed when no student tools are open |
| **Active Terminal + Nmap** | **~520 – 600 MiB** | Running active network scans and scripts |
| **Active Firefox ESR (2 tabs)** | **~750 – 950 MiB** | Modern browser with web inspection tools running |
| **Heavy Lab (Wireshark + Firefox + Nmap)** | **~1.1 – 1.35 GiB** | Peak concurrent interactive usage |
| **Hard Memory Limit Ceiling** | **`1536Mi` (1.5 GiB)** | Set in `spec.containers[0].resources.limits.memory` |
| **Guaranteed Memory Request** | **`128Mi`** | Set in `spec.containers[0].resources.requests.memory` |

> **Note on OOM (Out Of Memory) Prevention:**
> The pod has a strict ceiling of **1.5 GB**. If a student runs a memory-leaking process or loads a massive 10 GB wordlist entirely into memory, the Linux kernel cgroup will terminate the offending process (`OOMKilled`) rather than crashing the host system.

---

### B. CPU Consumption

| State | CPU Allocation / Limit | Actual Usage |
| :--- | :--- | :--- |
| **Kubernetes Request** | `100m` (0.1 CPU core) | Baseline guaranteed reservation on node |
| **Kubernetes Limit** | `1000m` (1.0 CPU core) | Maximum burstable CPU limit |
| **Idle Workstation** | 10–25m (1% to 2.5% CPU) | Framebuffer at rest; minimal compositor updates |
| **Active Screen Scrolling / Typing** | 50–120m (5% to 12% CPU) | Xvnc encoding dirty screen rectangles |
| **Active Port Scanning (Nmap)** | 100–300m (10% to 30% CPU) | Raw socket generation and packet dispatch |
| **Password Cracking (John / Hydra)** | 800–1000m (80% to 100% CPU) | CPU throttle throttles cracking gracefully at 1 core |

---

### C. Storage & Disk Consumption

| Layer | Size | Storage Mechanism | Persistence |
| :--- | :--- | :--- | :--- |
| **Base Docker Image** | **3.73 GB** (uncompressed) | Stored once in K3s containerd content store (`/var/lib/rancher/k3s/agent/containerd/io.containerd.content.v1.content/`) | Read-only shared across all sessions |
| **Compressed OCI Archive** | **889.5 MiB** | Compressed tar layers used during image transport | Read-only |
| **Container Writable Layer** | **10 MiB – 250 MiB** | Ephemeral Linux `OverlayFS` copy-on-write upper layer | Destroyed when session terminates |
| **Total Host Disk per Session** | **< 200 MiB** | Ultra-efficient; 50 sessions consume < 10 GB host disk | Ephemeral |

---

## 4. Master Kubernetes & K3s Command Handbook

When you need to inspect, debug, manage, or restart the Kali AttackBox environment directly from the terminal without an AI assistant, use this command reference.

### 1. Finding Namespaces & Sessions
Every active lab session runs in its own dedicated namespace prefixed with `lab-`:

```bash
# List all active lab namespaces
kubectl get namespaces | grep '^lab-'

# List all pods across all lab namespaces with IP addresses and nodes
kubectl get pods -A -l app=vulnerable-lab -o wide
```

### 2. Inspecting the Running Kali Pod
To inspect the active pod in a specific lab namespace (e.g. `lab-66184fa5-1a14-4cb6-a0eb-b2d933aee07d`):

```bash
# Set your target namespace variable
NS="lab-66184fa5-1a14-4cb6-a0eb-b2d933aee07d"

# Get pod name and status
kubectl -n $NS get pods

# Detailed pod state (Events, image pull status, IP, resource limits)
kubectl -n $NS describe pod -l app=vulnerable-lab
```

### 3. Shelling Directly into the Kali AttackBox
You can open an interactive root shell inside the running Kali container at any time:

```bash
# Execute bash inside the running AttackBox
POD=$(kubectl -n $NS get pods -o jsonpath='{.items[0].metadata.name}')
kubectl -n $NS exec -it $POD -- bash

# Check system processes inside the container
kubectl -n $NS exec $POD -- ps aux

# Check available disk space inside the container
kubectl -n $NS exec $POD -- df -h /root
```

### 4. Viewing Real-Time Logs
To check the output of `supervisord`, `Xvnc`, or `websockify`:

```bash
# Stream real-time container output
kubectl -n $NS logs -f $POD

# Stream previous terminated container logs (if the pod crashed or restarted)
kubectl -n $NS logs $POD --previous
```

### 5. Checking Live CPU & Memory Usage
To verify exactly how much memory and CPU the Kali workstation is using right now:

```bash
# View real-time CPU (millicores) and Memory (MiB) consumption
kubectl -n $NS top pod $POD

# View total node capacity and utilization
kubectl top nodes
```

### 6. Port-Forwarding Direct Access
If you want to bypass the browser frontend and connect directly to the AttackBox from your local browser or desktop VNC client:

```bash
# Forward noVNC web interface to your localhost:6901
kubectl -n $NS port-forward $POD 6901:6901
# Now open in your browser: http://localhost:6901/vnc.html

# Forward raw RFB VNC server to port 5900 (for native TigerVNC/Remmina viewers)
kubectl -n $NS port-forward $POD 5900:5900
# Now open in native VNC viewer: localhost:5900 (No password)
```

### 7. Managing Container Images in K3s Containerd
K3s does not use Docker directly for running pods; it uses an embedded **containerd** runtime. All Kubernetes images must reside in containerd's **`k8s.io`** namespace:

```bash
# List all images recognized by Kubernetes in containerd
sudo k3s ctr -n k8s.io images list | grep cyber-range-gui

# Import a newly built Docker image into K3s containerd
docker save cyber-range-gui:latest | sudo k3s ctr -n k8s.io images import -

# Remove an old or stale image tag from containerd
sudo k3s ctr -n k8s.io images rm docker.io/library/cyber-range-gui:latest cyber-range-gui:latest
```

### 8. Restarting or Rolling Out an Updated AttackBox
When you rebuild the Docker image and want an active session to immediately run the new version:

```bash
# Fast graceful pod recreation (ReplicaSet will immediately boot the fresh image)
kubectl -n $NS delete pod -l app=vulnerable-lab --now

# Wait for the new pod to reach Ready state
kubectl -n $NS wait --for=condition=Ready pod -l app=vulnerable-lab --timeout=60s
```

### 9. Deleting or Cleaning Up a Lab Session
To manually tear down a session and free all allocated RAM, CPU, and network rules:

```bash
# Delete the entire namespace (deletes Deployment, Pod, Service, NetworkPolicy simultaneously)
kubectl delete namespace $NS
```

---

## 5. In-Depth Technology Deep Dive

### 1. Dynamic Resolution Resizing with TigerVNC & RANDR
Standard VNC servers (like tightvnc or vnc4server) allocate a fixed framebuffer (e.g. 1024x768). When a user resizes their browser window or toggles fullscreen on a 4K display, old VNC servers either letterbox with ugly black bars or blur the screen with fuzzy pixel stretching.

Our AttackBox uses **TigerVNC Xvnc** compiled with the **X11 RANDR (Resize and Rotate)** extension:
- `supervisord.conf` launches:
  `/usr/bin/Xvnc :0 -geometry 1920x1080 -depth 24 -rfbport 5900 -SecurityTypes None -desktop "Kali Workstation" -ac -pn`
- When the student enters fullscreen, noVNC sends an RFB `SetDesktopSize` pseudo-encoding packet.
- TigerVNC intercepts this packet and issues an internal `XRRSetScreenSize` syscall.
- XFCE's desktop daemon (`xfdesktop`) and window manager (`xfwm4`) instantly re-anchor the wallpaper, dock, and panels to the exact new pixel dimensions without restarting any applications.

### 2. Bidirectional Clipboard Synchronization
Because the Kali Linux VM runs inside an HTML iframe, standard browser clipboard security normally blocks seamless copy-pasting. We solved this with a triple-layer synchronization bridge:

1. **In-Guest Selection Bridge (`autocutsel`)**:
   X11 has two independent clipboard buffers: `CLIPBOARD` (used by Ctrl+C/Ctrl+V in GUI apps) and `PRIMARY` (used by highlighting text and middle-clicking in terminals). Supervisord runs two concurrent `autocutsel` daemons to continuously synchronize both selections into `CUTBUFFER0`.
2. **WebSocket RFB Clipboard Packets**:
   When text is copied in the VM, TigerVNC dispatches an `ExtendedClipboard` message to noVNC.
3. **Iframe `postMessage` Telemetry Bridge**:
   Our patched `noVNC/app/ui.js` intercepts `clipboardReceive` and executes:
   ```javascript
   if (window.parent && window.parent !== window) {
       window.parent.postMessage({ type: 'KALI_CLIPBOARD_SYNC', text: clipText }, '*');
   }
   ```
   Conversely, when a student clicks any command in the **Arsenal** or **Mission Control** drawer, the frontend posts `{ type: 'KALI_CLIPBOARD_PASTE', text: command }` directly into the iframe, which calls `UI.rfb.clipboardPasteFrom(text)`, making it ready to paste into the terminal instantly.

### 3. XFCE Configuration Engine (Xfconf)
XFCE configuration is governed by `xfconfd` channels located in `/root/.config/xfce4/xfconf/xfce-perchannel-xml/`:
- **`xsettings.xml`**: Controls the GTK3 widget theme (`Kali-Dark`), icon theme (`Papirus-Dark`), monospace fonts (`Hack 10`), and forces exact **`96 DPI`** scaling to maintain strict 100% viewport proportionality.
- **`xfce4-desktop.xml`**: Maps `/backdrop/screen0/monitor0/workspace0/last-image` to our custom wallpaper, sets desktop icon size to `48px`, and hides default trash/filesystem clutter.
- **`xfce4-panel.xml`**: Configures panel 1 (top bar at 28px height with applications menu, tasklist, pager, clock) and panel 2 (bottom launcher dock).
- **`xfwm4.xml`**: Controls window decorations, border snapping, dark title bars, and compositing shadows.
- **`terminalrc`**: Sets font to `Hack 11`, background to GitHub Dark `#0d1117`, scrollback buffer to 10,000 lines, and sets `MiscShowUnsafePasteDialog=FALSE` so pasted multi-line scripts execute immediately without blocking warning popups.

---

## 6. Operator Troubleshooting Runbook

### Issue 1: "Screen is completely black or showing 'Connecting...'"
**Cause:** Either the pod is still pulling the image, or websockify has not bound to port 6901 yet.
**Fix:**
```bash
# 1. Check if pod is running
kubectl -n $NS get pods

# 2. Check if supervisord started Xvnc and websockify
kubectl -n $NS logs $POD | tail -20

# 3. If websockify is stuck, restart supervisord
kubectl -n $NS exec $POD -- kill -HUP 1
```

### Issue 2: "Icons look like default Adwaita / Theme looks light"
**Cause:** XFCE session started before xsettings XML was read by DBus.
**Fix:**
```bash
# Force-apply the dark theme and Papirus icons dynamically
kubectl -n $NS exec -e DISPLAY=:0 $POD -- xfconf-query -c xsettings -p /Net/ThemeName -s "Kali-Dark"
kubectl -n $NS exec -e DISPLAY=:0 $POD -- xfconf-query -c xsettings -p /Net/IconThemeName -s "Papirus-Dark"
```

### Issue 3: "Pod status shows ImagePullBackOff or ErrImagePull"
**Cause:** K3s containerd does not have the `cyber-range-gui:latest` image loaded in its `k8s.io` namespace.
**Fix:**
```bash
# Re-import image from local Docker directly into K3s containerd
docker save cyber-range-gui:latest | sudo k3s ctr -n k8s.io images import -

# Delete pod to force K3s to restart it with the newly available image
kubectl -n $NS delete pod -l app=vulnerable-lab --now
```

### Issue 4: "Commands copied from Arsenal do not paste into Terminal"
**Cause:** Browser clipboard permissions are blocked, or `autocutsel` daemon died.
**Fix:**
```bash
# Check if autocutsel is running inside the pod
kubectl -n $NS exec $POD -- ps aux | grep autocutsel

# If not running, restart it
kubectl -n $NS exec -e DISPLAY=:0 -d $POD -- autocutsel -selection CLIPBOARD
kubectl -n $NS exec -e DISPLAY=:0 -d $POD -- autocutsel -selection PRIMARY
```

---

## 7. Architecture Summary Table

| Specification | Value / Configuration |
| :--- | :--- |
| **Orchestrator** | K3s (Lightweight Kubernetes v1.28+) |
| **Container Engine** | containerd (namespace: `k8s.io`) |
| **Base Operating System** | Kali Linux Rolling 2026.3 |
| **Display Server** | TigerVNC Xvnc on `:0` with native RANDR 1.4+ dynamic resizing |
| **Desktop Environment** | XFCE 4.20 (Customized with Kali-Dark & Papirus-Dark) |
| **Web Gateway** | websockify (Python 3) bridging WebSocket :6901 to TCP :5900 |
| **Web VNC Client** | noVNC HTML5 Web Client with custom bidirectional clipboard bridge |
| **Network Isolation** | Per-session Kubernetes Namespace + Ingress/Egress NetworkPolicy |
| **Default RAM Allocation** | Request: `128Mi` \| Limit: `1536Mi` (1.5 GB) |
| **Default CPU Allocation** | Request: `100m` (0.1 CPU) \| Limit: `1000m` (1.0 CPU) |
| **Pre-Installed Tool Arsenal** | Nmap, Gobuster, Nikto, Sqlmap, Hydra, John, Wireshark, Tshark, Tcpdump, Netcat, Socat, Firefox ESR, Wordlists |
