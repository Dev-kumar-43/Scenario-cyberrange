import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Sparky%4012@localhost:5432/cyberrange?schema=public';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create a dummy user
  const hashedPassword = await bcrypt.hash('Sparky@12', 10);
  const user = await prisma.user.upsert({
    where: { email: 'student@cyberrange.local' },
    update: {},
    create: {
      username: 'student01',
      email: 'student@cyberrange.local',
      password: hashedPassword,
      role: 'STUDENT',
    },
  });
  console.log(`Created test user: ${user.email}`);

  // 2. Create Lab Definitions
  const labs = [
    {
      name: 'SQL Injection Fundamentals',
      description: 'Learn the basics of SQL injection by exploiting a vulnerable login form in a mocked application.',
      dockerImage: 'vulnerables/web-dvwa:latest',
      exposedPort: 80,
      cpuLimit: '250m',
      memLimit: '256Mi',
      category: 'Web Exploitation',
      difficulty: 'BEGINNER',
      protocol: 'TCP'
    },
    {
      name: 'Remote Code Execution (RCE)',
      description: 'Exploit a deserialization vulnerability to gain full shell access to the target container.',
      dockerImage: 'bkimminich/juice-shop:latest',
      exposedPort: 3000,
      cpuLimit: '500m',
      memLimit: '512Mi',
      category: 'Web Exploitation',
      difficulty: 'ADVANCED',
      protocol: 'TCP'
    }
  ];

  for (const lab of labs) {
    const createdLab = await prisma.labDefinition.upsert({
      where: { name: lab.name },
      update: {},
      create: {
        name: lab.name,
        description: lab.description,
        dockerImage: lab.dockerImage,
        exposedPort: lab.exposedPort,
        cpuLimit: lab.cpuLimit,
        memLimit: lab.memLimit,
        category: lab.category,
        difficulty: lab.difficulty as any,
        protocol: lab.protocol as any
      },
    });
    console.log(`Created lab: ${createdLab.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
