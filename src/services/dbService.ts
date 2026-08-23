import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Setup pg connection pool and Prisma adapter
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Singleton Prisma client instance.
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

/**
 * Connect to PostgreSQL and verify the connection is alive.
 * Called once at server startup from index.ts.
 */
export const connectDb = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('[db]: Connected to PostgreSQL');
  } catch (error) {
    console.error('[db]: Failed to connect to PostgreSQL', error);
    process.exit(1);
  }
};

/**
 * Gracefully disconnect from the database.
 * Useful for clean shutdown hooks.
 */
export const disconnectDb = async (): Promise<void> => {
  await prisma.$disconnect();
  console.log('[db]: Disconnected from PostgreSQL');
};

export default prisma;
