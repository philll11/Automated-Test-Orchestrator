// src/infrastructure/database.ts

import pg from 'pg';
const { Pool } = pg;

// Configure SSL for production environment
const sslConfig = process.env.NODE_ENV === 'production'
  ? { ssl: { rejectUnauthorized: false } }
  : undefined;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'test_orchestrator',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ...sslConfig
});

export default pool;