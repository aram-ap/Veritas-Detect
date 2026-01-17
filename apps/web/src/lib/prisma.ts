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

  const pool = new Pool({ 
    connectionString,
    ssl: sslConfig
  });
  
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
