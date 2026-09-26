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
  (await call(null, 'POST', '/auth/register', { firstName: name, lastName: 'Тест', email, password: 'secret1' })).body;

test('admin panel: roles, members, levels, reports, settings, audit log', async () => {
  // First account on a fresh install is the superadmin.
  const boss = await register('Босс', 'boss@t.dev');
  assert.equal(boss.user.level.type, 'superadmin');
  const alice = await register('Алиса', 'alice@t.dev');
  const bob = await register('Боб', 'bob@t.dev');
  assert.equal(alice.user.level.type, 'user');

  // Regular members have no access.
  assert.equal((await call(alice.token, 'GET', '/admin/dashboard')).status, 403);
  const dash = await call(boss.token, 'GET', '/admin/dashboard');
  assert.equal(dash.status, 200);
  assert.equal(dash.body.totals.users, 3);
  assert.equal(dash.body.activity.signups.length, 14);

  // Promote Alice to moderator: dashboard and reports yes, members no.
  const levels = (await call(boss.token, 'GET', '/admin/levels')).body;
  const mod = levels.find((l) => l.type === 'moderator');
  const restricted = levels.find((l) => l.title === 'Ограниченный');
  await call(boss.token, 'PATCH', `/admin/users/${alice.user.id}`, { levelId: mod.id });
  assert.equal((await call(alice.token, 'GET', '/admin/reports')).status, 200);
  assert.equal((await call(alice.token, 'GET', '/admin/users')).status, 403);

  // Reports: Bob posts spam, Boss reports it, the moderator deletes it and bans Bob.
  const post = (await call(bob.token, 'POST', '/posts', { text: 'Купи слона' })).body;
  assert.equal((await call(boss.token, 'POST', '/reports', { targetType: 'post', targetId: post.id, category: 'spam' })).status, 201);
  assert.equal((await call(boss.token, 'POST', '/reports', { targetType: 'post', targetId: post.id, category: 'spam' })).status, 409);
  const reports = (await call(alice.token, 'GET', '/admin/reports')).body;
  assert.equal(reports.items.length, 1);
  assert.equal(reports.items[0].target.text, 'Купи слона');
  await call(alice.token, 'POST', `/admin/reports/${reports.items[0].id}/resolve`, { action: 'delete_ban' });
  assert.equal((await call(boss.token, 'GET', `/posts/${post.id}`)).status, 404);
  assert.equal((await call(bob.token, 'GET', '/me')).status, 401, 'banned user is signed out');
  const loginBanned = await call(null, 'POST', '/auth/login', { email: 'bob@t.dev', password: 'secret1' });
  assert.equal(loginBanned.status, 403);

  // Unban, then restrict Bob with a level that cannot post.
  await call(boss.token, 'PATCH', `/admin/users/${bob.user.id}`, { enabled: true, levelId: restricted.id });
  const bobToken = (await call(null, 'POST', '/auth/login', { email: 'bob@t.dev', password: 'secret1' })).body.token;
  assert.equal((await call(bobToken, 'POST', '/posts', { text: 'снова' })).status, 403);

  // Moderators cannot touch the superadmin; admins cannot demote themselves.
  assert.equal((await call(boss.token, 'PATCH', `/admin/users/${boss.user.id}`, { enabled: false })).status, 400);

  // Login as another member.
  const as = await call(boss.token, 'POST', `/admin/users/${alice.user.id}/login-as`);
  assert.equal((await call(as.body.token, 'GET', '/me')).body.user.id, alice.user.id);

  // Settings: censorship, banned emails, signup approval, maintenance.
  await call(boss.token, 'PATCH', '/admin/settings', {
    bannedWords: 'редиска',
    bannedEmails: '*@spam.dev',
    signupMode: 'approval',
  });
  const censored = (await call(boss.token, 'POST', '/posts', { text: 'Ты редиска!' })).body;
  assert.equal(censored.text, 'Ты *******!');
  assert.equal((await call(null, 'POST', '/auth/register', { firstName: 'S', lastName: 'P', email: 'x@spam.dev', password: 'secret1' })).status, 403);
  const pending = await call(null, 'POST', '/auth/register', { firstName: 'Новый', lastName: 'Юзер', email: 'new@t.dev', password: 'secret1' });
  assert.equal(pending.status, 202);
  assert.equal((await call(null, 'POST', '/auth/login', { email: 'new@t.dev', password: 'secret1' })).status, 403);
  const pendingList = (await call(boss.token, 'GET', '/admin/users?status=pending')).body;
  assert.equal(pendingList.total, 1);
  await call(boss.token, 'POST', '/admin/users/bulk', { ids: [pendingList.items[0].id], action: 'approve' });
  assert.equal((await call(null, 'POST', '/auth/login', { email: 'new@t.dev', password: 'secret1' })).status, 200);

  await call(boss.token, 'PATCH', '/admin/settings', { maintenance: true });
  assert.equal((await call(null, 'GET', '/config')).body.maintenance, true);
  assert.equal((await call(as.body.token, 'GET', '/feed')).status, 200, 'staff keeps access during maintenance');
  assert.equal((await call(bobToken, 'GET', '/feed')).status, 503);
  await call(boss.token, 'PATCH', '/admin/settings', { maintenance: false });

  // Announcements are shown to members.
  await call(boss.token, 'POST', '/admin/announcements', { title: 'Привет всем', body: 'Текст' });
  assert.equal((await call(bobToken, 'GET', '/announcements')).body[0].title, 'Привет всем');

  // Every admin action is audited.
  const log = (await call(boss.token, 'GET', '/admin/log')).body;
  const actions = log.items.map((i) => i.action);
  for (const a of ['user.update', 'report.delete_ban', 'user.login_as', 'settings.update', 'announcement.create', 'user.bulk_approve']) {
    assert.ok(actions.includes(a), `missing ${a}`);
  }
});

test('login lockout after repeated failures', async () => {
  await register('Лок', 'lock@t.dev');
  for (let i = 0; i < 5; i++) await call(null, 'POST', '/auth/login', { email: 'lock@t.dev', password: 'wrong' });
  const locked = await call(null, 'POST', '/auth/login', { email: 'lock@t.dev', password: 'secret1' });
  assert.equal(locked.status, 429);
});
