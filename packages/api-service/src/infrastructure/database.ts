// src/infrastructure/database.ts

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;


let sslConfig;

if (process.env.NODE_ENV === 'production') {
  // In production (Azure), we MUST use SSL and provide the root certificate.
  // The path is relative to the running app's root directory in the container.
  const caPath = path.resolve(process.cwd(), './certs/DigiCertGlobalRootG2.crt.pem');
  
  sslConfig = {
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caPath).toString(),
    },
  };
} else {
  // For local development against Docker, SSL is not needed.
  sslConfig = undefined;
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'test_orchestrator',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ...sslConfig
});

export default pool;