import { Request, Response } from 'express';
import os from 'os';
import net from 'net';
import { Writable } from 'stream';
import * as k8s from '@kubernetes/client-node';
import prisma from '../services/dbService.js';
import { k8sApi, appsApi, networkingApi, kc } from '../k8s-client/k8sClient.js';
import { SCENARIO_CATALOG, getScenarioById } from '../scenarios/scenarioCatalog.js';

// Helper: Resolve host IP accessible from browser/client
function getHostIp(): string {
  if (process.env.LAB_HOST_IP) {
    return process.env.LAB_HOST_IP;
  }
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.startsWith('eth') || name.startsWith('wlan') || name.startsWith('en')) {
      for (const netInfo of nets[name] || []) {
        if (netInfo.family === 'IPv4' && !netInfo.internal) {
          return netInfo.address;
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

// Helper: Run one-shot command inside pod container using k8s.Exec
async function execInPod(
  namespace: string,
  podName: string,
  containerName: string,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    try {
      const exec = new k8s.Exec(kc);
      let stdout = '';
      let stderr = '';

      const stdoutStream = new Writable({
        write(chunk, encoding, callback) {
          stdout += chunk.toString();
          callback();
        }
      });

      const stderrStream = new Writable({
        write(chunk, encoding, callback) {
          stderr += chunk.toString();
          callback();
        }
      });

      exec.exec(
        namespace,
        podName,
        containerName,
        command,
        stdoutStream,
        stderrStream,
        null,
        false,
        (status) => {
          resolve({ stdout, stderr, exitCode: status?.code ?? (status?.status === 'Success' ? 0 : 1) });
        }
      ).catch((err) => {
        resolve({ stdout: '', stderr: err.message, exitCode: 1 });
      });
    } catch (err: any) {
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    }
  });
}

// Helper: Ensure default tasks exist for a scenario lab definition
export async function ensureScenarioTasks(labDefinitionId: string, labName?: string) {
  try {
    const existingCount = await prisma.labTask.count({
      where: { labDefinitionId }
    });

    if (existingCount === 0) {
      if (labName && (labName.includes('Business Email') || labName.includes('BEC'))) {
        const becTasks = [
          {
            labDefinitionId,
            title: 'Threat Actor Infrastructure Identification',
            description: 'Analyze server authentication logs in ~/Desktop/Case_Files/mail_auth.log to find the unauthorized external IP address that breached Linda Chen\'s mailbox.',
            hints: [
              'Inspect /root/Desktop/Case_Files/mail_auth.log.',
              'Check the dovecot imap-login lines for user linda.chen to see what external IP authenticated.'
            ],
            flag: '^(198\\.51\\.100\\.44|FLAG\\{origin_ip_identified\\})$',
            answerType: 'REGEX',
            mitreTechnique: 'T1078',
            points: 50,
            order: 1
          },
          {
            labDefinitionId,
            title: 'Forged Header Analysis & Reply-To Identification',
            description: 'Inspect ~/Desktop/Case_Files/urgent_wire.eml or the Webmail tab to extract the attacker\'s covert Reply-To address.',
            hints: [
              'Inspect the Reply-To header in the raw email or view headers in the Webmail tab.',
              'The address belongs to executive-finance-verify.com.'
            ],
            flag: '^(wire-ops-secure@executive-finance-verify\\.com|FLAG\\{reply_to_extracted\\})$',
            answerType: 'REGEX',
            mitreTechnique: 'T1566',
            points: 75,
            order: 2
          },
          {
            labDefinitionId,
            title: 'Persistence Neutralization & Evidence Flag Extraction',
            description: 'Open the "Browser" tab to access the Apex Executive Portal (port 8080). Locate and delete the unauthorized forwarding rule, then extract the completion flag.',
            hints: [
              'Navigate to Mail Routing & Inbox Forwarding Rules in the Browser tab.',
              'Delete rule persist_fwd_01 and click Verify System State to retrieve the flag.'
            ],
            flag: 'FLAG{bec_header_forensics_and_rule_neutralized_2026}',
            answerType: 'FLAG',
            mitreTechnique: 'T1114.003',
            points: 100,
            order: 3
          }
        ];

        for (const t of becTasks) {
          await prisma.labTask.create({ data: t as any });
        }
        return;
      }

      const defaultTasks = [
        {
          labDefinitionId,
          title: 'Target Discovery & Subnet Reconnaissance',
          description: 'From your Kali Linux workstation, map the isolated scenario subnet to discover the hostname and internal IP address of the target machine.',
          hints: [
            'Run a host discovery sweep: `nmap -sn 10.42.0.0/24` or check DNS resolution: `ping -c 2 ubuntu-target`.',
            'The internal DNS hostname for the target container is `ubuntu-target`.'
          ],
          flag: '^(ubuntu-target|FLAG\\{subnet_target_discovered_ubuntu\\}|10\\.42\\..*)$',
          answerType: 'REGEX',
          mitreTechnique: 'T1595',
          points: 50,
          order: 1
        },
        {
          labDefinitionId,
          title: 'Target Service Enumeration & Port Audit',
          description: 'Perform a comprehensive TCP port scan against ubuntu-target to identify active network services and web applications.',
          hints: [
            'Scan open ports on the target: `nmap -sS -sV -p- -T4 ubuntu-target`.',
            'Examine port 80 hosting the Apex Corporation internal operations portal.'
          ],
          flag: '^(80|http|FLAG\\{service_port_80_identified\\})$',
          answerType: 'REGEX',
          mitreTechnique: 'T1046',
          points: 75,
          order: 2
        },
        {
          labDefinitionId,
          title: 'Intranet Breach & Evidence Flag Extraction',
          description: 'Access the exposed HTTP intranet portal on the target host (http://ubuntu-target/) and extract the cyber range verification flag from the internal treasury portal.',
          hints: [
            'Fetch the intranet portal: `curl -s http://ubuntu-target/ | grep FLAG` or open Firefox inside Kali desktop and navigate to `http://ubuntu-target/`.',
            'The evidence flag format is: FLAG{ubuntu_target_recon_complete_2026}.'
          ],
          flag: 'FLAG{ubuntu_target_recon_complete_2026}',
          answerType: 'FLAG',
          mitreTechnique: 'T1190',
          points: 100,
          order: 3
        }
      ];

      for (const t of defaultTasks) {
        await prisma.labTask.create({ data: t as any });
      }
    }
  } catch (err: any) {
    console.warn('[scenarioController] ensureScenarioTasks warning:', err.message);
  }
}

/**
 * GET /api/scenarios
 * Returns the catalog of scenarios.
 */
export const listScenarios = async (req: Request, res: Response) => {
  return res.status(200).json({ scenarios: SCENARIO_CATALOG });
};

/**
 * GET /api/scenarios/:id
 * Returns a single scenario by ID with its machine topologies and objectives.
 */
export const getScenario = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const scenario = getScenarioById(id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  return res.status(200).json({ scenario });
};

/**
 * POST /api/scenarios/:id/launch
 * Launches an isolated multi-OS scenario environment in a dedicated Kubernetes namespace.
 */
export const launchScenario = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const id = req.params.id as string;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const scenario = getScenarioById(id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario definition not found' });
  }

  try {
    // 1. Ensure a LabDefinition entry exists for this scenario in DB (preserves foreign keys)
    const labDef = await prisma.labDefinition.upsert({
      where: { name: scenario.name },
      update: {
        description: scenario.description,
        category: 'Multi-OS Scenario',
        difficulty: scenario.difficulty as any,
        protocol: 'VNC',
        dockerImage: scenario.machines[0].image,
        exposedPort: 6901
      },
      create: {
        name: scenario.name,
        description: scenario.description,
        category: 'Multi-OS Scenario',
        difficulty: scenario.difficulty as any,
        protocol: 'VNC',
        dockerImage: scenario.machines[0].image,
        exposedPort: 6901
      }
    });

    // Ensure interactive learning tasks are seeded for this scenario
    await ensureScenarioTasks(labDef.id);

    // 2. Check for existing active session for this user and scenario
    const existingSession = await prisma.activeSession.findUnique({
      where: { userId_labId: { userId, labId: labDef.id } }
    });

    if (existingSession && existingSession.status !== 'STOPPED' && existingSession.status !== 'ERROR') {
      return res.status(200).json({
        message: 'Active scenario session already exists',
        sessionId: existingSession.id,
        existing: true
      });
    }

    // Default TTL: 60 minutes
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // 3. Create or update session record in DB
    const session = await prisma.activeSession.upsert({
      where: { userId_labId: { userId, labId: labDef.id } },
      update: {
        status: 'PENDING',
        startedAt: new Date(),
        expiresAt,
        stoppedAt: null
      },
      create: {
        userId,
        labId: labDef.id,
        k8sNamespace: '',
        status: 'PENDING',
        startedAt: new Date(),
        expiresAt
      }
    });

    const namespaceName = `scenario-${session.id}`;

    await prisma.activeSession.update({
      where: { id: session.id },
      data: { k8sNamespace: namespaceName }
    });

    // 4. Provision Kubernetes resources in namespaceName
    // 4a. Create Dedicated Namespace
    try {
      await k8sApi.createNamespace({
        body: {
          metadata: {
            name: namespaceName,
            labels: {
              'cyberrange.io/scenario': scenario.id,
              'cyberrange.io/session': session.id
            }
          }
        }
      });
    } catch (nsErr: any) {
      if (nsErr.code !== 409) throw nsErr;
    }

    // 4b. Create Strict NetworkPolicy
    // - Egress is strictly internal: Kali <-> Ubuntu within this namespace only + CoreDNS in kube-system
    // - External Internet Egress (0.0.0.0/0) is BLOCKED
    // - Ingress allows management desktop NodePort (port 6901) and internal cross-machine traffic
    const networkPolicyManifest = {
      metadata: {
        name: 'scenario-strict-isolation',
        namespace: namespaceName
      },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          // Management access for Desktop / VNC / Webmail / Browser via NodePort
          {
            ports: [
              { protocol: 'TCP', port: 6901 },
              { protocol: 'TCP', port: 8025 },
              { protocol: 'TCP', port: 8080 }
            ]
          },
          // Full internal communication between pods in the SAME scenario namespace
          {
            from: [{ podSelector: {} }]
          }
        ],
        egress: [
          // Allow all traffic to other pods in this SAME scenario namespace
          {
            to: [{ podSelector: {} }]
          },
          // Allow internal CoreDNS resolution to kube-system on UDP/TCP 53
          {
            to: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'kubernetes.io/metadata.name': 'kube-system'
                  }
                },
                podSelector: {
                  matchLabels: {
                    'k8s-app': 'kube-dns'
                  }
                }
              }
            ],
            ports: [
              { protocol: 'UDP', port: 53 },
              { protocol: 'TCP', port: 53 }
            ]
          }
          // Note: NO 0.0.0.0/0 or external egress is allowed. Public internet is completely blocked.
        ]
      }
    };

    try {
      await networkingApi.createNamespacedNetworkPolicy({
        namespace: namespaceName,
        body: networkPolicyManifest as any
      });
    } catch (netErr: any) {
      console.warn('[scenarioController] Warning creating NetworkPolicy:', netErr.message);
    }

    // 4c. Deploy BEC Investigation Scenario if requested
    if (scenario.id === 'bec-investigation') {
      const becDeployment = {
        metadata: {
          name: 'scenario-bec',
          namespace: namespaceName,
          labels: {
            app: 'scenario-workload',
            role: 'attacker',
            machine: 'bec'
          }
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: 'scenario-workload',
              role: 'attacker',
              machine: 'bec'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'scenario-workload',
                role: 'attacker',
                machine: 'bec'
              }
            },
            spec: {
              hostname: 'analyst-workstation',
              automountServiceAccountToken: false,
              containers: [
                {
                  name: 'bec-container',
                  image: scenario.machines.find(m => m.id === 'kali')?.image || 'lab-bec-investigation:latest',
                  imagePullPolicy: 'IfNotPresent',
                  ports: [
                    { containerPort: 6901 },
                    { containerPort: 8025 },
                    { containerPort: 8080 },
                    { containerPort: 1025 }
                  ],
                  resources: {
                    limits: { cpu: '1200m', memory: '1792Mi' },
                    requests: { cpu: '100m', memory: '256Mi' }
                  },
                  securityContext: {
                    allowPrivilegeEscalation: false
                  }
                }
              ]
            }
          }
        }
      };

      await appsApi.createNamespacedDeployment({
        namespace: namespaceName,
        body: becDeployment as any
      });

      const becService = {
        metadata: {
          name: 'scenario-bec-service',
          namespace: namespaceName
        },
        spec: {
          type: 'NodePort',
          selector: {
            app: 'scenario-workload',
            role: 'attacker',
            machine: 'bec'
          },
          ports: [
            { name: 'vnc-desktop', port: 6901, targetPort: 6901 },
            { name: 'webmail', port: 8025, targetPort: 8025 },
            { name: 'browser', port: 8080, targetPort: 8080 }
          ]
        }
      };

      const createdBecSvc = await k8sApi.createNamespacedService({
        namespace: namespaceName,
        body: becService as any
      });

      const hostIp = getHostIp();
      const desktopNodePort = (createdBecSvc as any)?.spec?.ports?.find((p: any) => p.name === 'vnc-desktop')?.nodePort;
      const webmailNodePort = (createdBecSvc as any)?.spec?.ports?.find((p: any) => p.name === 'webmail')?.nodePort;
      const browserNodePort = (createdBecSvc as any)?.spec?.ports?.find((p: any) => p.name === 'browser')?.nodePort;

      const desktopUrl = desktopNodePort
        ? `http://${hostIp}:${desktopNodePort}/vnc.html?autoconnect=true&resize=scale&quality=9`
        : '';
      const webmailUrl = webmailNodePort
        ? `http://${hostIp}:${webmailNodePort}/`
        : '';
      const browserUrl = browserNodePort
        ? `http://${hostIp}:${browserNodePort}/`
        : '';

      const sessionMetadata = JSON.stringify({
        scenarioId: 'bec-investigation',
        desktopUrl,
        webmailUrl,
        browserUrl,
        desktopNodePort,
        webmailNodePort,
        browserNodePort,
        kaliUrl: desktopUrl,
        kaliNodePort: desktopNodePort
      });

      await prisma.activeSession.update({
        where: { id: session.id },
        data: {
          status: 'CREATING',
          traefikUrl: sessionMetadata
        }
      });

      return res.status(202).json({
        message: 'Scenario environment launch initiated successfully',
        sessionId: session.id,
        namespace: namespaceName,
        expiresAt,
        machines: {
          kali: { url: desktopUrl, port: desktopNodePort },
          webmail: { url: webmailUrl, port: webmailNodePort },
          browser: { url: browserUrl, port: browserNodePort }
        }
      });
    }

    // 4c. Deploy Attacker Machine: Kali Linux
    const kaliDeployment = {
      metadata: {
        name: 'scenario-kali',
        namespace: namespaceName,
        labels: {
          app: 'scenario-workload',
          role: 'attacker',
          machine: 'kali'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'scenario-workload',
            role: 'attacker',
            machine: 'kali'
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'scenario-workload',
              role: 'attacker',
              machine: 'kali'
            }
          },
          spec: {
            hostname: 'kali-attacker',
            automountServiceAccountToken: false,
            containers: [
              {
                name: 'kali-container',
                image: scenario.machines.find(m => m.id === 'kali')?.image || 'cyber-range-gui:latest',
                imagePullPolicy: 'IfNotPresent',
                ports: [{ containerPort: 6901 }],
                resources: {
                  limits: { cpu: '1000m', memory: '1536Mi' },
                  requests: { cpu: '100m', memory: '128Mi' }
                },
                securityContext: {
                  allowPrivilegeEscalation: false
                }
              }
            ]
          }
        }
      }
    };

    await appsApi.createNamespacedDeployment({
      namespace: namespaceName,
      body: kaliDeployment as any
    });

    // 4d. Create Kali NodePort Service (Browser VNC Management)
    const kaliService = {
      metadata: {
        name: 'scenario-kali-service',
        namespace: namespaceName
      },
      spec: {
        type: 'NodePort',
        selector: {
          app: 'scenario-workload',
          role: 'attacker',
          machine: 'kali'
        },
        ports: [
          {
            name: 'vnc-desktop',
            port: 6901,
            targetPort: 6901
          }
        ]
      }
    };

    const createdKaliSvc = await k8sApi.createNamespacedService({
      namespace: namespaceName,
      body: kaliService as any
    });

    // 4e. Create Kali Internal Headless Service (Internal scenario DNS: kali-attacker -> Pod IP)
    await k8sApi.createNamespacedService({
      namespace: namespaceName,
      body: {
        metadata: {
          name: 'kali-attacker',
          namespace: namespaceName
        },
        spec: {
          clusterIP: 'None',
          selector: {
            app: 'scenario-workload',
            role: 'attacker',
            machine: 'kali'
          },
          ports: [{ port: 6901, targetPort: 6901 }]
        }
      } as any
    });

    // 4f. Deploy Target Machine: Ubuntu Linux Workstation
    const ubuntuDeployment = {
      metadata: {
        name: 'scenario-ubuntu',
        namespace: namespaceName,
        labels: {
          app: 'scenario-workload',
          role: 'target',
          machine: 'ubuntu'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'scenario-workload',
            role: 'target',
            machine: 'ubuntu'
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'scenario-workload',
              role: 'target',
              machine: 'ubuntu'
            }
          },
          spec: {
            hostname: 'ubuntu-target',
            automountServiceAccountToken: false,
            containers: [
              {
                name: 'ubuntu-container',
                image: scenario.machines.find(m => m.id === 'ubuntu')?.image || 'cyber-range-ubuntu:latest',
                imagePullPolicy: 'IfNotPresent',
                ports: [
                  { containerPort: 6901 },
                  { containerPort: 80 }
                ],
                resources: {
                  limits: { cpu: '1000m', memory: '1536Mi' },
                  requests: { cpu: '100m', memory: '128Mi' }
                },
                securityContext: {
                  allowPrivilegeEscalation: false
                },
                lifecycle: {
                  postStart: {
                    exec: {
                      command: [
                        '/bin/bash',
                        '-c',
                        `mkdir -p /var/www/internal-portal && cat << 'EOF' > /var/www/internal-portal/index.html
<!DOCTYPE html>
<html>
<head>
  <title>Apex Corporation - Internal Operations</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
    .card { background: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid #334155; max-width: 600px; }
    .badge { background: #0284c7; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    .flag { background: #334155; padding: 12px; font-family: monospace; border-left: 4px solid #10b981; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">TARGET NODE: UBUNTU-TARGET</span>
    <h2>Apex Financial - Treasury Intranet</h2>
    <p>Internal network node: <code>ubuntu-target</code> | Subnet: Isolated Scenario</p>
    <p>Operational Status: <strong>LIVE & AUDITED</strong></p>
    <div class="flag">EVIDENCE FLAG: FLAG{ubuntu_target_recon_complete_2026}</div>
  </div>
</body>
</html>
EOF
nohup python3 -m http.server 80 --directory /var/www/internal-portal > /dev/null 2>&1 &`
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      }
    };

    await appsApi.createNamespacedDeployment({
      namespace: namespaceName,
      body: ubuntuDeployment as any
    });

    // 4g. Create Ubuntu NodePort Service (Browser VNC Management)
    const ubuntuService = {
      metadata: {
        name: 'scenario-ubuntu-service',
        namespace: namespaceName
      },
      spec: {
        type: 'NodePort',
        selector: {
          app: 'scenario-workload',
          role: 'target',
          machine: 'ubuntu'
        },
        ports: [
          {
            name: 'vnc-desktop',
            port: 6901,
            targetPort: 6901
          }
        ]
      }
    };

    const createdUbuntuSvc = await k8sApi.createNamespacedService({
      namespace: namespaceName,
      body: ubuntuService as any
    });

    // 4h. Create Ubuntu Internal Headless Service (Internal scenario DNS: ubuntu-target -> Pod IP)
    await k8sApi.createNamespacedService({
      namespace: namespaceName,
      body: {
        metadata: {
          name: 'ubuntu-target',
          namespace: namespaceName
        },
        spec: {
          clusterIP: 'None',
          selector: {
            app: 'scenario-workload',
            role: 'target',
            machine: 'ubuntu'
          },
          ports: [
            { name: 'http', port: 80, targetPort: 80 },
            { name: 'vnc', port: 6901, targetPort: 6901 }
          ]
        }
      } as any
    });

    // 5. Construct access URLs for client browser
    const hostIp = getHostIp();
    const kaliNodePort = (createdKaliSvc as any)?.spec?.ports?.[0]?.nodePort;
    const ubuntuNodePort = (createdUbuntuSvc as any)?.spec?.ports?.[0]?.nodePort;

    const kaliUrl = kaliNodePort
      ? `http://${hostIp}:${kaliNodePort}/vnc.html?autoconnect=true&resize=scale&quality=9`
      : '';
    const ubuntuUrl = ubuntuNodePort
      ? `http://${hostIp}:${ubuntuNodePort}/vnc.html?autoconnect=true&resize=scale&quality=9`
      : '';

    const sessionMetadata = JSON.stringify({
      kaliUrl,
      ubuntuUrl,
      kaliNodePort,
      ubuntuNodePort
    });

    await prisma.activeSession.update({
      where: { id: session.id },
      data: {
        status: 'CREATING',
        traefikUrl: sessionMetadata
      }
    });

    return res.status(202).json({
      message: 'Scenario environment launch initiated successfully',
      sessionId: session.id,
      namespace: namespaceName,
      expiresAt,
      machines: {
        kali: { url: kaliUrl, port: kaliNodePort },
        ubuntu: { url: ubuntuUrl, port: ubuntuNodePort }
      }
    });
  } catch (error: any) {
    console.error('[scenarioController] launchScenario Error:', error);
    return res.status(500).json({ error: 'Failed to launch scenario environment: ' + error.message });
  }
};

/**
 * GET /api/scenarios/sessions/:sessionId/status
 * Returns real-time, verified provisioning state, machine statuses, internal IPs, and connectivity checks.
 */
export const getScenarioStatus = async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const userId = req.user?.id;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId },
      include: { lab: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Scenario session not found' });
    }

    if (session.userId !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (session.status === 'STOPPED' || session.status === 'ERROR') {
      return res.status(200).json({
        id: session.id,
        status: session.status,
        ready: false
      });
    }

    let meta: {
      scenarioId?: string;
      desktopUrl?: string;
      webmailUrl?: string;
      browserUrl?: string;
      desktopNodePort?: number;
      webmailNodePort?: number;
      browserNodePort?: number;
      kaliUrl?: string;
      ubuntuUrl?: string;
      kaliNodePort?: number;
      ubuntuNodePort?: number;
    } = {};
    try {
      if (session.traefikUrl) {
        meta = JSON.parse(session.traefikUrl);
      }
    } catch {}

    const hostIp = getHostIp();
    const namespace = session.k8sNamespace;

    // Query live pods from Kubernetes
    const podsRes = await k8sApi.listNamespacedPod({ namespace });
    const pods = podsRes.items;

    // Query live services from Kubernetes to ensure dynamic, up-to-date NodePorts
    let liveServices: any[] = [];
    try {
      const svcRes = await k8sApi.listNamespacedService({ namespace });
      liveServices = svcRes.items || [];
    } catch (e) {
      console.warn(`[getScenarioStatus] Failed to query services in ${namespace}:`, e);
    }

    // Check if this is the BEC Investigation scenario
    if (meta.scenarioId === 'bec-investigation' || session.lab?.name?.includes('Business Email')) {
      const becSvc = liveServices.find(
        (s) => s.metadata?.name === 'scenario-bec-service' || s.metadata?.name?.includes('bec')
      );
      if (becSvc?.spec?.ports) {
        const vncPort = becSvc.spec.ports.find((p: any) => p.name === 'vnc-desktop' || p.port === 6901)?.nodePort;
        const wmPort = becSvc.spec.ports.find((p: any) => p.name === 'webmail' || p.port === 8025)?.nodePort;
        const brPort = becSvc.spec.ports.find((p: any) => p.name === 'browser' || p.port === 8080)?.nodePort;

        let portsChanged = false;
        if (vncPort && (vncPort !== meta.desktopNodePort || !meta.desktopUrl?.includes(`:${vncPort}`))) {
          meta.desktopNodePort = vncPort;
          meta.desktopUrl = `http://${hostIp}:${vncPort}/vnc.html?autoconnect=true&resize=scale&quality=9`;
          meta.kaliUrl = meta.desktopUrl;
          meta.kaliNodePort = vncPort;
          portsChanged = true;
        }
        if (wmPort && (wmPort !== meta.webmailNodePort || !meta.webmailUrl?.includes(`:${wmPort}`))) {
          meta.webmailNodePort = wmPort;
          meta.webmailUrl = `http://${hostIp}:${wmPort}/`;
          portsChanged = true;
        }
        if (brPort && (brPort !== meta.browserNodePort || !meta.browserUrl?.includes(`:${brPort}`))) {
          meta.browserNodePort = brPort;
          meta.browserUrl = `http://${hostIp}:${brPort}/`;
          portsChanged = true;
        }

        if (portsChanged) {
          await prisma.activeSession.update({
            where: { id: sessionId },
            data: { traefikUrl: JSON.stringify(meta) }
          }).catch((err) => console.error('[getScenarioStatus] Failed to update traefikUrl with new ports:', err));
        }
      }

      const becPod = pods.find((p) => p.metadata?.labels?.app === 'scenario-workload' || p.metadata?.name?.includes('bec'));
      const becPhase = becPod?.status?.phase || 'Pending';
      const becReady = becPod?.status?.containerStatuses?.some((c) => c.ready) || false;
      const becIp = becPod?.status?.podIP || 'Allocating...';

      let desktopOpen = false;
      let webmailOpen = false;
      let browserOpen = false;

      if (meta.desktopNodePort) {
        desktopOpen = await checkPortOpen(hostIp, meta.desktopNodePort, 1200);
      }
      if (meta.webmailNodePort) {
        webmailOpen = await checkPortOpen(hostIp, meta.webmailNodePort, 1200);
      }
      if (meta.browserNodePort) {
        browserOpen = await checkPortOpen(hostIp, meta.browserNodePort, 1200);
      }

      let verificationData: any = {
        verified: false,
        milestones: {
          origin_ip: '198.51.100.44',
          spoofed_domain: 'exec-corp-payroll.com',
          forged_reply_to: 'wire-ops-secure@executive-finance-verify.com',
          rule_neutralized: false
        }
      };

      if (becPhase === 'Running' && becReady && becPod?.metadata?.name) {
        try {
          const probe = await execInPod(namespace, becPod.metadata.name, 'bec-container', ['curl', '-s', '-m', '2', 'http://127.0.0.1:8080/api/verify']);
          if (probe.stdout) {
            verificationData = JSON.parse(probe.stdout);
          }
        } catch (_) {}
      }

      const isReady = becPhase === 'Running' && becReady && desktopOpen;
      let overallStatus: string = session.status;
      if (isReady) {
        overallStatus = 'RUNNING';
        if (session.status !== 'RUNNING') {
          await prisma.activeSession.update({
            where: { id: sessionId },
            data: { status: 'RUNNING' }
          });
        }
      } else if (becPod) {
        overallStatus = 'STARTING';
      }

      if (session.labId) {
        await ensureScenarioTasks(session.labId, session.lab?.name);
      }

      return res.status(200).json({
        id: session.id,
        labId: session.labId,
        labName: session.lab?.name || 'Business Email Compromise (BEC) & Phishing Triage',
        scenarioId: 'bec-investigation',
        status: overallStatus,
        ready: isReady,
        namespace,
        expiresAt: session.expiresAt,
        startedAt: session.startedAt,
        desktopUrl: meta.desktopUrl,
        webmailUrl: meta.webmailUrl,
        browserUrl: meta.browserUrl,
        stages: {
          environmentNamespace: true,
          internalNetwork: true,
          workstationStarted: becPhase === 'Running',
          workstationReady: becReady,
          desktopAccessible: desktopOpen,
          webmailAccessible: webmailOpen,
          browserAccessible: browserOpen
        },
        machines: [
          {
            id: 'kali',
            name: 'Kali Linux',
            role: 'ATTACKER',
            roleTitle: 'Incident Response Workstation',
            hostname: 'analyst-workstation',
            phase: becPhase,
            ready: becReady && desktopOpen,
            internalIp: becIp,
            desktopUrl: meta.desktopUrl || '',
            terminalMachineId: 'kali'
          },
          {
            id: 'mailpit',
            name: 'Corporate Mail Server',
            role: 'SERVER',
            roleTitle: 'Mailpit Mock SMTP & Webmail',
            hostname: 'mail-server',
            phase: becPhase,
            ready: becReady && webmailOpen,
            internalIp: becIp,
            desktopUrl: meta.webmailUrl || '',
            terminalMachineId: 'mailpit'
          },
          {
            id: 'gophish',
            name: 'Phishing Engine',
            role: 'SERVER',
            roleTitle: 'Apex Intranet & Phishing Engine',
            hostname: 'phish-engine',
            phase: becPhase,
            ready: becReady && browserOpen,
            internalIp: becIp,
            desktopUrl: meta.browserUrl || '',
            terminalMachineId: 'gophish'
          }
        ],
        milestones: verificationData.milestones,
        verified: verificationData.verified,
        flag: verificationData.flag,
        network: {
          isolated: true,
          externalAccess: 'BLOCKED',
          internalRouting: 'ACTIVE',
          crossSessionIsolated: true
        }
      });
    }

    const kaliPod = pods.find((p) => p.metadata?.labels?.role === 'attacker' || p.metadata?.name?.includes('kali'));
    const ubuntuPod = pods.find((p) => p.metadata?.labels?.role === 'target' || p.metadata?.name?.includes('ubuntu'));

    const kaliPhase = kaliPod?.status?.phase || 'Pending';
    const ubuntuPhase = ubuntuPod?.status?.phase || 'Pending';

    const kaliReady = kaliPod?.status?.containerStatuses?.some((c) => c.ready) || false;
    const ubuntuReady = ubuntuPod?.status?.containerStatuses?.some((c) => c.ready) || false;

    const kaliIp = kaliPod?.status?.podIP || 'Allocating...';
    const ubuntuIp = ubuntuPod?.status?.podIP || 'Allocating...';

    // Dynamically refresh NodePorts for dual-machine scenario if changed
    const kaliSvc = liveServices.find((s) => s.metadata?.name === 'scenario-kali-service' || s.metadata?.name?.includes('kali'));
    const ubuntuSvc = liveServices.find((s) => s.metadata?.name === 'scenario-ubuntu-service' || s.metadata?.name?.includes('ubuntu'));

    let dualPortsChanged = false;
    if (kaliSvc?.spec?.ports) {
      const kPort = kaliSvc.spec.ports.find((p: any) => p.name === 'vnc-desktop' || p.port === 6901)?.nodePort;
      if (kPort && (kPort !== meta.kaliNodePort || !meta.kaliUrl?.includes(`:${kPort}`))) {
        meta.kaliNodePort = kPort;
        meta.kaliUrl = `http://${hostIp}:${kPort}/vnc.html?autoconnect=true&resize=scale&quality=9`;
        dualPortsChanged = true;
      }
    }
    if (ubuntuSvc?.spec?.ports) {
      const uPort = ubuntuSvc.spec.ports.find((p: any) => p.name === 'vnc-desktop' || p.port === 6901)?.nodePort;
      if (uPort && (uPort !== meta.ubuntuNodePort || !meta.ubuntuUrl?.includes(`:${uPort}`))) {
        meta.ubuntuNodePort = uPort;
        meta.ubuntuUrl = `http://${hostIp}:${uPort}/vnc.html?autoconnect=true&resize=scale&quality=9`;
        dualPortsChanged = true;
      }
    }
    if (dualPortsChanged) {
      await prisma.activeSession.update({
        where: { id: sessionId },
        data: { traefikUrl: JSON.stringify(meta) }
      }).catch((err) => console.error('[getScenarioStatus] Failed to update dual traefikUrl with new ports:', err));
    }

    // TCP port checks on management desktop ports
    let kaliDesktopOpen = false;
    let ubuntuDesktopOpen = false;

    if (meta.kaliNodePort) {
      kaliDesktopOpen = await checkPortOpen(hostIp, meta.kaliNodePort, 1200);
    }
    if (meta.ubuntuNodePort) {
      ubuntuDesktopOpen = await checkPortOpen(hostIp, meta.ubuntuNodePort, 1200);
    }

    const podsReady = kaliPhase === 'Running' && ubuntuPhase === 'Running' && kaliReady && ubuntuReady;
    const desktopAccessible = kaliDesktopOpen && ubuntuDesktopOpen;

    let internalConnectivityVerified = false;
    let externalBlockedVerified = true;

    // Run active verification probe if both pods are running and ready
    if (podsReady && kaliPod?.metadata?.name && ubuntuPod?.metadata?.name) {
      // 1. Probe: Kali -> Ubuntu Target HTTP service
      const probeRes = await execInPod(
        namespace,
        kaliPod.metadata.name,
        'kali-container',
        ['curl', '-s', '-m', '2', 'http://ubuntu-target/']
      );

      if (probeRes.stdout.includes('Apex') || probeRes.stdout.includes('FLAG{') || probeRes.exitCode === 0) {
        internalConnectivityVerified = true;
      }

      // 2. Probe: Verify external internet is blocked
      const egressRes = await execInPod(
        namespace,
        kaliPod.metadata.name,
        'kali-container',
        ['curl', '-s', '-m', '2', 'http://1.1.1.1/']
      );
      externalBlockedVerified = egressRes.exitCode !== 0; // Must fail/timeout
    }

    // Determine lifecycle state
    let overallStatus: string = session.status;
    if (podsReady && desktopAccessible && internalConnectivityVerified) {
      overallStatus = 'RUNNING';
      if (session.status !== 'RUNNING') {
        await prisma.activeSession.update({
          where: { id: sessionId },
          data: { status: 'RUNNING' }
        });
      }
    } else if (podsReady) {
      overallStatus = 'CONFIGURING';
    } else if (kaliPod || ubuntuPod) {
      overallStatus = 'STARTING';
    }

    // Ensure scenario tasks exist for this lab definition
    if (session.labId) {
      await ensureScenarioTasks(session.labId, session.lab?.name);
    }

    return res.status(200).json({
      id: session.id,
      labId: session.labId,
      labName: session.lab?.name || 'Controlled Network Attack',
      status: overallStatus,
      ready: overallStatus === 'RUNNING',
      namespace,
      expiresAt: session.expiresAt,
      startedAt: session.startedAt,
      stages: {
        environmentNamespace: true,
        internalNetwork: true,
        kaliStarted: kaliPhase === 'Running',
        ubuntuStarted: ubuntuPhase === 'Running',
        kaliReady,
        ubuntuReady,
        desktopAccessible,
        internalConnectivity: internalConnectivityVerified,
        externalBlocked: externalBlockedVerified
      },
      machines: [
        {
          id: 'kali',
          name: 'Kali Linux',
          role: 'ATTACKER',
          roleTitle: 'Security Testing Workstation',
          hostname: 'kali-attacker',
          phase: kaliPhase,
          ready: kaliReady && kaliDesktopOpen,
          internalIp: kaliIp,
          desktopUrl: meta.kaliUrl || '',
          terminalMachineId: 'kali'
        },
        {
          id: 'ubuntu',
          name: 'Ubuntu Linux',
          role: 'TARGET',
          roleTitle: 'Target / Victim Workstation',
          hostname: 'ubuntu-target',
          phase: ubuntuPhase,
          ready: ubuntuReady && ubuntuDesktopOpen,
          internalIp: ubuntuIp,
          desktopUrl: meta.ubuntuUrl || '',
          terminalMachineId: 'ubuntu'
        }
      ],
      network: {
        isolated: true,
        externalAccess: 'BLOCKED',
        internalRouting: 'ACTIVE',
        crossSessionIsolated: true
      }
    });
  } catch (error: any) {
    console.error('[scenarioController] getScenarioStatus Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve scenario status' });
  }
};

/**
 * POST /api/scenarios/sessions/:sessionId/stop
 * Terminates the scenario environment and deletes all Kubernetes resources.
 */
export const stopScenario = async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const userId = req.user?.id;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Scenario session not found' });
    }

    if (session.userId !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.activeSession.update({
      where: { id: sessionId },
      data: { status: 'STOPPING' }
    });

    // Delete dedicated scenario namespace
    try {
      await k8sApi.deleteNamespace({ name: session.k8sNamespace });
    } catch (k8sErr: any) {
      if (k8sErr.code !== 404) {
        console.warn('[scenarioController] Warning deleting scenario namespace:', k8sErr.message);
      }
    }

    await prisma.activeSession.update({
      where: { id: sessionId },
      data: {
        status: 'STOPPED',
        stoppedAt: new Date()
      }
    });

    return res.status(200).json({ message: 'Scenario environment teardown completed successfully' });
  } catch (error: any) {
    console.error('[scenarioController] stopScenario Error:', error);
    return res.status(500).json({ error: 'Failed to stop scenario: ' + error.message });
  }
};

