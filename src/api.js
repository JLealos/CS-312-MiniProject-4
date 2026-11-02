const express = require('express');
const { randomBytes } = require('node:crypto');
const { promisify } = require('node:util');
const { hashPassword, verifyPassword } = require('./passwords');

const text = (value) => typeof value === 'string' ? value.trim() : '';
const fail = (res, status, error) => res.status(status).json({ error });
const validId = (value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
const postJson = (row) => ({
  id: row.blog_id, author: row.creator_name, creatorUserId: row.creator_user_id,
  title: row.title, content: row.body, tags: row.tags,
  createdAt: row.date_created, updatedAt: row.date_updated,
  likes: row.likes ?? 0, dislikes: row.dislikes ?? 0,
  currentReaction: row.current_reaction || null,
});

function createApi({ pool }) {
  const api = express.Router();
  api.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    req.session.csrfToken ||= randomBytes(32).toString('hex');
    req.user = null;
    if (req.session.userId) {
      const result = await pool.query('SELECT user_id, name FROM users WHERE user_id = $1', [req.session.userId]);
      req.user = result.rows[0] || null;
      if (!req.user) delete req.session.userId;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-CSRF-Token') !== req.session.csrfToken) {
      return fail(res, 403, 'Invalid CSRF token. Fetch /api/session and try again.');
    }
    next();
  });
  const requireUser = (req, res, next) => req.user ? next() : fail(res, 401, 'Please sign in.');
  const userJson = (user) => user ? { user_id: user.user_id, name: user.name } : null;
  async function findPost(id, userId) {
    if (!validId(id)) return null;
    const { rows } = await pool.query(`SELECT b.*,
      (SELECT COUNT(*)::integer FROM blog_reactions WHERE blog_id = b.blog_id AND reaction = 'like') AS likes,
      (SELECT COUNT(*)::integer FROM blog_reactions WHERE blog_id = b.blog_id AND reaction = 'dislike') AS dislikes,
      (SELECT reaction FROM blog_reactions WHERE blog_id = b.blog_id AND user_id = $2) AS current_reaction
      FROM blogs b WHERE b.blog_id = $1`, [Number(id), userId || null]);
    return rows[0] ? postJson(rows[0]) : null;
  }
  async function requireOwner(req, res, next) {
    req.post = await findPost(req.params.id, req.user.user_id);
    if (!req.post) return fail(res, 404, 'Post not found.');
    if (req.post.creatorUserId !== req.user.user_id) return fail(res, 403, 'You can only edit or delete your own posts.');
    next();
  }
  function fields(body = {}) {
    const tags = Array.isArray(body.tags) ? body.tags : text(body.tags).split(',');
    return { title: text(body.title), content: text(body.content), tags: [...new Set(tags.map(text).map(t => t.toLowerCase()).filter(Boolean))] };
  }
  function validatePost(req, res, next) {
    req.fields = fields(req.body);
    if (!req.fields.title || !req.fields.content) return fail(res, 400, 'Please enter a title and blog content.');
    if (req.fields.title.length > 255) return fail(res, 400, 'Keep the title to 255 characters or fewer.');
    next();
  }
  api.get('/session', (req, res) => res.json({ user: userJson(req.user), csrfToken: req.session.csrfToken }));
  api.post('/signup', async (req, res) => {
    const userId = text(req.body?.user_id), name = text(req.body?.name);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!userId || !name || password.length < 8 || userId.length > 255 || name.length > 255 || password.length > 1024) {
      return fail(res, 400, 'Enter a user ID and name (at most 255 characters) and a password of 8–1024 characters.');
    }
    try {
      await pool.query('INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)', [userId, await hashPassword(password), name]);
    } catch (error) {
      if (error.code === '23505') return fail(res, 409, 'That user ID is taken. Please choose another.');
      throw error;
    }
    res.status(201).json({ user: { user_id: userId, name } });
  });
  api.post('/signin', async (req, res) => {
    const userId = text(req.body?.user_id);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = userId && userId.length <= 255 && password.length <= 1024
      ? await pool.query('SELECT user_id, name, password FROM users WHERE user_id = $1', [userId]) : { rows: [] };
    const user = result.rows[0];
    if (!user || !await verifyPassword(password, user.password)) return fail(res, 401, 'Incorrect user ID or password.');
    await promisify(req.session.regenerate).call(req.session);
    req.session.userId = user.user_id;
    req.session.csrfToken = randomBytes(32).toString('hex');
    await promisify(req.session.save).call(req.session);
    res.json({ user: userJson(user), csrfToken: req.session.csrfToken });
  });
  api.post('/logout', (req, res, next) => req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('notebook.sid');
    res.json({ message: 'Signed out.' });
  }));
  api.get('/posts', async (req, res) => {
    const { rows } = await pool.query(`SELECT b.*,
      (SELECT COUNT(*)::integer FROM blog_reactions WHERE blog_id = b.blog_id AND reaction = 'like') AS likes,
      (SELECT COUNT(*)::integer FROM blog_reactions WHERE blog_id = b.blog_id AND reaction = 'dislike') AS dislikes,
      (SELECT reaction FROM blog_reactions WHERE blog_id = b.blog_id AND user_id = $1) AS current_reaction FROM blogs b`, [req.user?.user_id || null]);
    const posts = rows.map(postJson);
    const selectedTag = text(req.query.tag).toLowerCase();
    const sortOrder = req.query.sort === 'oldest' ? 'oldest' : 'newest';
    const filtered = posts.filter(p => !selectedTag || p.tags.includes(selectedTag)).sort((a, b) => {
      const difference = new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id;
      return sortOrder === 'oldest' ? difference : -difference;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / 5));
    const currentPage = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), pageCount);
    res.json({ posts: filtered.slice((currentPage - 1) * 5, currentPage * 5), totalPosts: filtered.length,
      availableTags: [...new Set(posts.flatMap(p => p.tags))].sort(), selectedTag, sortOrder, currentPage, pageCount });
  });
  api.get('/posts/:id', async (req, res) => {
    const post = await findPost(req.params.id, req.user?.user_id);
    return post ? res.json({ post }) : fail(res, 404, 'Post not found.');
  });
  api.post('/posts', requireUser, validatePost, async (req, res) => {
    const { title, content, tags } = req.fields;
    const { rows } = await pool.query('INSERT INTO blogs (creator_name, creator_user_id, title, body, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.user.name, req.user.user_id, title, content, tags]);
    res.status(201).json({ post: postJson(rows[0]) });
  });
  api.put('/posts/:id', requireUser, requireOwner, validatePost, async (req, res) => {
    const { title, content, tags } = req.fields;
    const result = await pool.query('UPDATE blogs SET title = $1, body = $2, tags = $3, date_updated = CURRENT_TIMESTAMP WHERE blog_id = $4 AND creator_user_id = $5 RETURNING blog_id', [title, content, tags, req.post.id, req.user.user_id]);
    if (!result.rowCount) return fail(res, 404, 'Post not found.');
    res.json({ post: await findPost(req.params.id, req.user.user_id) });
  });
  api.delete('/posts/:id', requireUser, requireOwner, async (req, res) => {
    const result = await pool.query('DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2', [req.post.id, req.user.user_id]);
    if (!result.rowCount) return fail(res, 404, 'Post not found.');
    res.json({ message: 'Post deleted.' });
  });
  api.post('/posts/:id/react', requireUser, async (req, res) => {
    if (!await findPost(req.params.id, req.user.user_id)) return fail(res, 404, 'Post not found.');
    const reaction = req.body?.reaction;
    if (!['like', 'dislike', 'remove'].includes(reaction)) return fail(res, 400, 'Choose like, dislike, or remove.');
    if (reaction === 'remove') {
      await pool.query('DELETE FROM blog_reactions WHERE blog_id = $1 AND user_id = $2', [Number(req.params.id), req.user.user_id]);
    } else {
      await pool.query(`INSERT INTO blog_reactions (blog_id, user_id, reaction) VALUES ($1, $2, $3)
        ON CONFLICT (blog_id, user_id) DO UPDATE SET reaction = EXCLUDED.reaction`, [Number(req.params.id), req.user.user_id, reaction]);
    }
    res.json({ post: await findPost(req.params.id, req.user.user_id) });
  });
  api.use((req, res) => fail(res, 404, 'API endpoint not found.'));
  api.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = [400, 413, 415].includes(error.status) ? error.status : 500;
    fail(res, status, status === 500 ? 'Could not complete your request. Please try again.' : 'Invalid JSON request or request body too large.');
  });
  return api;
}

module.exports = { createApi };
