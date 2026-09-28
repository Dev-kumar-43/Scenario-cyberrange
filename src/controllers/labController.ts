import { Request, Response } from 'express';
import os from 'os';
import net from 'net';
import { spawn, exec } from 'child_process';
import prisma from '../services/dbService.js';
import { k8sApi, appsApi, networkingApi, customObjectsApi } from '../k8s-client/k8sClient.js';

// Helper to resolve host IP accessible from browser/client
function getHostIp(): string {
  if (process.env.LAB_HOST_IP) {
    return process.env.LAB_HOST_IP;
  }
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.startsWith('eth') || name.startsWith('wlan') || name.startsWith('en')) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  return 'localhost';
}

// TCP Port Probe to verify container service is accepting connections
function checkPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

// Automated background reaper: cleans up expired sessions every 60 seconds
export const reapExpiredSessions = async () => {
  try {
    const now = new Date();
    const expiredSessions = await prisma.activeSession.findMany({
      where: {
        status: { in: ['RUNNING', 'CREATING', 'PENDING'] },
        expiresAt: { lt: now }
      }
    });

    for (const sess of expiredSessions) {
      console.log(`[reaper]: Reaping expired lab session ${sess.id} (namespace: ${sess.k8sNamespace})...`);
      try {
        await k8sApi.deleteNamespace({ name: sess.k8sNamespace });
      } catch {
        // Ignore error if namespace already removed
      }
      await prisma.activeSession.update({
        where: { id: sess.id },
        data: {
          status: 'STOPPED',
          stoppedAt: now
        }
      });
      console.log(`[reaper]: Released cluster resources for expired session ${sess.id}`);
    }
  } catch (err: any) {
    console.warn('[reaper]: Session reaper warning:', err.message);
  }
};

// Start background reaper timer (runs every 60s)
setInterval(reapExpiredSessions, 60000);

