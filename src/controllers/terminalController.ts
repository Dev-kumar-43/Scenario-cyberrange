import { WebSocket, WebSocketServer } from 'ws';
import * as k8s from '@kubernetes/client-node';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { Writable, Readable } from 'stream';
import prisma from '../services/dbService.js';
import { kc } from '../k8s-client/k8sClient.js';

export function setupTerminalWebSockets(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      if (!req.url) {
        ws.close(1008, 'URL required');
        return;
      }

      const { query } = parse(req.url, true);
      const sessionId = query.sessionId as string;

      if (!sessionId) {
        ws.send('Error: sessionId is required\r\n');
        ws.close(1008, 'sessionId is required');
        return;
      }

      // 1. Verify session is running
      const session = await prisma.activeSession.findUnique({
        where: { id: sessionId },
        include: { lab: true }
      });

      if (!session) {
        ws.send('Error: Session not found\r\n');
        ws.close(1008, 'Session not found');
        return;
      }

      if (session.status !== 'RUNNING' && session.status !== 'CREATING' && session.status !== 'PENDING') {
        ws.send(`Error: Session is ${session.status}\r\n`);
        ws.close(1008, 'Invalid session status');
        return;
      }

      ws.send('Attaching to container shell...\r\n');

      const namespace = session.k8sNamespace;
      
      // 2. Find the pod name
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      const podsRes = await k8sCoreApi.listNamespacedPod({ namespace });
      if (podsRes.items.length === 0) {
        ws.send('Error: No pods found for session\r\n');
        ws.close(1011, 'No pods found');
        return;
      }
      
      const podName = podsRes.items[0].metadata?.name;
      if (!podName) {
        ws.send('Error: Pod name missing\r\n');
        ws.close(1011, 'Pod name missing');
        return;
      }

      const containerName = 'lab-container'; // configured in deployment

      // 3. Establish k8s exec session
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
      
      ws.on('message', (data: Buffer | string) => {
        // Feed data from xterm into the stdin stream
        stdinStream.push(data);
      });
      
      ws.on('close', () => {
        stdinStream.push(null); // End stdin stream
      });

      try {
        await exec.exec(
          namespace,
          podName,
          containerName,
          ['/bin/sh', '-c', 'TERM=xterm-256color /bin/sh'],
          stdoutStream, // stdout
          stdoutStream, // stderr (pipe both to browser)
          stdinStream,  // stdin
          true,           // tty
          (status: k8s.V1Status) => {
            console.log('K8s Exec Status:', status);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('\r\nTerminal disconnected.\r\n');
              ws.close();
            }
          }
        );
      } catch (execError: any) {
        console.error('Exec error:', execError);
        ws.send(`\r\nFailed to start terminal: ${execError.message}\r\n`);
        ws.close(1011, 'Exec failed');
      }

    } catch (error: any) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });
}
