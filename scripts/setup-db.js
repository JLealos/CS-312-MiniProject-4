require('dotenv').config({ quiet: true });
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { seedDatabase } = require('../db/seed');

async function setup() {
  if (!process.env.DATABASE_URL) throw new Error('requires .env and your PostgreSQL password.');
  const target = new URL(process.env.DATABASE_URL);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!databaseName) throw new Error('DATABASE_URL must include a database name.');
  const adminUrl = new URL(target);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });

  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (!existing.rowCount) {
      // Database names cannot be query parameters.
      await admin.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: target.toString(), connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(await readFile(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    await seedDatabase(client);
    await client.query('COMMIT');
    console.log(`Database ${databaseName} is ready with 3 demo users and 5 initial posts.`);
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setup().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
});