export const startLab = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { labId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!labId) {
    return res.status(400).json({ error: 'labId is required' });
  }

  try {
    // 1. Verify User and LabDefinition exist
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const lab = await prisma.labDefinition.findUnique({ where: { id: labId } });
    if (!lab) return res.status(404).json({ error: 'Lab definition not found' });

    // 2. Check for existing active session
    const existingSession = await prisma.activeSession.findUnique({
      where: {
        userId_labId: { userId, labId }
      }
    });

    if (existingSession && existingSession.status !== 'STOPPED' && existingSession.status !== 'ERROR') {
      return res.status(400).json({ 
        error: 'An active session for this lab already exists',
        session: existingSession 
      });
    }

    // Default session TTL: 60 minutes from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // 3. Create or update session in DB
    const session = await prisma.activeSession.upsert({
      where: { userId_labId: { userId, labId } },
      update: { 
        status: 'PENDING',
        startedAt: new Date(),
        expiresAt,
        stoppedAt: null
      },
      create: {
        userId,
        labId,
        k8sNamespace: '',
        status: 'PENDING',
        startedAt: new Date(),
        expiresAt
      }
    });

    const namespaceName = `lab-${session.id}`;
    const traefikUrl = `http://${namespaceName}.local`;
    let directUrl = traefikUrl;

    // Update DB with namespace and URL
    await prisma.activeSession.update({
      where: { id: session.id },
      data: { k8sNamespace: namespaceName, traefikUrl }
    });

    // 4. Generate and Apply K8s Manifests
    try {
      // 4a. Create Namespace
      try {
        await k8sApi.createNamespace({
          body: { metadata: { name: namespaceName } }
        });
      } catch (nsError: any) {
        if (nsError.code !== 409) throw nsError;
      }

      // 4b. Create NetworkPolicy for sandboxing
      const networkPolicyManifest = {
        metadata: {
          name: 'lab-network-policy',
          namespace: namespaceName
        },
        spec: {
          podSelector: {},
          policyTypes: ['Ingress', 'Egress'],
          ingress: [{
            ports: [{ port: lab.exposedPort }]
          }],
          egress: [
            // Allow DNS resolution (port 53 UDP & TCP)
            {
              ports: [
                { protocol: 'UDP', port: 53 },
                { protocol: 'TCP', port: 53 }
              ]
            },
            // Allow outbound HTTP/HTTPS for interactive workstations/tools (VNC)
            ...(lab.protocol === 'VNC' ? [
              { ports: [{ protocol: 'TCP', port: 80 }] },
              { ports: [{ protocol: 'TCP', port: 443 }] }
            ] : [])
          ]
        }
      };

      try {
        await networkingApi.createNamespacedNetworkPolicy({
          namespace: namespaceName,
          body: networkPolicyManifest as any
        });
      } catch (netError: any) {
        console.warn('[labController] Warning: Could not create NetworkPolicy:', netError.message);
      }

      // 4c. Create Deployment with hardened securityContext and no serviceAccount automount
      const deploymentManifest = {
        metadata: {
          name: 'lab-deployment',
          namespace: namespaceName,
          labels: { app: 'vulnerable-lab' }
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: { app: 'vulnerable-lab' }
          },
          template: {
            metadata: { labels: { app: 'vulnerable-lab' } },
            spec: {
              automountServiceAccountToken: false, // Security: do not mount cluster API tokens
              containers: [{
                name: 'lab-container',
                image: lab.dockerImage,
                imagePullPolicy: 'IfNotPresent',
                ports: [{ containerPort: lab.exposedPort }],
                resources: {
                  limits: { cpu: lab.cpuLimit, memory: lab.memLimit },
                  requests: { cpu: '100m', memory: '128Mi' }
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  ...(lab.protocol !== 'VNC' ? {
                    capabilities: {
                      drop: ['ALL']
                    }
                  } : {})
                }
              }]
            }
          }
        }
      };

      await appsApi.createNamespacedDeployment({
        namespace: namespaceName, 
        body: deploymentManifest as any
      });

      // 4d. Create Service (NodePort allows direct client/noVNC browser access)
      const serviceManifest = {
        metadata: {
          name: 'lab-service',
          namespace: namespaceName
        },
        spec: {
          selector: { app: 'vulnerable-lab' },
          ports: [{ port: lab.exposedPort, targetPort: lab.exposedPort }],
          type: 'NodePort'
        }
      };

      const createdService = await k8sApi.createNamespacedService({
        namespace: namespaceName, 
        body: serviceManifest as any
      });

      const nodePort = (createdService as any)?.spec?.ports?.[0]?.nodePort;
      const hostIp = getHostIp();
      directUrl = nodePort 
        ? `http://${hostIp}:${nodePort}${lab.protocol === 'VNC' ? '/vnc.html?autoconnect=true&resize=scale&quality=9' : ''}`
        : traefikUrl;

      // Update session with direct URL
      await prisma.activeSession.update({
        where: { id: session.id },
        data: { traefikUrl: directUrl }
      });

      // 4e. Create Traefik IngressRoute (Traefik v3 CRD)
      const ingressRouteManifest = {
        apiVersion: 'traefik.io/v1alpha1',
        kind: 'IngressRoute',
        metadata: {
          name: 'lab-ingress',
          namespace: namespaceName
        },
        spec: {
          entryPoints: ['web'],
          routes: [{
            match: `Host(\`${namespaceName}.local\`)`,
            kind: 'Rule',
            services: [{
              name: 'lab-service',
              port: lab.exposedPort
            }]
          }]
        }
      };
      
      try {
        await customObjectsApi.createNamespacedCustomObject({
          group: 'traefik.io',
          version: 'v1alpha1',
          namespace: namespaceName,
          plural: 'ingressroutes',
          body: ingressRouteManifest
        });
      } catch (ingressError: any) {
        console.warn('[labController] Warning: Could not create Traefik IngressRoute:', ingressError.message);
      }

      // 5. Update DB Status to CREATING
      await prisma.activeSession.update({
        where: { id: session.id },
        data: { status: 'CREATING' }
      });

      return res.status(202).json({ 
        message: 'Lab startup initiated successfully',
        sessionId: session.id,
        namespace: namespaceName,
        url: directUrl,
        expiresAt
      });

    } catch (k8sDeployError: any) {
      console.error('[labController] K8s provisioning error, rolling back session state:', k8sDeployError);
      await prisma.activeSession.update({
        where: { id: session.id },
        data: { status: 'ERROR' }
      });

      try {
        await k8sApi.deleteNamespace({ name: namespaceName });
      } catch {}

      return res.status(500).json({ 
        error: 'Failed to provision lab cluster resources. Please verify Kubernetes status and try again.' 
      });
    }

  } catch (error: any) {
    console.error('[labController] startLab Error:', error);
    return res.status(500).json({ error: 'Failed to start lab. Internal server error.' });
  }
};

