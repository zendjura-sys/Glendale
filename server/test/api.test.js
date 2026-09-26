import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DB_FILE = ':memory:';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'glendale-uploads-'));

const { createApp } = await import('../src/index.js');
const { attachRealtime } = await import('../src/realtime.js');

let server;
let base;

before(async () => {
  server = http.createServer(createApp());
  attachRealtime(server);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

async function call(token, method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function register(firstName, email) {
  const r = await call(null, 'POST', '/auth/register', { firstName, lastName: 'Тестов', email, password: 'secret1' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

test('social flow: friends, wall, likes, comments, reposts, messages, groups, search', async () => {
  const a = await register('Анна', 'a@test.dev');
  const b = await register('Борис', 'b@test.dev');

  assert.equal((await call(null, 'GET', '/me')).status, 401);
  assert.equal((await call(null, 'POST', '/auth/login', { email: 'a@test.dev', password: 'wrong' })).status, 401);
  assert.equal((await call(null, 'POST', '/auth/register', { firstName: 'X', lastName: 'Y', email: 'a@test.dev', password: 'secret1' })).status, 409);

  // Friendship: request -> accept.
  assert.equal((await call(a.token, 'POST', `/friends/${b.user.id}`)).body.friendship, 'outgoing');
  assert.equal((await call(b.token, 'GET', '/counters')).body.friends, 1);
  assert.equal((await call(b.token, 'POST', `/friends/${a.user.id}`)).body.friendship, 'friends');
  assert.equal((await call(a.token, 'GET', `/users/${b.user.id}`)).body.friendship, 'friends');

  // Wall post by a friend on someone else's wall, and on own wall.
  const onWall = await call(b.token, 'POST', '/posts', { text: 'Привет на стену', ownerId: a.user.id });
  assert.equal(onWall.status, 201);
  assert.equal(onWall.body.wallOwner.id, a.user.id);
  const own = await call(a.token, 'POST', '/posts', { text: 'Моя первая запись' });
  assert.equal(own.status, 201);

  const feed = await call(b.token, 'GET', '/feed');
  assert.ok(feed.body.items.some((p) => p.id === own.body.id));

  // Likes, comments, reposts.
  const liked = await call(b.token, 'POST', `/posts/${own.body.id}/like`);
  assert.equal(liked.body.likes, 1);
  assert.equal(liked.body.liked, true);
  assert.equal((await call(b.token, 'POST', `/posts/${own.body.id}/like`)).body.likes, 1, 'like is idempotent');
  await call(b.token, 'POST', `/posts/${own.body.id}/comments`, { text: 'Класс!' });
  assert.equal((await call(a.token, 'GET', `/posts/${own.body.id}/comments`)).body.length, 1);
  const repost = await call(b.token, 'POST', `/posts/${own.body.id}/repost`, { text: '' });
  assert.equal(repost.status, 201);
  assert.equal(repost.body.repost.id, own.body.id);
  assert.equal((await call(b.token, 'POST', `/posts/${own.body.id}/repost`, {})).status, 409);

  const notifications = await call(a.token, 'GET', '/notifications');
  const types = notifications.body.items.map((n) => n.type).sort();
  assert.deepEqual(types, ['comment', 'friend_accept', 'like', 'repost', 'wall_post']);

  // Only the author or wall owner may delete.
  const stranger = await register('Вера', 'c@test.dev');
  assert.equal((await call(stranger.token, 'DELETE', `/posts/${own.body.id}`)).status, 403);
  assert.equal((await call(stranger.token, 'POST', '/posts', { text: 'x', ownerId: a.user.id })).status, 403);
  assert.equal((await call(a.token, 'DELETE', `/posts/${onWall.body.id}`)).status, 200);

  // Messages and read receipts.
  await call(a.token, 'POST', `/messages/${b.user.id}`, { text: 'Привет, Борис' });
  assert.equal((await call(b.token, 'GET', '/counters')).body.messages, 1);
  const dialogs = await call(b.token, 'GET', '/dialogs');
  assert.equal(dialogs.body[0].peer.id, a.user.id);
  assert.equal(dialogs.body[0].unread, 1);
  await call(b.token, 'POST', `/messages/${a.user.id}/read`);
  assert.equal((await call(b.token, 'GET', '/counters')).body.messages, 0);
  const history = await call(a.token, 'GET', `/messages/${b.user.id}`);
  assert.equal(history.body.items[0].isRead, true);

  // Groups: only admins post, members see posts in their feed.
  const g = await call(a.token, 'POST', '/groups', { name: 'Клуб любителей тестов' });
  assert.equal(g.body.isAdmin, true);
  assert.equal((await call(b.token, 'POST', '/posts', { text: 'x', ownerType: 'group', ownerId: g.body.id })).status, 403);
  const gp = await call(a.token, 'POST', '/posts', { text: 'Новость клуба', ownerType: 'group', ownerId: g.body.id });
  assert.equal(gp.body.fromGroup, true);
  assert.equal((await call(stranger.token, 'POST', `/groups/${g.body.id}/join`)).body.isMember, true);
  assert.ok((await call(stranger.token, 'GET', '/feed')).body.items.some((p) => p.id === gp.body.id));
  assert.equal((await call(a.token, 'DELETE', `/groups/${g.body.id}/join`)).status, 400, 'owner cannot leave');

  // Case-insensitive Cyrillic search.
  const found = await call(a.token, 'GET', `/search?q=${encodeURIComponent('борис')}`);
  assert.deepEqual(found.body.users.map((u) => u.id), [b.user.id]);
  assert.equal((await call(a.token, 'GET', `/search?q=${encodeURIComponent('КЛУБ')}`)).body.groups.length, 1);

  // Unfriending keeps the other person as a follower.
  assert.equal((await call(a.token, 'DELETE', `/friends/${b.user.id}`)).body.friendship, 'incoming');
});

test('password change signs out other sessions', async () => {
  const u = await register('Глеб', 'g@test.dev');
  const other = await call(null, 'POST', '/auth/login', { email: 'g@test.dev', password: 'secret1' });
  assert.equal((await call(u.token, 'POST', '/me/password', { current: 'bad', next: 'newpass' })).status, 400);
  assert.equal((await call(u.token, 'POST', '/me/password', { current: 'secret1', next: 'newpass' })).status, 200);
  assert.equal((await call(other.body.token, 'GET', '/me')).status, 401);
  assert.equal((await call(u.token, 'GET', '/me')).status, 200);
  assert.equal((await call(null, 'POST', '/auth/login', { email: 'g@test.dev', password: 'newpass' })).status, 200);
});