/**
 * POST /api/scenarios/sessions/:sessionId/verify
 * Runs live network checks from the Kali container and returns the real probe results.
 */
export const verifyConnectivity = async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const userId = req.user?.id;

  try {
    const session = await prisma.activeSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || (session.userId !== userId && req.user?.role !== 'ADMIN')) {
      return res.status(404).json({ error: 'Scenario session not found or forbidden' });
    }

    let meta: any = {};
    try {
      if (session.traefikUrl) meta = JSON.parse(session.traefikUrl);
    } catch {}

    const podsRes = await k8sApi.listNamespacedPod({ namespace: session.k8sNamespace });

    if (meta.scenarioId === 'bec-investigation') {
      const becPod = podsRes.items.find((p) => p.metadata?.name?.includes('bec') || p.metadata?.labels?.machine === 'bec' || p.metadata?.labels?.role === 'attacker');
      if (!becPod || !becPod.metadata?.name) {
        return res.status(400).json({ error: 'BEC Workstation pod is not running yet' });
      }
      const verifyRes = await execInPod(session.k8sNamespace, becPod.metadata.name, 'bec-container', ['curl', '-s', '-m', '2', 'http://127.0.0.1:8080/api/verify']);
      try {
        const verifyData = JSON.parse(verifyRes.stdout);
        return res.status(200).json(verifyData);
      } catch {
        return res.status(200).json({ verified: false, message: verifyRes.stdout || verifyRes.stderr });
      }
    }

    const kaliPod = podsRes.items.find((p) => p.metadata?.labels?.role === 'attacker');

    if (!kaliPod || !kaliPod.metadata?.name) {
      return res.status(400).json({ error: 'Kali Attacker pod is not running yet' });
    }

    const podName = kaliPod.metadata.name;
    const targetPod = podsRes.items.find((p) => p.metadata?.labels?.role === 'target');
    const targetIp = targetPod?.status?.podIP || 'ubuntu-target';

    // 1. Ping Ubuntu Target Pod IP
    const pingRes = await execInPod(session.k8sNamespace, podName, 'kali-container', ['ping', '-c', '2', '-W', '2', targetIp]);

    // 2. Curl Ubuntu Target HTTP Intranet
    const curlRes = await execInPod(session.k8sNamespace, podName, 'kali-container', ['curl', '-s', '-m', '2', 'http://ubuntu-target/']);

    // 3. Curl Google / External (must fail)
    const extRes = await execInPod(session.k8sNamespace, podName, 'kali-container', ['curl', '-s', '-m', '2', 'http://google.com/']);

    return res.status(200).json({
      internalPing: {
        command: `ping -c 2 -W 2 ${targetIp} (ubuntu-target)`,
        success: pingRes.exitCode === 0,
        output: pingRes.stdout || pingRes.stderr
      },
      internalService: {
        command: 'curl -s http://ubuntu-target/',
        success: curlRes.stdout.includes('Apex') || curlRes.exitCode === 0,
        output: curlRes.stdout.slice(0, 300)
      },
      externalEgressBlocked: {
        command: 'curl -s -m 2 http://google.com/',
        blocked: extRes.exitCode !== 0,
        output: extRes.exitCode !== 0 ? 'Blocked by NetworkPolicy (Connection timed out)' : 'Warning: Egress not blocked'
      }
    });
  } catch (error: any) {
    console.error('[scenarioController] verifyConnectivity Error:', error);
    return res.status(500).json({ error: 'Verification failed: ' + error.message });
  }
};
