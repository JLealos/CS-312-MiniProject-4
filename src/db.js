require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL in .env, then run npm run db:setup.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => console.error('Database connection error:', error.message));

module.exports = pool;
