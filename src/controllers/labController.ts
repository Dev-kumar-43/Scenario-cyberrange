import { Request, Response } from 'express';
import prisma from '../services/dbService.js';
import { k8sApi, appsApi, customObjectsApi } from '../k8s-client/k8sClient.js';

export const startLab = async (req: Request, res: Response) => {
  try {
    const { userId, labId } = req.body;

    if (!userId || !labId) {
      return res.status(400).json({ error: 'userId and labId are required' });
    }

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

    // 3. Create or update session in DB
    const session = await prisma.activeSession.upsert({
      where: { userId_labId: { userId, labId } },
      update: { status: 'PENDING' },
      create: {
        userId,
        labId,
        k8sNamespace: '', // Will update momentarily
        status: 'PENDING'
      }
    });

    const namespaceName = `lab-${session.id}`;
    const traefikUrl = `http://${namespaceName}.local`; // Or ws:// depending on protocol

    // Update DB with namespace and URL
    await prisma.activeSession.update({
      where: { id: session.id },
      data: { k8sNamespace: namespaceName, traefikUrl }
    });

    // 4. Generate and Apply K8s Manifests
    // 4a. Create Namespace
    try {
      await k8sApi.createNamespace({
        body: { metadata: { name: namespaceName } }
      });
    } catch (nsError: any) {
      // Ignore if it already exists (409 Conflict)
      if (nsError.code !== 409) throw nsError;
    }

    // 4b. Create Deployment
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
            containers: [{
              name: 'lab-container',
              image: lab.dockerImage,
              ports: [{ containerPort: lab.exposedPort }],
              resources: {
                limits: { cpu: lab.cpuLimit, memory: lab.memLimit },
                requests: { cpu: '100m', memory: '128Mi' }
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

    // 4c. Create Service
    const serviceManifest = {
      metadata: {
        name: 'lab-service',
        namespace: namespaceName
      },
      spec: {
        selector: { app: 'vulnerable-lab' },
        ports: [{ port: lab.exposedPort, targetPort: lab.exposedPort }],
        type: 'ClusterIP'
      }
    };
    await k8sApi.createNamespacedService({
      namespace: namespaceName, 
      body: serviceManifest as any
    });

    // 4d. Create Traefik IngressRoute (Custom Resource)
    const ingressRouteManifest = {
      apiVersion: 'traefik.containo.us/v1alpha1',
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
        group: 'traefik.containo.us',
        version: 'v1alpha1',
        namespace: namespaceName,
        plural: 'ingressroutes',
        body: ingressRouteManifest
      });
    } catch (ingressError: any) {
      console.warn('[labController] Warning: Could not create Traefik IngressRoute (Traefik may not be installed):', ingressError.message);
    }

    // 5. Update DB Status
    await prisma.activeSession.update({
      where: { id: session.id },
      data: { status: 'CREATING' }
    });

    res.status(202).json({ 
      message: 'Lab startup initiated successfully',
      sessionId: session.id,
      namespace: namespaceName,
      url: traefikUrl
    });

  } catch (error: any) {
    console.error('[labController] startLab Error:', error);
    res.status(500).json({ error: 'Failed to start lab', details: error.message });
  }
};

export const stopLab = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // 1. Verify the session exists
    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'STOPPED') {
      return res.status(400).json({ error: 'Session is already stopped' });
    }

    // 2. Mark as STOPPING in DB
    await prisma.activeSession.update({
      where: { id: sessionId },
      data: { status: 'STOPPING' }
    });

    // 3. Delete the Kubernetes Namespace
    // Deleting the namespace automatically deletes the Deployment, Service, and IngressRoute inside it!
    try {
      await k8sApi.deleteNamespace({
        name: session.k8sNamespace
      });
    } catch (k8sError: any) {
      // Ignore 404 if namespace is already deleted
      if (k8sError.code !== 404) {
        throw k8sError;
      }
    }

    // 4. Mark as STOPPED in DB
    await prisma.activeSession.update({
      where: { id: sessionId },
      data: { 
        status: 'STOPPED',
        stoppedAt: new Date()
      }
    });

    res.status(200).json({ message: 'Lab teardown completed successfully' });
  } catch (error: any) {
    console.error('[labController] stopLab Error:', error);
    res.status(500).json({ error: 'Failed to stop lab', details: error.message });
  }
};

export const getLabStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Query DB/K8s for lab status
    res.status(200).json({ id, status: 'Unknown' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get lab status' });
  }
};

export const getLabs = async (req: Request, res: Response) => {
  try {
    const labs = await prisma.labDefinition.findMany();
    res.status(200).json({ labs });
  } catch (error: any) {
    console.error('[labController] getLabs Error:', error);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    // Note: Mocking user auth extraction, in reality would use req.user.id
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const sessions = await prisma.activeSession.findMany({
      where: { 
        userId: userId as string,
        status: { notIn: ['STOPPED'] }
      },
      include: {
        lab: true
      }
    });

    res.status(200).json({ sessions });
  } catch (error: any) {
    console.error('[labController] getSessions Error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};