export const extendLabSession = async (req: Request, res: Response) => {
  try {
    const { sessionId, minutes = 30 } = req.body;
    const userId = req.user?.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (session.status !== 'RUNNING' && session.status !== 'CREATING') {
      return res.status(400).json({ error: 'Cannot extend an inactive lab session.' });
    }

    // Maximum 180 minutes total from startedAt
    const maxExpiry = new Date(session.startedAt.getTime() + 180 * 60 * 1000);
    const currentExpiry = session.expiresAt || new Date(Date.now() + 60 * 60 * 1000);
    const newExpiresAt = new Date(Math.min(currentExpiry.getTime() + minutes * 60 * 1000, maxExpiry.getTime()));

    const updated = await prisma.activeSession.update({
      where: { id: sessionId },
      data: { expiresAt: newExpiresAt }
    });

    return res.status(200).json({
      message: `Session extended by ${minutes} minutes.`,
      expiresAt: updated.expiresAt
    });
  } catch (error: any) {
    console.error('[labController] extendLabSession Error:', error);
    return res.status(500).json({ error: 'Failed to extend lab session.' });
  }
};

export const stopLab = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to stop this session.' });
    }

    if (session.status === 'STOPPED') {
      return res.status(400).json({ error: 'Session is already stopped' });
    }

    await prisma.activeSession.update({
      where: { id: sessionId },
      data: { status: 'STOPPING' }
    });

    try {
      await k8sApi.deleteNamespace({
        name: session.k8sNamespace
      });
    } catch (k8sError: any) {
      if (k8sError.code !== 404) {
        console.warn('[labController] Warning deleting namespace:', k8sError.message);
      }
    }

    await prisma.activeSession.update({
      where: { id: sessionId },
      data: { 
        status: 'STOPPED',
        stoppedAt: new Date()
      }
    });

    return res.status(200).json({ message: 'Lab teardown completed successfully' });
  } catch (error: any) {
    console.error('[labController] stopLab Error:', error);
    return res.status(500).json({ error: 'Failed to stop lab.' });
  }
};

