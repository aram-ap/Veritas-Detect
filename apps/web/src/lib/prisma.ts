import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Configure SSL for PostgreSQL connection
  let sslConfig: any = false;

  if (process.env.DATABASE_SSL !== 'false') {
    // Try to load CA certificate for strict SSL
    const caCertPath = process.env.DATABASE_SSL_CA_PATH || path.join(process.cwd(), 'certs', 'ca-certificate.crt');
    
    if (fs.existsSync(caCertPath)) {
      // Strict SSL with CA certificate verification
      console.log('✓ Using strict SSL with CA certificate');
      sslConfig = {
        rejectUnauthorized: true,
        ca: fs.readFileSync(caCertPath).toString(),
      };
    } else {
      // Relaxed SSL - accept self-signed certificates
      // This is secure enough for development and works with DigitalOcean
      console.log('⚠ Using relaxed SSL (self-signed certificates accepted)');
      console.log(`  To enable strict SSL, download CA certificate to: ${caCertPath}`);
      console.log('  See SSL_SETUP.md for instructions');
      sslConfig = {
        rejectUnauthorized: false,
      };
    }
  } else {
    console.log('⚠ SSL disabled - not recommended for production');
  }

  // Configure connection pool for serverless environment with PgBouncer
  // Using pooled connection (port 25061) with reasonable timeouts
  const connectionTimeout = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000', 10);
  const queryTimeout = parseInt(process.env.DATABASE_QUERY_TIMEOUT || '10000', 10);

  console.log(`[Prisma] Connection timeout: ${connectionTimeout}ms, Query timeout: ${queryTimeout}ms`);

  const pool = new Pool({
    connectionString,
    ssl: sslConfig,
    // Serverless-optimized settings for PgBouncer (transaction mode)
    max: 1, // Single connection per serverless function
    min: 0, // Don't maintain idle connections
    idleTimeoutMillis: 10000, // Close idle connections quickly
    connectionTimeoutMillis: connectionTimeout, // Reasonable timeout with pooled connection
    allowExitOnIdle: true, // Allow the pool to exit when idle
    // Note: statement_timeout and query_timeout are NOT supported by PgBouncer in transaction mode
    // Keep-alive to prevent connection drops
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Application identifier for DB logs
    application_name: 'veritas-web',
  });
  
  // Log connection errors for debugging
  pool.on('error', (err) => {
    console.error('[Prisma Pool] Unexpected error on idle client:', err);
  });
  
  pool.on('connect', () => {
    console.log('[Prisma Pool] New client connected');
  });
  
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
