# Cyber-Range Platform — Startup & Operations Manual

This guide contains the exact, step-by-step commands to start, run, operate, and shut down the entire Cyber-Range platform from scratch.

---

## 1. System Architecture Summary

The platform consists of four primary layers:
1. **PostgreSQL Database**: Stores users, lab scenarios, sessions, scores, and activity logs.
2. **K3s Kubernetes Control Plane**: Orchestrates on-demand isolated pods (`cyber-range-gui:latest`, `vulnerables/web-dvwa:latest`, etc.).
3. **Backend Orchestrator (Node.js/Express + TypeScript on Port 3001)**:
   - Manages user authentication (JWT).
   - Dynamically creates Kubernetes Namespaces, Deployments, Services, and NetworkPolicies using `@kubernetes/client-node`.
   - Bridges WebSockets for terminal access (`xterm.js`).
4. **Frontend Web App (Next.js 16 + React 19 on Port 3000)**:
   - Interactive user dashboard, Mission Control HUD, Arsenal drawer, bidirectional clipboard bridge, and session manager.

---

## 2. Step-by-Step Startup Sequence

Follow these steps in order whenever you want to start the project.

### Step 1: Open Your WSL Terminal
Open PowerShell or your Windows Terminal and launch WSL:
```bash
wsl -d kali-linux
cd /mnt/c/Users/DevKumar/Desktop/Scenario-cyberrange
```

---

### Step 2: Ensure PostgreSQL Database is Running
Check PostgreSQL service status and start it if needed:
```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Start PostgreSQL if it is not running
sudo service postgresql start
```

---

### Step 3: Start the K3s Kubernetes Engine
K3s provides the container orchestration engine that runs the vulnerable labs and the Kali AttackBox:
```bash
# Start K3s
sudo systemctl start k3s

# Verify K3s is healthy and Ready (takes 5-10 seconds)
kubectl get nodes
```
*Expected Output:*
```
NAME       STATUS   ROLES                  AGE   VERSION
devkumar   Ready    control-plane,master   ...   v1.28...
```

---

### Step 4: (Optional / One-Time) Seed Database with Default Scenarios
If starting with a fresh database or resetting scenarios:
```bash
# Generate Prisma Client and apply migrations
npx prisma generate
npx prisma migrate dev

# Seed users and lab definitions
npx tsx prisma/seed.ts
```

---

### Step 5: Start the Backend Orchestrator Server (Port 3001)
In your terminal (or a dedicated terminal tab):
```bash
cd /mnt/c/Users/DevKumar/Desktop/Scenario-cyberrange

# Start backend dev server
npm run dev
```
*Expected Output:*
```
[k8s]: Successfully connected to Kubernetes.
[k8s]: Found X namespaces...
Server listening on port 3001
WebSocket server ready for terminal sessions
```

---

### Step 6: Start the Frontend Next.js Client (Port 3000)
Open a second terminal window/tab:
```bash
cd /mnt/c/Users/DevKumar/Desktop/Scenario-cyberrange/frontend

# Start frontend dev server
npm run dev
```
*Expected Output:*
```
▲ Next.js 16 (Turbopack)
- Local: http://localhost:3000
✓ Ready in 2-3s
```

---

## 3. Accessing the Platform & Logging In

Open your web browser (Chrome, Edge, Firefox, Brave) and navigate to:
👉 **`http://localhost:3000`**

### Pre-Configured Accounts (from Seed):

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@cyberrange.local` | `Admin@1234` | Full system access, scenario creator, student monitoring |
| **Instructor** | `instructor@cyberrange.local` | `Instructor@1234` | Classroom management, lab review, grading |
| **Student** | Any new registered user | *(User Defined)* | Lab scenarios, AttackBox VM, terminal, flag submission |

---

## 4. How to Launch the Kali AttackBox Workstation

1. In the browser, log in and navigate to the **Scenarios** or **Labs** page.
2. Select **"Kali Linux GUI Workstation"**.
3. Click **"Launch Lab"**.
4. The backend will:
   - Create a dedicated namespace: `lab-<sessionId>`
   - Launch the pod using `cyber-range-gui:latest`
   - Start TigerVNC, XFCE4, and websockify inside the container
5. Click **"Open Desktop"** to access the graphical Kali Linux AttackBox in full screen with:
   - Custom Cyber-Range dark wallpaper
   - Papirus-Dark icons
   - Pre-installed security tools (Nmap, Gobuster, Nikto, Sqlmap, Hydra, John, Wireshark, Firefox)
   - Dual-directional copy/paste from the Arsenal drawer.

---

## 5. Daily Kubernetes Management Commands

Keep these commands handy while operating labs:

```bash
# Check all running lab containers
kubectl get pods -A -l app=vulnerable-lab

# Shell directly into the running Kali AttackBox
NS="lab-<sessionId>"
POD=$(kubectl -n $NS get pods -o jsonpath='{.items[0].metadata.name}')
kubectl -n $NS exec -it $POD -- bash

# View container logs
kubectl -n $NS logs -f $POD

# View live RAM and CPU utilization
kubectl -n $NS top pod $POD
```

---

## 6. How to Stop Everything Cleanly

When you are done with your working session, run these commands to completely free all system RAM and CPU:

```bash
# 1. Stop all active lab pods and namespaces
for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep '^lab-'); do
    kubectl delete namespace "$ns" --timeout=30s
done

# 2. Stop K3s Kubernetes service
sudo systemctl stop k3s

# 3. Stop PostgreSQL (Optional)
sudo service postgresql stop

# 4. Stop any background Node.js processes (Ctrl+C in terminal tabs)
```
