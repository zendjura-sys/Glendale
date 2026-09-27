import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DB_FILE = ':memory:';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'glendale-uploads-'));
const { createApp } = await import('../src/index.js');

let server;
let base;
before(async () => {
  server = http.createServer(createApp());
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
const register = async (name, email) =>
  (await call(null, 'POST', '/auth/register', { firstName: name, lastName: 'Т', email, password: 'secret1' })).body;
const befriend = async (a, b) => {
  await call(a.token, 'POST', `/friends/${b.user.id}`);
  await call(b.token, 'POST', `/friends/${a.user.id}`);
};

test('group chats: create, messages, unread, roles, leave', async () => {
  const [a, b, c, d] = [await register('Ая', 'a@c.dev'), await register('Бо', 'b@c.dev'), await register('Ві', 'c@c.dev'), await register('Гр', 'd@c.dev')];
  await befriend(a, b);
  await befriend(a, c);

  // Only friends can be added.
  assert.equal((await call(a.token, 'POST', '/chats', { title: 'Друзі', memberIds: [b.user.id, d.user.id] })).status, 403);
  const chat = (await call(a.token, 'POST', '/chats', { title: 'Друзі', memberIds: [b.user.id] })).body;
  assert.equal(chat.membersCount, 2);
  assert.equal(chat.myRole, 'owner');

  await call(a.token, 'POST', `/chats/${chat.id}/messages`, { text: 'Привіт усім' });
  const bChats = (await call(b.token, 'GET', '/chats')).body;
  assert.equal(bChats[0].unread, 2, 'system message + text');
  assert.ok((await call(b.token, 'GET', '/counters')).body.messages >= 1);
  await call(b.token, 'POST', `/chats/${chat.id}/read`);
  assert.equal((await call(b.token, 'GET', '/chats')).body[0].unread, 0);
  assert.ok((await call(a.token, 'GET', `/chats/${chat.id}`)).body.readUpTo > 0);

  // Outsiders can't read; members add their own friends.
  assert.equal((await call(c.token, 'GET', `/chats/${chat.id}/messages`)).status, 403);
  await call(a.token, 'POST', `/chats/${chat.id}/members`, { userIds: [c.user.id] });
  const history = (await call(c.token, 'GET', `/chats/${chat.id}/messages`)).body.items;
  assert.ok(history.some((m) => m.kind === 'system' && m.text.includes('добавил')));

  // Roles: only the owner promotes; admins remove members; members can't.
  assert.equal((await call(b.token, 'DELETE', `/chats/${chat.id}/members/${c.user.id}`)).status, 403);
  await call(a.token, 'PATCH', `/chats/${chat.id}/members/${b.user.id}`, { role: 'admin' });
  assert.equal((await call(b.token, 'PATCH', `/chats/${chat.id}`, { title: 'Нова назва' })).body.title, 'Нова назва');
  assert.equal((await call(b.token, 'DELETE', `/chats/${chat.id}/members/${c.user.id}`)).status, 200);
  assert.equal((await call(c.token, 'GET', `/chats/${chat.id}`)).status, 403);

  // Owner leaves: ownership passes to the admin.
  await call(a.token, 'DELETE', `/chats/${chat.id}/members/${a.user.id}`);
  const after = (await call(b.token, 'GET', `/chats/${chat.id}`)).body;
  assert.equal(after.myRole, 'owner');
  assert.equal(after.membersCount, 1);
});

test('closed groups: requests, hidden wall, roles', async () => {
  const [o, m, x] = [await register('Оля', 'o@g.dev'), await register('Макс', 'm@g.dev'), await register('Ксена', 'x@g.dev')];
  const g = (await call(o.token, 'POST', '/groups', { name: 'Закрита група', privacy: 'closed' })).body;
  assert.equal(g.privacy, 'closed');
  const post = (await call(o.token, 'POST', '/posts', { text: 'Секрет', ownerType: 'group', ownerId: g.id })).body;

  // Outsiders see the card but not the wall, members or the post.
  assert.equal((await call(m.token, 'GET', `/wall/group/${g.id}`)).status, 403);
  assert.equal((await call(m.token, 'GET', `/groups/${g.id}/members`)).status, 403);
  assert.equal((await call(m.token, 'GET', `/posts/${post.id}`)).status, 403);
  assert.ok(!(await call(m.token, 'GET', '/feed?tab=popular')).body.items.some((p) => p.id === post.id));
  assert.equal((await call(m.token, 'GET', `/groups/${g.id}`)).body.canSeeContent, false);

  // Join = request; the owner gets notified, approves; now the wall opens.
  const joined = (await call(m.token, 'POST', `/groups/${g.id}/join`)).body;
  assert.equal(joined.isMember, false);
  assert.equal(joined.requested, true);
  assert.ok((await call(o.token, 'GET', '/notifications')).body.items.some((n) => n.type === 'group_request' && n.groupId === g.id));
  assert.equal((await call(o.token, 'GET', `/groups/${g.id}`)).body.requestsCount, 1);
  const reqs = (await call(o.token, 'GET', `/groups/${g.id}/requests`)).body;
  assert.equal(reqs[0].id, m.user.id);
  assert.equal((await call(m.token, 'GET', `/groups/${g.id}/requests`)).status, 403);
  await call(o.token, 'POST', `/groups/${g.id}/requests/${m.user.id}`);
  assert.equal((await call(m.token, 'GET', `/wall/group/${g.id}`)).status, 200);

  // Roles: promote Max; admins can't remove the owner; only the owner demotes admins.
  await call(o.token, 'PATCH', `/groups/${g.id}/members/${m.user.id}`, { role: 'admin' });
  assert.equal((await call(m.token, 'DELETE', `/groups/${g.id}/members/${o.user.id}`)).status, 400);
  await call(x.token, 'POST', `/groups/${g.id}/join`);
  await call(m.token, 'DELETE', `/groups/${g.id}/requests/${x.user.id}`);
  assert.equal((await call(x.token, 'GET', `/groups/${g.id}`)).body.requested, false);
  const members = (await call(m.token, 'GET', `/groups/${g.id}/members`)).body;
  assert.equal(members.find((u) => u.id === o.user.id).role, 'owner');
});
