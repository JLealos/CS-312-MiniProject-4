require('dotenv').config({ quiet: true });
const pool = require('./db');
const { createApp } = require('./app');

async function start() {
  const app = createApp({ pool, sessionSecret: process.env.SESSION_SECRET });
  await pool.query('SELECT blog_id FROM blogs LIMIT 1');
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`The Community Notebook is running at http://localhost:${port}`);
  });
  server.on('error', async (error) => {
    console.error('Server failed:', error.message);
    await pool.end();
    process.exitCode = 1;
  });
  const stop = () => server.close(() => pool.end());
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch(async (error) => {
  console.error('Startup failed:', error.message, '\nCheck .env and run npm run db:setup.');
  await pool.end();
  process.exitCode = 1;
});
