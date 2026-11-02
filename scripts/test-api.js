// Integration checks use a temporary schema; existing application data is untouched.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { createApp } = require('../src/app');

async function main() {
  const schema = `api_test_${randomBytes(8).toString('hex')}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  let pool, server, base;
  async function start() {
    server = createApp({ pool, sessionSecret: 'integration-test-secret' }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  function client() {
    let cookie = '', token = '';
    return async (method, route, body, expected = 200, csrf = true) => {
      const response = await fetch(`${base}/api${route}`, { method, headers: {
        Cookie: cookie, 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': token } : {}),
      }, body: body === undefined ? undefined : JSON.stringify(body) });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        cookie = setCookie.split(';')[0];
      }
      assert.equal(response.status, expected, `${method} ${route}`);
      assert.match(response.headers.get('content-type'), /application\/json/);
      const data = await response.json();
      if (data.csrfToken) token = data.csrfToken;
      assert.equal(JSON.stringify(data).includes('scrypt$'), false);
      return data;
    };
  }
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
    await pool.query(await readFile(path.join(__dirname, '../db/schema.sql'), 'utf8'));
    await start();
    const alice = client(), bob = client(), guest = client();
    await guest('GET', '/session');
    await guest('POST', '/posts', { title: 'Denied', content: 'Denied' }, 401);
    await guest('POST', '/signup', {}, 403, false);
    await guest('POST', '/signup', {}, 400);
    for (const [request, user_id] of [[alice, 'alice'], [bob, 'bob']]) {
      await request('GET', '/session');
      await request('POST', '/signup', { user_id, name: user_id, password: 'TestPassword312!' }, 201);
      await request('POST', '/signup', { user_id, name: user_id, password: 'TestPassword312!' }, 409);
      await request('POST', '/signin', { user_id, password: 'incorrect' }, 401);
      const login = await request('POST', '/signin', { user_id, password: 'TestPassword312!' });
      assert.deepEqual(Object.keys(login.user).sort(), ['name', 'user_id']);
    }
    const stored = await pool.query('SELECT password FROM users WHERE user_id = $1', ['alice']);
    assert.notEqual(stored.rows[0].password, 'TestPassword312!');
    await alice('POST', '/posts', { title: '', content: '' }, 400);
    let first;
    for (let i = 0; i < 6; i++) {
      const { post } = await alice('POST', '/posts', { title: `Post ${i}`, content: 'Original content', tags: 'React, node, REACT' }, 201);
      if (!first) first = post;
      assert.deepEqual(post.tags, ['react', 'node']);
    }
    const feed = await guest('GET', '/posts?tag=react&sort=oldest&page=2');
    assert.equal(feed.posts.length, 1);
    assert.equal(feed.totalPosts, 6);
    assert.equal(feed.pageCount, 2);
    assert.equal((await guest('GET', '/posts?tag=missing')).totalPosts, 0);
    assert.equal((await alice('GET', `/posts/${first.id}`)).post.content, 'Original content');
    await bob('PUT', `/posts/${first.id}`, { title: 'Stolen', content: 'Denied' }, 403);
    await bob('DELETE', `/posts/${first.id}`, undefined, 403);
    const edited = await alice('PUT', `/posts/${first.id}`, { title: 'Edited', content: 'Updated', tags: ['API'] });
    assert.equal(edited.post.content, 'Updated');
    assert.ok(edited.post.updatedAt);
    for (const reaction of ['like', 'dislike', 'remove']) {
      const { post } = await bob('POST', `/posts/${first.id}/react`, { reaction });
      assert.equal(post.likes, reaction === 'like' ? 1 : 0);
      assert.equal(post.dislikes, reaction === 'dislike' ? 1 : 0);
      assert.equal(post.currentReaction, reaction === 'remove' ? null : reaction);
    }
    await bob('POST', `/posts/${first.id}/react`, { reaction: 'invalid' }, 400);
    await guest('GET', '/posts/invalid', undefined, 404);
    await guest('GET', '/unknown', undefined, 404);
    const malformed = await fetch(`${base}/api/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.ok((await malformed.json()).error);
    await new Promise(resolve => server.close(resolve));
    await start();
    assert.equal((await alice('GET', '/session')).user.user_id, 'alice');
    await alice('DELETE', `/posts/${first.id}`);
    await guest('GET', `/posts/${first.id}`, undefined, 404);
    await alice('POST', '/logout');
    assert.equal((await alice('GET', '/session')).user, null);
    console.log('API integration checks passed: authentication, CSRF, CRUD, ownership, tags, pagination, reactions, errors, and persistent sessions.');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
}
main().catch(error => {
  console.error('API checks failed:', error instanceof assert.AssertionError ? error.message : error.code || error.name);
  process.exitCode = 1;
});
