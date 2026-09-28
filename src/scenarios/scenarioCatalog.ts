export interface ScenarioMachineAccess {
  desktop: boolean;
  terminal: boolean;
}

export interface ScenarioMachine {
  id: string;
  name: string;
  os: 'kali' | 'ubuntu' | 'windows' | 'linux';
  role: 'ATTACKER' | 'TARGET' | 'SERVER';
  roleTitle: string;
  hostname: string;
  image: string;
  exposedPort: number;
  protocol: 'VNC' | 'TERMINAL';
  cpuLimit: string;
  memLimit: string;
  internalPorts: number[];
  description: string;
  access: ScenarioMachineAccess;
}

export interface ScenarioNetworkConfig {
  isolated: boolean;
  internet: boolean;
  internalDomain: string;
  internalSubnetName: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  estimatedMinutes: number;
  mitreTactics: string[];
  mitreTechniques: string[];
  skillsCovered: string[];
  learningObjectives: string[];
  labRequirements: string[];
  network: ScenarioNetworkConfig;
  machines: ScenarioMachine[];
}

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  {
    id: 'controlled-network-attack',
    name: 'Controlled Network Attack',
    tagline: 'Multi-OS Reconnaissance, Lateral Probing & Controlled Target Exploitation',
    description: 'Deploy an isolated dual-node cyber-range scenario featuring an offensive Kali Linux workstation and a vulnerable Ubuntu Linux target. Map internal subnet services, perform comprehensive port audits, analyze target application banners, and safely exploit vulnerabilities in a zero-leakage, egress-blocked Kubernetes sandbox.',
    category: 'Network Exploitation',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 45,
    mitreTactics: ['Reconnaissance (TA0043)', 'Discovery (TA0007)', 'Initial Access (TA0001)', 'Lateral Movement (TA0008)'],
    mitreTechniques: ['T1595 - Active Scanning', 'T1046 - Network Service Discovery', 'T1082 - System Information Discovery', 'T1190 - Exploit Public-Facing Application'],
    skillsCovered: [
      'Isolated Subnet Enumeration',
      'Non-intrusive SYN/TCP Scanning',
      'Target Banner Grabbing',
      'Target Service Analysis',
      'Credential & Key Audit',
      'Dual-Workstation Mission Control'
    ],
    learningObjectives: [
      'Locate and verify the internal IP address of the target Ubuntu Linux machine across the scenario boundary.',
      'Execute service and version scans from Kali Linux to discover running services on the target.',
      'Analyze the exposed HTTP corporate intranet service and inspect configuration endpoints.',
      'Identify the target misconfiguration and extract the embedded cyber-range verification flag.',
      'Verify that all scenario traffic remains strictly within the internal network with zero external internet leakage.'
    ],
    labRequirements: [
      'Basic familiarity with Linux command line and networking concepts.',
      'Understanding of IP addressing, subnets, and TCP ports.',
      'Modern web browser supporting HTML5 canvas and WebSockets.'
    ],
    network: {
      isolated: true,
      internet: false,
      internalDomain: 'cluster.local',
      internalSubnetName: 'scenario-internal-net'
    },
    machines: [
      {
        id: 'kali',
        name: 'Kali Linux',
        os: 'kali',
        role: 'ATTACKER',
        roleTitle: 'Security Testing Workstation',
        hostname: 'kali-attacker',
        image: 'cyber-range-gui:latest',
        exposedPort: 6901,
        protocol: 'VNC',
        cpuLimit: '1000m',
        memLimit: '1536Mi',
        internalPorts: [6901],
        description: 'Offensive security workstation armed with Nmap, Wireshark, Gobuster, SQLMap, Netcat, and tactical wordlists.',
        access: {
          desktop: true,
          terminal: true
        }
      },
      {
        id: 'ubuntu',
        name: 'Ubuntu Linux',
        os: 'ubuntu',
        role: 'TARGET',
        roleTitle: 'Target / Victim Workstation',
        hostname: 'ubuntu-target',
        image: 'cyber-range-ubuntu:latest',
        exposedPort: 6901,
        protocol: 'VNC',
        cpuLimit: '1000m',
        memLimit: '1536Mi',
        internalPorts: [80, 22, 6901],
        description: 'Corporate workstation running an internal accounting portal on port 80, system logs, and security audit flags.',
        access: {
          desktop: true,
          terminal: true
        }
      }
    ]
  },
  {
    id: 'bec-investigation',
    name: 'Business Email Compromise (BEC) & Phishing Triage',
    tagline: 'Header Forensics, Mail Rule Auditing & Active Campaign Neutralization',
    description: 'Investigate an urgent wire-fraud attack targeting executive leadership. Inspect forged headers, isolate external persistence rules, track reconnaissance activity in server logs, and audit active phishing campaigns inside an isolated, egress-restricted sandbox.',
    category: 'EMAIL SECURITY & FORENSICS',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 45,
    mitreTactics: [
      'Initial Access (TA0001)',
      'Persistence (TA0003)',
      'Defense Evasion (TA0005)',
      'Collection (TA0009)'
    ],
    mitreTechniques: [
      'T1566.001 - Spearphishing Attachment',
      'T1566.002 - Spearphishing Link',
      'T1114.003 - Email Forwarding Rule',
      'T1098.002 - Additional Email Delegate Permissions'
    ],
    skillsCovered: [
      'RFC 5322 Header Forensics',
      'SPF/DKIM Softfail & Fail Analysis',
      'IMAP/Webmail Audit Log Correlation',
      'Persistence Rule Neutralization',
      'Mailpit Inspection & Campaign Triage'
    ],
    learningObjectives: [
      'Analyze the raw forensic email headers to identify spoofed domain (@exec-corp-payroll.com) and unauthorized Reply-To destination.',
      'Correlate authentication timestamps in mail_auth.log to pinpoint the attacker origin IP address (198.51.100.44).',
      'Inspect active corporate inbox rules in the web portal to locate the malicious forwarding rule.',
      'Neutralize the persistence vector by permanently deleting the unauthorized rule.',
      'Extract and submit the verified CyberRange incident response completion flag.'
    ],
    labRequirements: [
      'Basic understanding of email infrastructure (SMTP, IMAP, SPF/DKIM).',
      'Familiarity with email header fields (From, To, Reply-To, Received, Authentication-Results).',
      'Modern web browser supporting HTML5 canvas and WebSockets.'
    ],
    network: {
      isolated: true,
      internet: false,
      internalDomain: 'cluster.local',
      internalSubnetName: 'scenario-bec-net'
    },
    machines: [
      {
        id: 'kali',
        name: 'Kali Linux',
        os: 'kali',
        role: 'ATTACKER',
        roleTitle: 'Incident Response Workstation',
        hostname: 'analyst-workstation',
        image: 'lab-bec-investigation:latest',
        exposedPort: 6901,
        protocol: 'VNC',
        cpuLimit: '1000m',
        memLimit: '1536Mi',
        internalPorts: [6901, 8025, 8080],
        description: 'Dedicated incident response workstation with pre-loaded case files, Mailpit webmail, and executive portal auditor.',
        access: {
          desktop: true,
          terminal: true
        }
      },
      {
        id: 'mailpit',
        name: 'Corporate Mail Server',
        os: 'linux',
        role: 'SERVER',
        roleTitle: 'Mailpit Mock SMTP & Webmail',
        hostname: 'mail-server',
        image: 'lab-bec-investigation:latest',
        exposedPort: 8025,
        protocol: 'VNC',
        cpuLimit: '500m',
        memLimit: '512Mi',
        internalPorts: [8025, 1025],
        description: 'Corporate mail service capturing inbound and outbound messages with full header inspection.',
        access: {
          desktop: false,
          terminal: false
        }
      },
      {
        id: 'gophish',
        name: 'Phishing Engine',
        os: 'linux',
        role: 'SERVER',
        roleTitle: 'Apex Intranet & Phishing Engine',
        hostname: 'phish-engine',
        image: 'lab-bec-investigation:latest',
        exposedPort: 8080,
        protocol: 'VNC',
        cpuLimit: '500m',
        memLimit: '512Mi',
        internalPorts: [8080],
        description: 'Corporate executive intranet, inbox rule management console, and verification engine.',
        access: {
          desktop: false,
          terminal: false
        }
      }
    ]
  }
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIO_CATALOG.find((s) => s.id === id);
}
