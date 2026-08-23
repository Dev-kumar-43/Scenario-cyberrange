# Cyber Range Platform

A modern, browser-based, interactive cybersecurity lab environment where users can spin up vulnerable Docker containers on-demand and interact with them via an in-browser terminal or GUI.

## Features

- **On-Demand Orchestration**: Spin up vulnerable containers instantly using K3s/Minikube.
- **In-Browser Terminal**: Fully interactive Web-based terminal powered by `xterm.js` connecting directly to your Kubernetes containers via WebSockets.
- **Beautiful UI**: A premium, responsive, glassmorphism dark theme built with Next.js and React.
- **Active Session Management**: View, access, and terminate your running labs natively from the dashboard.

## Tech Stack

- **Frontend**: Next.js 16 (React 19), `xterm.js`, Vanilla CSS Modules
- **Backend**: Node.js, Express, TypeScript, `ws` (WebSockets)
- **Database**: PostgreSQL (managed via Prisma ORM)
- **Orchestration**: Kubernetes (K3s/Minikube), `@kubernetes/client-node`

## Prerequisites

- Node.js (v18+)
- PostgreSQL Database
- Local Kubernetes Cluster (Minikube or K3s)
- `kubectl` configured and authenticated

## Quick Start

### 1. Database Setup
Ensure PostgreSQL is running and update the `DATABASE_URL` in your `.env` file.
```bash
# Seed the database with initial users and lab definitions
npm install
npx tsx prisma/seed.ts
```

### 2. Start the Orchestrator Backend
The backend handles Kubernetes API requests and WebSocket tunneling.
```bash
# From the root directory
npm install
npm run build
npm run start
```
*Note: The backend runs on port 3001.*

### 3. Start the Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
*Note: The frontend runs on port 3000.*

## Architecture

1. **Frontend**: Makes REST API calls to the backend to fetch lab definitions and active sessions.
2. **Backend**: Acts as the Orchestrator. When a lab is requested, it provisions a new Kubernetes Namespace, Deployment, and Service.
3. **WebSockets**: When opening a terminal, the frontend establishes a WebSocket connection to the backend (`ws://localhost:3001/api/terminal`). The backend proxies this directly into the target pod using the Kubernetes Exec API.

## License

ISC