export const getLabStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await prisma.activeSession.findUnique({
      where: { id },
      include: { lab: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    // Check if session has expired
    if (session.expiresAt && session.expiresAt < new Date() && session.status === 'RUNNING') {
      await reapExpiredSessions();
      return res.status(200).json({ id, status: 'STOPPED', message: 'Session expired by TTL policy.' });
    }

    if (session.status === 'STOPPED' || session.status === 'ERROR') {
      return res.status(200).json({ id, status: session.status });
    }

    // Query Kubernetes for live pod status
    try {
      const podsRes = await k8sApi.listNamespacedPod({ namespace: session.k8sNamespace });
      if (podsRes.items.length > 0) {
        const pod = podsRes.items[0];
        const phase = pod.status?.phase;
        const isReady = pod.status?.containerStatuses?.some(
          (c) => c.name === 'lab-container' && c.ready
        ) || false;

        // Perform TCP probe if nodePort is available
        let portAccepting = true;
        if (session.traefikUrl) {
          try {
            const urlObj = new URL(session.traefikUrl);
            const portNum = parseInt(urlObj.port);
            if (!isNaN(portNum)) {
              portAccepting = await checkPortOpen(getHostIp(), portNum, 1200);
            }
          } catch {}
        }

        // If pod is running, ready, and port accepting, transition to RUNNING
        if (phase === 'Running' && isReady && portAccepting && session.status !== 'RUNNING') {
          await prisma.activeSession.update({
            where: { id },
            data: { 
              status: 'RUNNING',
              k8sPodName: pod.metadata?.name
            }
          });
          session.status = 'RUNNING';
        }

        return res.status(200).json({ 
          id, 
          status: session.status,
          podPhase: phase,
          ready: isReady && portAccepting,
          podName: pod.metadata?.name,
          url: session.traefikUrl,
          expiresAt: session.expiresAt,
          startedAt: session.startedAt
        });
      }
    } catch (k8sErr: any) {
      console.warn('[labController] Pod status query warning:', k8sErr.message);
    }

    return res.status(200).json({ 
      id, 
      status: session.status,
      expiresAt: session.expiresAt,
      startedAt: session.startedAt 
    });
  } catch (error) {
    console.error('[labController] getLabStatus Error:', error);
    return res.status(500).json({ error: 'Failed to get lab status' });
  }
};

export const getLabs = async (req: Request, res: Response) => {
  try {
    const labs = await prisma.labDefinition.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        difficulty: true,
        protocol: true,
        exposedPort: true,
        cpuLimit: true,
        memLimit: true,
        mitreTactic: true,
        mitreTechnique: true,
        createdAt: true,
      }
    });
    return res.status(200).json({ labs });
  } catch (error: any) {
    console.error('[labController] getLabs Error:', error);
    return res.status(500).json({ error: 'Failed to fetch labs' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    let targetUserId = req.user?.id;

    if (req.user?.role === 'ADMIN' && typeof req.query.userId === 'string') {
      targetUserId = req.query.userId;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const sessions = await prisma.activeSession.findMany({
      where: { 
        userId: targetUserId,
        status: { notIn: ['STOPPED'] }
      },
      include: {
        lab: true
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    return res.status(200).json({ sessions });
  } catch (error: any) {
    console.error('[labController] getSessions Error:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * POST /api/labs/sessions/:id/clipboard
 * Injects clipboard text directly into Kali Linux pod X11 clipboard & primary selection
 */
export const setLabClipboard = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const { text } = req.body;

    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" must be a string' });
    }

    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || !session.k8sNamespace) {
      return res.status(404).json({ error: 'Session or namespace not found' });
    }

    const namespace = session.k8sNamespace;
    const podRes = await k8sApi.listNamespacedPod({ namespace });
    const targetMachine = (req.body?.machine as string) || (req.query?.machine as string) || '';
    const pod = podRes.items.find((p) => {
      if (p.status?.phase !== 'Running') return false;
      if (targetMachine) {
        return p.metadata?.labels?.machine === targetMachine || p.metadata?.name?.includes(targetMachine);
      }
      return true;
    }) || podRes.items.find((p) => p.status?.phase === 'Running');

    if (!pod || !pod.metadata?.name) {
      return res.status(503).json({ error: 'No running pod found for this session' });
    }

    const podName = pod.metadata.name;

    // Use spawn to pipe text directly to xsel in the container
    await new Promise<void>((resolve, reject) => {
      const child = spawn('kubectl', [
        'exec',
        '-i',
        '-n',
        namespace,
        podName,
        '--',
        'env',
        'DISPLAY=:0',
        '/usr/bin/xsel',
        '-b',
        '-i'
      ]);

      child.stdin.write(text);
      child.stdin.end();

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`kubectl exec exited with code ${code}`));
      });
      child.on('error', reject);
    });

    // Also update PRIMARY selection for middle-click/terminal paste compatibility
    try {
      const pChild = spawn('kubectl', [
        'exec',
        '-i',
        '-n',
        namespace,
        podName,
        '--',
        'env',
        'DISPLAY=:0',
        '/usr/bin/xsel',
        '-p',
        '-i'
      ]);
      pChild.stdin.write(text);
      pChild.stdin.end();
    } catch (_) {}

    return res.status(200).json({ success: true, length: text.length });
  } catch (error: any) {
    console.error('[labController] setLabClipboard Error:', error);
    return res.status(500).json({ error: 'Failed to synchronize clipboard to container' });
  }
};

/**
 * GET /api/labs/sessions/:id/clipboard
 * Reads the current X11 clipboard selection from Kali Linux container
 */
export const getLabClipboard = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || !session.k8sNamespace) {
      return res.status(404).json({ error: 'Session or namespace not found' });
    }

    const namespace = session.k8sNamespace;
    const podRes = await k8sApi.listNamespacedPod({ namespace });
    const targetMachine = (req.query?.machine as string) || '';
    const pod = podRes.items.find((p) => {
      if (p.status?.phase !== 'Running') return false;
      if (targetMachine) {
        return p.metadata?.labels?.machine === targetMachine || p.metadata?.name?.includes(targetMachine);
      }
      return true;
    }) || podRes.items.find((p) => p.status?.phase === 'Running');

    if (!pod || !pod.metadata?.name) {
      return res.status(503).json({ error: 'Pod not running' });
    }

    const podName = pod.metadata.name;

    const text = await new Promise<string>((resolve) => {
      exec(
        `kubectl exec -n ${namespace} ${podName} -- env DISPLAY=:0 /usr/bin/xsel -b -o`,
        { timeout: 3000 },
        (error, stdout) => {
          if (error) {
            resolve('');
          } else {
            resolve(stdout || '');
          }
        }
      );
    });

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error('[labController] getLabClipboard Error:', error);
    return res.status(500).json({ error: 'Failed to read clipboard from container' });
  }
};
