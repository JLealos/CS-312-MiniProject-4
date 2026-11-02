const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { hashPassword, verifyPassword } = require('./passwords');

const text = (value) => typeof value === 'string' ? value.trim() : '';
const parseTags = (input) => [...new Set(text(input).split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

function toPost(row) {
  return {
    id: row.blog_id,
    author: row.creator_name,
    creatorUserId: row.creator_user_id,
    title: row.title,
    content: row.body,
    tags: row.tags,
    createdAt: new Date(row.date_created),
    updatedAt: row.date_updated ? new Date(row.date_updated) : null,
    likes: row.likes,
    dislikes: row.dislikes,
    currentReaction: row.current_reaction || null,
  };
}

function createApp({ pool, sessionSecret } = {}) {
  if (!pool || !sessionSecret) throw new Error('A database pool and SESSION_SECRET are required.');
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(session({
    name: 'notebook.sid',
    secret: sessionSecret,
    store: new PgSession({ pool }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 },
  }));

  app.use(async (request, response, next) => {
    if (!request.session.csrfToken) request.session.csrfToken = randomBytes(32).toString('hex');
    response.locals.csrfToken = request.session.csrfToken;
    response.locals.currentUser = null;
    if (request.session.userId) {
      const result = await pool.query('SELECT user_id, name FROM users WHERE user_id = $1', [request.session.userId]);
      response.locals.currentUser = result.rows[0] || null;
      if (!response.locals.currentUser) delete request.session.userId;
    }
    if (request.method === 'POST' && request.body?._csrf !== request.session.csrfToken) {
      return response.status(403).render('error', { pageTitle: 'Form expired', message: 'Please reload the page and submit the form again.' });
    }
    next();
  });

  function requireUser(request, response, next) {
    if (!response.locals.currentUser) return response.redirect('/signin');
    next();
  }

  async function getPostViewData(query = {}, userId = null) {
    const { rows } = await pool.query(
      `SELECT b.*,
       (SELECT COUNT(*)::integer FROM blog_reactions WHERE blog_id = b.blog_id AND reaction = 'like') AS likes,
       (SELECT COUNT(*)::integer FROM blog_reactions WHERE blog_id = b.blog_id AND reaction = 'dislike') AS dislikes,
       (SELECT reaction FROM blog_reactions WHERE blog_id = b.blog_id AND user_id = $1) AS current_reaction
       FROM blogs b`,
      [userId],
    );
    const posts = rows.map(toPost);
    const selectedTag = text(query.tag).toLowerCase();
    const sortOrder = query.sort === 'oldest' ? 'oldest' : 'newest';
    const filtered = posts.filter((post) => !selectedTag || post.tags.includes(selectedTag)).sort((a, b) => {
      const difference = a.createdAt - b.createdAt || a.id - b.id;
      return sortOrder === 'oldest' ? difference : -difference;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / 5));
    const currentPage = Math.min(Math.max(Number.parseInt(query.page, 10) || 1, 1), pageCount);
    return {
      posts: filtered.slice((currentPage - 1) * 5, currentPage * 5),
      totalPosts: filtered.length,
      availableTags: [...new Set(posts.flatMap((post) => post.tags))].sort(),
      selectedTag, sortOrder, currentPage, pageCount,
    };
  }

  async function renderFeed(request, response, formData = {}, error = null) {
    const userId = response.locals.currentUser?.user_id || null;
    response.render('index', { pageTitle: 'The Community Notebook', ...await getPostViewData(request.query, userId), formData, error });
  }

  function postFields(body) {
    return { title: text(body.title), content: text(body.content), tags: parseTags(body.tags) };
  }

  function postError(fields) {
    if (!fields.title || !fields.content) return 'Please enter a title and blog content.';
    if (fields.title.length > 255) return 'Keep the title to 255 characters or fewer.';
    return null;
  }

  async function ownedPost(request, response) {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
      response.status(404).render('error', { pageTitle: 'Post not found', message: 'Post not found.' });
      return null;
    }
    const { rows } = await pool.query('SELECT * FROM blogs WHERE blog_id = $1', [id]);
    if (!rows[0]) {
      response.status(404).render('error', { pageTitle: 'Post not found', message: 'Post not found.' });
      return null;
    }
    if (rows[0].creator_user_id !== response.locals.currentUser.user_id) {
      response.status(403).render('error', { pageTitle: 'Access denied', message: 'You can only edit or delete your own posts.' });
      return null;
    }
    return toPost(rows[0]);
  }

  app.get('/', (request, response) => renderFeed(request, response));

  app.get('/signup', (request, response) => {
    response.render('signup', { pageTitle: 'Sign up', formData: {}, error: null });
  });

  app.post('/signup', async (request, response) => {
    const userId = text(request.body.user_id);
    const name = text(request.body.name);
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const formData = { user_id: userId, name };
    let error = null;
    if (!userId || !name || password.length < 8) error = 'Enter a user ID, name, and a password with at least 8 characters.';
    else if (userId.length > 255 || name.length > 255 || password.length > 1024) error = 'User ID and name must be at most 255 characters; password must be at most 1024.';
    if (error) return response.status(400).render('signup', { pageTitle: 'Sign up', formData, error });

    const existing = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (existing.rowCount) {
      return response.status(409).render('signup', { pageTitle: 'Sign up', formData, error: 'That user ID is taken. Please choose another.' });
    }
    try {
      await pool.query('INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)', [userId, await hashPassword(password), name]);
    } catch (error) {
      if (error.code !== '23505') throw error;
      return response.status(409).render('signup', { pageTitle: 'Sign up', formData, error: 'That user ID is taken. Please choose another.' });
    }
    response.redirect('/signin?registered=1');
  });

  app.get('/signin', (request, response) => {
    response.render('signin', { pageTitle: 'Sign in', formData: {}, error: null, registered: request.query.registered === '1' });
  });

  app.post('/signin', async (request, response) => {
    const userId = text(request.body.user_id);
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const result = userId && userId.length <= 255 && password.length <= 1024
      ? await pool.query('SELECT user_id, password FROM users WHERE user_id = $1', [userId])
      : { rows: [] };
    const user = result.rows[0];
    if (!user || !await verifyPassword(password, user.password)) {
      return response.status(401).render('signin', { pageTitle: 'Sign in', formData: { user_id: userId }, error: 'Incorrect user ID or password.', registered: false });
    }
    await promisify(request.session.regenerate).call(request.session);
    request.session.userId = user.user_id;
    await promisify(request.session.save).call(request.session);
    response.redirect('/');
  });

  app.post('/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('notebook.sid');
      response.redirect('/signin');
    });
  });

  app.post('/posts', requireUser, async (request, response) => {
    const fields = postFields(request.body);
    const error = postError(fields);
    if (error) return renderFeed(request, response.status(400), request.body, error);
    const user = response.locals.currentUser;
    await pool.query(
      'INSERT INTO blogs (creator_name, creator_user_id, title, body, tags) VALUES ($1, $2, $3, $4, $5)',
      [user.name, user.user_id, fields.title, fields.content, fields.tags],
    );
    response.redirect('/');
  });

  app.get('/posts/:id/edit', requireUser, async (request, response) => {
    const post = await ownedPost(request, response);
    if (post) response.render('edit', { pageTitle: `Edit ${post.title}`, post, error: null });
  });

  app.post('/posts/:id/edit', requireUser, async (request, response) => {
    const post = await ownedPost(request, response);
    if (!post) return;
    const fields = postFields(request.body);
    const error = postError(fields);
    if (error) {
      return response.status(400).render('edit', { pageTitle: `Edit ${post.title}`, post: { ...post, ...fields }, error });
    }
    await pool.query(
      'UPDATE blogs SET title = $1, body = $2, tags = $3, date_updated = CURRENT_TIMESTAMP WHERE blog_id = $4 AND creator_user_id = $5',
      [fields.title, fields.content, fields.tags, post.id, response.locals.currentUser.user_id],
    );
    response.redirect('/');
  });

  app.post('/posts/:id/delete', requireUser, async (request, response) => {
    const post = await ownedPost(request, response);
    if (!post) return;
    await pool.query('DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2', [post.id, response.locals.currentUser.user_id]);
    response.redirect('/');
  });

  app.post('/posts/:id/react', requireUser, async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
      return response.status(404).render('error', { pageTitle: 'Post not found', message: 'Post not found.' });
    }
    const reaction = request.body.reaction;
    if (!['like', 'dislike', 'remove'].includes(reaction)) {
      return response.status(400).render('error', { pageTitle: 'Invalid reaction', message: 'Choose like or dislike.' });
    }
    const post = await pool.query('SELECT blog_id FROM blogs WHERE blog_id = $1', [id]);
    if (!post.rowCount) return response.status(404).render('error', { pageTitle: 'Post not found', message: 'Post not found.' });
    const userId = response.locals.currentUser.user_id;
    if (reaction === 'remove') {
      await pool.query('DELETE FROM blog_reactions WHERE blog_id = $1 AND user_id = $2', [id, userId]);
    } else {
      const result = await pool.query(
        `INSERT INTO blog_reactions (blog_id, user_id, reaction)
         SELECT blog_id, $2::varchar, $3::varchar FROM blogs WHERE blog_id = $1
         ON CONFLICT (blog_id, user_id) DO UPDATE SET reaction = EXCLUDED.reaction
         RETURNING blog_id`,
        [id, userId, reaction],
      );
      if (!result.rowCount) return response.status(404).render('error', { pageTitle: 'Post not found', message: 'Post not found.' });
    }
    response.redirect('/');
  });

  app.use((request, response) => {
    response.status(404).render('error', { pageTitle: 'Page not found', message: 'Page not found.' });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    console.error(error.message);
    response.locals.currentUser ??= null;
    response.locals.csrfToken ??= '';
    const status = error.status === 413 ? 413 : 500;
    response.status(status).render('error', {
      pageTitle: 'Something went wrong',
      message: status === 413 ? 'This form is too large. Please shorten the post.' : 'Could not complete your request. Please try again.',
    });
  });

  return app;
}

module.exports = { createApp };
