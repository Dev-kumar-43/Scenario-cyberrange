import { WebSocket, WebSocketServer } from 'ws';
import * as k8s from '@kubernetes/client-node';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { Writable, Readable } from 'stream';
import prisma from '../services/dbService.js';
import { kc, k8sApi } from '../k8s-client/k8sClient.js';
import { verifyToken } from '../utils/jwt.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function setupTerminalWebSockets(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      if (!req.url) {
        ws.close(1008, 'URL required');
        return;
      }

      // 1. Cross-Site WebSocket Hijacking (CSWSH) protection
      const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
        : ['http://localhost:3000'];

      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        console.warn(`[terminalController] Rejected WebSocket connection from untrusted origin: ${origin}`);
        ws.send('Error: Cross-origin connection rejected\r\n');
        ws.close(1008, 'Origin not allowed');
        return;
      }

      const { query } = parse(req.url, true);
      const sessionId = query.sessionId as string;
      const token = query.token as string;
      const machineId = (query.machineId || query.machine) as string | undefined;

      if (!sessionId) {
        ws.send('Error: sessionId is required\r\n');
        ws.close(1008, 'sessionId is required');
        return;
      }

      // 2. Authenticate WebSocket Connection
      if (!token) {
        ws.send('Error: Authentication token is required\r\n');
        ws.close(1008, 'Token required');
        return;
      }

      const tokenPayload = verifyToken(token);
      if (!tokenPayload) {
        ws.send('Error: Invalid or expired authentication token\r\n');
        ws.close(1008, 'Invalid token');
        return;
      }

      // 3. Verify session exists and belongs to the authenticated user (or user is ADMIN)
      const session = await prisma.activeSession.findUnique({
        where: { id: sessionId },
        include: { lab: true }
      });

      if (!session) {
        ws.send('Error: Lab session not found\r\n');
        ws.close(1008, 'Session not found');
        return;
      }

      if (session.userId !== tokenPayload.id && tokenPayload.role !== 'ADMIN') {
        ws.send('Error: Forbidden. You do not own this lab session.\r\n');
        ws.close(1008, 'Forbidden');
        return;
      }

      if (session.status === 'STOPPED' || session.status === 'STOPPING') {
        ws.send('Error: Session is stopped.\r\n');
        ws.close(1008, 'Session stopped');
        return;
      }

      if (session.status === 'ERROR') {
        ws.send('\x1b[31mError: This lab instance encountered a provisioning error.\x1b[0m\r\nPlease delete this session from Active Sessions and start a fresh lab from the Dashboard.\r\n');
        ws.close(1008, 'Session in error state');
        return;
      }

      ws.send(`\r\nConnecting to ${machineId ? machineId.toUpperCase() + ' ' : ''}workstation...\r\n`);

      const namespace = session.k8sNamespace;

      // 4. Poll for running container pod if still creating/pending
      let podName: string | undefined;
      let targetContainerName = 'lab-container';
      let isReady = false;
      const maxRetries = 30; // 30 attempts * 2s = 60s max wait for image download
      let attempt = 0;

      while (attempt < maxRetries && !isReady) {
        attempt++;
        const podsRes = await k8sApi.listNamespacedPod({ namespace });
        if (podsRes.items.length > 0) {
          // If machineId is specified, find matching pod by label or name
          let pod = podsRes.items[0];
          if (machineId) {
            const matched = podsRes.items.find((p) => {
              const labels = p.metadata?.labels || {};
              const name = p.metadata?.name || '';
              return labels.machine === machineId || labels.role === machineId || name.includes(machineId);
            });
            if (matched) pod = matched;
          }

          podName = pod.metadata?.name;
          const phase = pod.status?.phase;
          const containerStatuses = pod.status?.containerStatuses || [];
          const containerStatus = containerStatuses.find((c) => c.name === targetContainerName) || containerStatuses[0];
          
          if (containerStatus) {
            targetContainerName = containerStatus.name;
          }

          const containerReady = containerStatus?.ready || false;

          if (phase === 'Running' && containerReady) {
            isReady = true;
            break;
          }

          const waitingReason = containerStatuses[0]?.state?.waiting?.reason;
          if (waitingReason) {
            ws.send(`Container state: ${waitingReason} (attempt ${attempt}/${maxRetries})...\r\n`);
          } else {
            ws.send(`Workstation is initializing, please wait... (attempt ${attempt}/${maxRetries})\r\n`);
          }
        } else {
          ws.send(`Waiting for pod allocation in Kubernetes namespace... (${attempt}/${maxRetries})\r\n`);
        }

        await sleep(2000);
      }

      if (!podName || !isReady) {
        ws.send('Error: Container failed to reach ready state in time. Please verify cluster status.\r\n');
        ws.close(1011, 'Pod not ready');
        return;
      }

      // Update session to RUNNING in database if not already running
      if (session.status !== 'RUNNING') {
        await prisma.activeSession.update({
          where: { id: sessionId },
          data: { status: 'RUNNING', k8sPodName: podName }
        });
      }

      ws.send('Attaching interactive shell...\r\n\r\n');

      const containerName = targetContainerName;

      // 5. Establish Kubernetes Exec session
      const exec = new k8s.Exec(kc);

      const stdinStream = new Readable({
        read(size) {}
      });

      const stdoutStream = new Writable({
        write(chunk, encoding, callback) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
          }
          callback();
        }
      });

      // Handle client input and filter control messages (e.g. resize events)
      ws.on('message', (data: Buffer | string) => {
        const text = data.toString();
        if (text.startsWith('{') && text.endsWith('}')) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.type === 'resize') {
              // Gracefully handle resize control frames without feeding raw JSON into terminal stdin
              return;
            }
          } catch {
            // Not JSON, continue to stream
          }
        }
        stdinStream.push(data);
      });

      ws.on('close', () => {
        stdinStream.push(null);
      });

      try {
        await exec.exec(
          namespace,
          podName,
          containerName,
          ['/bin/sh', '-c', 'TERM=xterm-256color /bin/sh'],
          stdoutStream,
          stdoutStream,
          stdinStream,
          true,
          (status: k8s.V1Status) => {
            console.log(`[ws-terminal] Pod Exec Status: ${status.status}`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('\r\nTerminal session disconnected.\r\n');
              ws.close();
            }
          }
        );
      } catch (execError: any) {
        console.error('[ws-terminal] Exec error:', execError);
        ws.send(`\r\nFailed to start terminal: ${execError.message}\r\n`);
        ws.close(1011, 'Exec failed');
      }

    } catch (error: any) {
      console.error('[terminalController] WebSocket error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, 'Internal server error');
      }
    }
  });
}
