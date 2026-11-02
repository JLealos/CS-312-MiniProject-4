const path = require('node:path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { createApi } = require('./api');

function createApp({ pool, sessionSecret } = {}) {
  if (!pool || !sessionSecret) throw new Error('A database pool and SESSION_SECRET are required.');
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', session({
    name: 'notebook.sid', secret: sessionSecret,
    store: new PgSession({ pool }), resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 },
  }), createApi({ pool }));

  const frontend = path.join(__dirname, '..', 'dist');
  app.use(express.static(frontend));
  app.get(['/', '/signin', '/signup', '/profile', '/posts/:id', '/posts/:id/edit'], (req, res) => {
    res.sendFile(path.join(frontend, 'index.html'));
  });
  app.use((req, res) => res.status(404).json({ error: 'Page not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = [400, 413, 415].includes(error.status) ? error.status : 500;
    res.status(status).json({ error: status === 500
      ? 'Could not complete your request. Please try again.'
      : 'Invalid JSON request or request body too large.' });
  });
  return app;
}
module.exports = { createApp };
