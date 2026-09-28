import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[seed error]: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding futuristic cyber range academy database...');

  // 1. Seed Student User with Operator Progression
  const studentPassword = await bcrypt.hash('Student@1234', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@cyberrange.local' },
    update: {
      xp: 250,
      level: 2,
      rankTitle: 'Script Infiltrator',
      streakDays: 3
    },
    create: {
      username: 'student01',
      email: 'student@cyberrange.local',
      password: studentPassword,
      role: 'STUDENT',
      xp: 250,
      level: 2,
      rankTitle: 'Script Infiltrator',
      streakDays: 3
    },
  });
  console.log(`[seed] Created test student: ${student.email} (Password: Student@1234)`);

  // 2. Seed Instructor User
  const instructorPassword = await bcrypt.hash('Instructor@1234', 10);
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@cyberrange.local' },
    update: {
      xp: 800,
      level: 5,
      rankTitle: 'Cyber Instructor Lead',
      role: 'INSTRUCTOR'
    },
    create: {
      username: 'instructor_morris',
      email: 'instructor@cyberrange.local',
      password: instructorPassword,
      role: 'INSTRUCTOR',
      xp: 800,
      level: 5,
      rankTitle: 'Cyber Instructor Lead',
      streakDays: 7
    }
  });
  console.log(`[seed] Created test instructor: ${instructor.email} (Password: Instructor@1234)`);

  // 3. Seed Admin User
  const adminPassword = await bcrypt.hash('Admin@1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cyberrange.local' },
    update: {
      xp: 1500,
      level: 10,
      rankTitle: 'Elite Cyber Commander',
      streakDays: 14
    },
    create: {
      username: 'admin',
      email: 'admin@cyberrange.local',
      password: adminPassword,
      role: 'ADMIN',
      xp: 1500,
      level: 10,
      rankTitle: 'Elite Cyber Commander',
      streakDays: 14
    },
  });
  console.log(`[seed] Created test admin: ${admin.email} (Password: Admin@1234)`);

  // 4. Create Lab Definitions with MITRE ATT&CK Mapping
  const labs = [
    {
      name: 'SQL Injection Fundamentals',
      description: 'Learn the fundamentals of SQL injection by bypassing authentication, testing input filters, and dumping database hashes.',
      dockerImage: 'vulnerables/web-dvwa:latest',
      exposedPort: 80,
      cpuLimit: '250m',
      memLimit: '256Mi',
      category: 'Web Exploitation',
      difficulty: 'BEGINNER',
      protocol: 'TCP',
      mitreTactic: 'Initial Access',
      mitreTechnique: 'T1190'
    },
    {
      name: 'Remote Code Execution (RCE)',
      description: 'Exploit deserialization and command injection vulnerabilities to escape sandboxes and gain full root shell access.',
      dockerImage: 'bkimminich/juice-shop:latest',
      exposedPort: 3000,
      cpuLimit: '500m',
      memLimit: '512Mi',
      category: 'Web Exploitation',
      difficulty: 'ADVANCED',
      protocol: 'TCP',
      mitreTactic: 'Execution',
      mitreTechnique: 'T1059.004'
    },
    {
      name: 'Kali Linux GUI Workstation',
      description: 'Full-featured graphical Kali Linux workstation equipped with offensive security tools (Nmap, Wireshark, Dirb, Python3, Mousepad) accessible via in-browser desktop.',
      dockerImage: 'cyber-range-gui:latest',
      exposedPort: 6901,
      cpuLimit: '1000m',
      memLimit: '1536Mi',
      category: 'Workstation & Tooling',
      difficulty: 'INTERMEDIATE',
      protocol: 'VNC',
      mitreTactic: 'Reconnaissance',
      mitreTechnique: 'T1595'
    }
  ];

  const createdLabsMap: Record<string, any> = {};

  for (const lab of labs) {
    const createdLab = await prisma.labDefinition.upsert({
      where: { name: lab.name },
      update: {
        description: lab.description,
        dockerImage: lab.dockerImage,
        exposedPort: lab.exposedPort,
        cpuLimit: lab.cpuLimit,
        memLimit: lab.memLimit,
        category: lab.category,
        difficulty: lab.difficulty as any,
        protocol: lab.protocol as any,
        mitreTactic: lab.mitreTactic,
        mitreTechnique: lab.mitreTechnique
      },
      create: {
        name: lab.name,
        description: lab.description,
        dockerImage: lab.dockerImage,
        exposedPort: lab.exposedPort,
        cpuLimit: lab.cpuLimit,
        memLimit: lab.memLimit,
        category: lab.category,
        difficulty: lab.difficulty as any,
        protocol: lab.protocol as any,
        mitreTactic: lab.mitreTactic,
        mitreTechnique: lab.mitreTechnique
      },
    });
    createdLabsMap[lab.name] = createdLab;
    console.log(`[seed] Created lab definition: ${createdLab.name} [${createdLab.mitreTechnique}]`);
  }

  // 5. Seed In-Lab Tasks and Dynamic Flags with Multi-Type Answers
  const tasksByLab: Record<string, any[]> = {
    'SQL Injection Fundamentals': [
      {
        title: 'Bypass Admin Authentication',
        description: 'Analyze the SQL login query in the vulnerable application and submit a tautology payload to authenticate without credentials.',
        hints: [
          'Classic comment characters in SQL include `--` or `#`.',
          "Try crafting an authentication bypass payload such as: admin' --"
        ],
        flag: 'FLAG{sqli_auth_bypass_success}',
        answerType: 'FLAG',
        mitreTechnique: 'T1190',
        points: 50,
        order: 1
      },
      {
        title: 'Extract Database Admin Hash',
        description: 'Perform a UNION-based SQL injection attack to extract the administrator password hash from the users table.',
        hints: [
          'Determine the column count first using ORDER BY 1, 2, 3...',
          'Concatenate user and password columns via UNION SELECT null, user, password FROM users --'
        ],
        flag: '5f4dcc3b5aa765d61d8327deb882cf99',
        answerType: 'HASH',
        mitreTechnique: 'T1078',
        points: 75,
        order: 2
      }
    ],
    'Kali Linux GUI Workstation': [
      {
        title: 'Subnet Discovery & Port Scanning',
        description: 'Open the graphical terminal or XFCE terminal shortcut and scan the internal subnet with Nmap to discover active cluster endpoints.',
        hints: [
          'Run a stealth SYN scan: nmap -sS -sV -p- -T4 <target-ip>',
          'Inspect the scan output for the discovered target port flag.'
        ],
        flag: 'FLAG{kali_nmap_recon_complete}',
        answerType: 'FLAG',
        mitreTechnique: 'T1046',
        points: 50,
        order: 1
      },
      {
        title: 'Network Packet Sniffing with Wireshark',
        description: 'Launch Wireshark on the Kali Linux desktop and capture HTTP traffic passing across eth0 to uncover intercepted credentials.',
        hints: [
          'Launch Wireshark from the desktop shortcut or terminal using `wireshark &`.',
          'Filter HTTP traffic using display filter `http.request.method == "POST"`.'
        ],
        flag: 'FLAG{wireshark_pcap_analyzed}',
        answerType: 'FLAG',
        mitreTechnique: 'T1040',
        points: 75,
        order: 2
      },
      {
        title: 'Privilege Verification & System Recon',
        description: 'Execute system enumeration commands on the Kali machine to verify root shell capabilities, inspect mounted volumes, and extract the operator verification flag.',
        hints: [
          'Check system details: id && uname -a',
          'Read the root verification key in `/root/Desktop` or environment variables.'
        ],
        flag: 'FLAG{kali_desktop_operator_verified}',
        answerType: 'FLAG',
        mitreTechnique: 'T1082',
        points: 100,
        order: 3
      }
    ],
    'Remote Code Execution (RCE)': [
      {
        title: 'Discover Unsanitized Command Injection Endpoint',
        description: 'Map the web service endpoints to locate the backend handler that passes unsanitized user inputs to system execution wrappers.',
        hints: [
          'Look for features that ping, convert files, or check server status.',
          'Inject command separators like `;`, `&&`, or `|`.'
        ],
        flag: 'FLAG{rce_endpoint_discovered}',
        answerType: 'FLAG',
        mitreTechnique: 'T1190',
        points: 50,
        order: 1
      },
      {
        title: 'Obtain Interactive Root Shell',
        description: 'Exploit the command injection flaw to spawn a reverse shell connection back to your netcat listener and retrieve the root proof flag.',
        hints: [
          'Start a netcat listener: nc -lvnp 4444',
          'Payload: python3 -c \'import pty; pty.spawn("/bin/bash")\''
        ],
        flag: 'FLAG{rce_root_shell_access}',
        answerType: 'FLAG',
        mitreTechnique: 'T1059.004',
        points: 100,
        order: 2
      }
    ]
  };

  for (const [labName, taskList] of Object.entries(tasksByLab)) {
    const labDef = createdLabsMap[labName];
    if (!labDef) continue;

    for (const t of taskList) {
      await prisma.labTask.upsert({
        where: {
          id: `${labDef.id}-task-${t.order}`
        },
        update: {
          title: t.title,
          description: t.description,
          hints: t.hints,
          flag: t.flag,
          answerType: t.answerType,
          mitreTechnique: t.mitreTechnique,
          points: t.points,
          order: t.order,
          labDefinitionId: labDef.id
        },
        create: {
          id: `${labDef.id}-task-${t.order}`,
          title: t.title,
          description: t.description,
          hints: t.hints,
          flag: t.flag,
          answerType: t.answerType,
          mitreTechnique: t.mitreTechnique,
          points: t.points,
          order: t.order,
          labDefinitionId: labDef.id
        }
      });
    }
    console.log(`[seed] Seeded interactive tasks for ${labName}`);
  }

  // 6. Seed Learning Academy Tracks & Modules
  const learningPaths = [
    {
      title: 'Web Application Penetration Testing',
      slug: 'web-pentesting',
      description: 'Master offensive application security: SQL injection, auth bypass, file inclusions, and remote code execution against modern cloud architectures.',
      icon: '🌐',
      difficulty: 'BEGINNER',
      order: 1,
      modules: [
        {
          title: 'SQL Injection: From Tautology to Database Takeover',
          description: 'Explore input sanitization failures, construct error-based payloads, and dump credential hashes.',
          labName: 'SQL Injection Fundamentals',
          estimatedMinutes: 45
        },
        {
          title: 'Remote Code Execution & Shell Spawning',
          description: 'Exploit unsafe deserialization and command injection to break process sandboxes and establish interactive shell control.',
          labName: 'Remote Code Execution (RCE)',
          estimatedMinutes: 60
        }
      ]
    },
    {
      title: 'Offensive Workstation Mastery',
      slug: 'workstation-mastery',
      description: 'Hands-on training with the industry-standard Kali Linux distribution: XFCE desktop operations, Nmap port reconnaissance, and Wireshark packet capture analysis.',
      icon: '⚡',
      difficulty: 'INTERMEDIATE',
      order: 2,
      modules: [
        {
          title: 'Kali Linux XFCE Tools & Network Discovery',
          description: 'Leverage the graphical Kali desktop to execute active reconnaissance, intercept network traffic with Wireshark, and audit internal pod networks.',
          labName: 'Kali Linux GUI Workstation',
          estimatedMinutes: 60
        }
      ]
    },
    {
      title: 'Defensive Network Security & Traffic Analysis',
      slug: 'network-security',
      description: 'Inspect live packet streams, detect unauthorized port sweeps, and conduct network forensics using Wireshark and Tshark.',
      icon: '🛡️',
      difficulty: 'ADVANCED',
      order: 3,
      modules: [
        {
          title: 'Deep Packet Inspection & C2 Traffic Analysis',
          description: 'Analyze raw PCAP artifacts to identify beaconing patterns and extract exfiltrated data frames.',
          labName: 'Kali Linux GUI Workstation',
          estimatedMinutes: 90
        }
      ]
    }
  ];

  const createdPathsMap: Record<string, any> = {};

  for (const p of learningPaths) {
    const learningPath = await prisma.learningPath.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        description: p.description,
        icon: p.icon,
        difficulty: p.difficulty as any,
        order: p.order
      },
      create: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        icon: p.icon,
        difficulty: p.difficulty as any,
        order: p.order
      }
    });

    createdPathsMap[p.slug] = learningPath;

    for (let i = 0; i < p.modules.length; i++) {
      const mod = p.modules[i];
      const associatedLab = createdLabsMap[mod.labName];

      await prisma.module.upsert({
        where: { id: `${learningPath.id}-mod-${i + 1}` },
        update: {
          learningPathId: learningPath.id,
          labDefinitionId: associatedLab?.id || null,
          title: mod.title,
          description: mod.description,
          order: i + 1,
          estimatedMinutes: mod.estimatedMinutes
        },
        create: {
          id: `${learningPath.id}-mod-${i + 1}`,
          learningPathId: learningPath.id,
          labDefinitionId: associatedLab?.id || null,
          title: mod.title,
          description: mod.description,
          order: i + 1,
          estimatedMinutes: mod.estimatedMinutes
        }
      });
    }

    console.log(`[seed] Seeded Learning Path: ${learningPath.title}`);
  }

  // 7. Seed Instructor Cohort & Assignments
  const cohort = await prisma.cohort.upsert({
    where: { code: 'SEC-401' },
    update: {
      name: 'Cyber Operations & Defense — Cohort 2026-A',
      description: 'Core hands-on cohort covering web penetration testing, reconnaissance, and Linux offensive operations.',
      instructorId: instructor.id
    },
    create: {
      name: 'Cyber Operations & Defense — Cohort 2026-A',
      description: 'Core hands-on cohort covering web penetration testing, reconnaissance, and Linux offensive operations.',
      code: 'SEC-401',
      instructorId: instructor.id
    }
  });

  // Enroll student01 in SEC-401
  await prisma.cohortStudent.upsert({
    where: { cohortId_userId: { cohortId: cohort.id, userId: student.id } },
    update: {},
    create: {
      cohortId: cohort.id,
      userId: student.id
    }
  });

  // Assign Kali Workstation Lab and Web Pentest Path
  await prisma.cohortAssignment.upsert({
    where: { id: `${cohort.id}-asgn-1` },
    update: {
      title: 'Lab 1: Kali Linux Workstation & Reconnaissance',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    create: {
      id: `${cohort.id}-asgn-1`,
      cohortId: cohort.id,
      labId: createdLabsMap['Kali Linux GUI Workstation']?.id,
      title: 'Lab 1: Kali Linux Workstation & Reconnaissance',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.cohortAssignment.upsert({
    where: { id: `${cohort.id}-asgn-2` },
    update: {
      title: 'Track 1: Web Application Penetration Testing',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    },
    create: {
      id: `${cohort.id}-asgn-2`,
      cohortId: cohort.id,
      learningPathId: createdPathsMap['web-pentesting']?.id,
      title: 'Track 1: Web Application Penetration Testing',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    }
  });

  console.log(`[seed] Seeded Instructor Cohort: ${cohort.name} (Code: ${cohort.code})`);

  // 8. Seed Achievement Badges for Demo Student
  await prisma.studentBadge.upsert({
    where: { userId_code: { userId: student.id, code: 'FIRST_BLOOD' } },
    update: {},
    create: {
      userId: student.id,
      code: 'FIRST_BLOOD',
      title: 'First Blood',
      description: 'Captured your first CTF challenge flag in the cyber range.',
      icon: '⚡'
    }
  });

  await prisma.studentBadge.upsert({
    where: { userId_code: { userId: student.id, code: 'DESKTOP_VIRTUOSO' } },
    update: {},
    create: {
      userId: student.id,
      code: 'DESKTOP_VIRTUOSO',
      title: 'Desktop Virtuoso',
      description: 'Successfully deployed and connected to a full Kali Linux GUI workstation.',
      icon: '🖥️'
    }
  });

  console.log(`[seed] Seeded badges for student01`);
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[seed error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
