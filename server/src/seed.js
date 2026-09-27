import { fileURLToPath } from 'node:url';
import { db, q, tx } from './db.js';
import { hashPassword } from './auth.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { uploadsDir } from './uploads.js';
import { renderWav, DEMO_TRACKS } from './demoAudio.js';

const PEOPLE = [
  ['Алексей', 'Смирнов', 'Санкт-Петербург', 'Кофе, код и велосипед'],
  ['Мария', 'Иванова', 'Москва', 'Фотографирую город ☕'],
  ['Дмитрий', 'Кузнецов', 'Казань', 'Frontend-разработчик'],
  ['Анна', 'Попова', 'Новосибирск', 'Путешествую и пишу об этом'],
  ['Иван', 'Соколов', 'Екатеринбург', 'Музыка — это всё'],
  ['Екатерина', 'Лебедева', 'Москва', 'Дизайнер интерфейсов'],
  ['Сергей', 'Козлов', 'Нижний Новгород', 'Бегаю марафоны'],
  ['Ольга', 'Новикова', 'Сочи', 'Море, солнце, йога'],
  ['Никита', 'Морозов', 'Самара', 'Играю в CS и учу Rust'],
  ['Полина', 'Волкова', 'Санкт-Петербург', 'Читаю по книге в неделю'],
  ['Артём', 'Павлов', 'Краснодар', ''],
];

const GROUPS = [
  ['Glendale — официальное сообщество', 'Новости и обновления социальной сети Glendale. Здесь мы рассказываем о новых функциях.'],
  ['Лентач для программистов', 'Всё о разработке: JavaScript, Rust, Go, базы данных и немного мемов.'],
  ['Путешествия по России', 'Красивые места нашей страны: маршруты, советы и фотографии.'],
  ['Хорошая музыка', 'Делимся треками, которые стоит послушать.'],
];

const POSTS = [
  'Наконец-то добрался до Карелии. Озёра, сосны и тишина — лучший отдых за последний год 🌲',
  'Кто-нибудь знает хорошую кофейню рядом с центром? Хочется поработать с ноутбуком в уютном месте.',
  'Сегодня пробежал свои первые 21 км! Полумарафон покорён 🏃‍♂️',
  'Перечитываю «Мастера и Маргариту». С каждым разом нахожу что-то новое.',
  'Выпустили новую версию нашего приложения. Работает в два раза быстрее, спасибо всем, кто тестировал!',
  'Какой фильм посмотреть на выходных? Предлагайте в комментариях 🎬',
  'Питер сегодня удивил — солнце весь день! Гуляли по набережной до самого вечера.',
  'Учу Rust третью неделю. Borrow checker пока побеждает, но я не сдаюсь 🦀',
  'Собрала плейлист для долгих поездок. Кому скинуть?',
  'Кто идёт на концерт в субботу? Давайте соберёмся компанией!',
  'Приготовила сырники по бабушкиному рецепту. Делюсь: творог, яйцо, немного муки и никакой манки.',
  'Совет дня: делайте бэкапы. Просто делайте бэкапы.',
];

const GROUP_POSTS = [
  [0, 'Добро пожаловать в Glendale! Мы сделали соцсеть, которая работает мгновенно: сообщения приходят в реальном времени, лента подгружается сама, а тёмная тема включается одним нажатием.'],
  [0, 'Новое: теперь можно делиться записями, оставлять комментарии и отмечать понравившееся. Попробуйте!'],
  [1, 'Опрос: на чём пишете бэкенд в 2026 году? Node.js, Go, Rust или что-то ещё? Пишите в комментариях.'],
  [1, 'SQLite в проде — это нормально. Для большинства проектов её хватит с головой.'],
  [2, 'Топ-5 мест для поездки осенью: Алтай, Карелия, Байкал, Калининград и Дагестан.'],
  [3, 'Трек дня — включайте погромче и хорошего вам вечера 🎧'],
];

const COMMENTS = ['Круто!', 'Согласен 👍', 'Очень интересно, расскажи подробнее', 'Ахаха, жиза', 'Супер!', 'Тоже хочу', 'Спасибо, что поделился', '🔥🔥🔥'];

const DIALOG = [
  [1, 'Привет! Как дела?'],
  [0, 'Привет! Отлично, только вернулся из поездки'],
  [1, 'О, куда ездил?'],
  [0, 'В Карелию, выложил фотки на стену'],
  [1, 'Уже посмотрела, очень красиво! Тоже хочу туда 😍'],
];

export function seed({ reset = false } = {}) {
  if (reset) {
    for (const t of ['playlist_tracks', 'playlists', 'user_tracks', 'tracks', 'admin_log', 'reports', 'announcements', 'notifications', 'photos', 'messages', 'comments', 'likes', 'posts', 'group_members', 'groups', 'friend_requests', 'friends', 'sessions', 'users']) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec('DELETE FROM sqlite_sequence');
  }
  if (q('SELECT COUNT(*) AS c FROM users').get().c > 0) return false;

  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.now() - 20 * DAY;
  let clock = start;
  const tick = (ms = 37 * 60 * 1000) => (clock += ms + Math.floor(Math.random() * ms));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  tx(() => {
    const hash = hashPassword('demo123');
    const insUser = q(
      'INSERT INTO users (first_name, last_name, email, password_hash, status, city, bio, birthday, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const users = [];
    users.push(Number(insUser.run('Демо', 'Пользователь', 'demo@glendale.app', hash, 'Пробую Glendale 🚀', 'Москва', 'Это демо-аккаунт. Пароль: demo123', '1998-05-17', start, Date.now()).lastInsertRowid));
    PEOPLE.forEach(([first, last, city, status], i) => {
      const seen = Date.now() - (i % 3 === 0 ? 60_000 : (i + 1) * 3 * 60 * 60 * 1000);
      users.push(Number(insUser.run(first, last, `user${i + 1}@glendale.app`, hash, status, city, '', `199${i % 10}-0${(i % 9) + 1}-1${i % 9}`, start, seen).lastInsertRowid));
    });

    const addFriends = (a, b) => {
      q('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(a, b, start);
      q('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(b, a, start);
    };
    const [demo, ...others] = users;
    others.slice(0, 7).forEach((u) => addFriends(demo, u));
    for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) if ((i + j) % 3 === 0) addFriends(others[i], others[j]);
    // Incoming friend requests for the demo account.
    q('INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)').run(others[8], demo, Date.now() - DAY);
    q('INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)').run(others[9], demo, Date.now() - DAY / 2);

    const groupIds = GROUPS.map(([name, description], i) => {
      const owner = i === 0 ? demo : others[i];
      const gid = Number(q('INSERT INTO groups (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)').run(name, description, owner, start).lastInsertRowid);
      q("INSERT INTO group_members (group_id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)").run(gid, owner, start);
      users.forEach((u, k) => {
        if (u !== owner && (k + i) % 2 === 0) q("INSERT INTO group_members (group_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)").run(gid, u, start);
      });
      return gid;
    });

    const insPost = q(
      'INSERT INTO posts (author_id, owner_type, owner_id, from_group, text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const postIds = [];
    const all = [
      ...POSTS.map((text, i) => ({ text, author: users[(i % (users.length - 1)) + 1], group: null })),
      ...GROUP_POSTS.map(([gi, text]) => ({ text, author: q('SELECT owner_id FROM groups WHERE id = ?').get(groupIds[gi]).owner_id, group: groupIds[gi] })),
      { text: 'Всем привет! Это моя первая запись в Glendale 👋', author: demo, group: null },
    ].sort(() => Math.random() - 0.5);

    for (const p of all) {
      const t = tick(4 * 60 * 60 * 1000);
      const id = p.group
        ? Number(insPost.run(p.author, 'group', p.group, 1, p.text, t).lastInsertRowid)
        : Number(insPost.run(p.author, 'user', p.author, 0, p.text, t).lastInsertRowid);
      postIds.push(id);
      users.forEach((u, k) => {
        if ((k * 7 + id) % 3 === 0) q('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(id, u, t + 1000);
      });
      const n = id % 4;
      for (let c = 0; c < n; c++) {
        q('INSERT INTO comments (post_id, author_id, text, created_at) VALUES (?, ?, ?, ?)').run(id, pick(users), pick(COMMENTS), t + (c + 1) * 600_000);
      }
    }

    // A repost by one of the friends.
    q("INSERT INTO posts (author_id, owner_type, owner_id, text, repost_of, created_at) VALUES (?, 'user', ?, ?, ?, ?)").run(
      others[1], others[1], 'Отличная новость!', postIds[0], tick(),
    );

    const insMsg = q('INSERT INTO messages (from_id, to_id, text, is_read, created_at) VALUES (?, ?, ?, ?, ?)');
    let mt = Date.now() - 2 * 60 * 60 * 1000;
    DIALOG.forEach(([fromOther, text], i) => {
      const [from, to] = fromOther ? [others[1], demo] : [demo, others[1]];
      insMsg.run(from, to, text, i === DIALOG.length - 1 ? 0 : 1, (mt += 4 * 60 * 1000));
    });
    insMsg.run(others[0], demo, 'Привет! Завтра в силе встреча?', 1, Date.now() - DAY);
    insMsg.run(demo, others[0], 'Да, в 19:00 у метро', 1, Date.now() - DAY + 5 * 60 * 1000);
    insMsg.run(others[2], demo, 'Глянь, какой я баг нашёл 😂', 0, Date.now() - 30 * 60 * 1000);

    const insNotif = q('INSERT INTO notifications (user_id, actor_id, type, post_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const demoPost = q("SELECT id FROM posts WHERE author_id = ? AND owner_type = 'user' ORDER BY id DESC").get(demo);
    if (demoPost) {
      insNotif.run(demo, others[3], 'like', demoPost.id, '', Date.now() - 3 * 60 * 60 * 1000);
      insNotif.run(demo, others[4], 'comment', demoPost.id, 'Привет! Добро пожаловать 🙂', Date.now() - 2 * 60 * 60 * 1000);
    }
    insNotif.run(demo, others[8], 'friend_request', null, '', Date.now() - DAY);

    // Staff accounts and admin-panel sample data.
    const levelId = (type) => q('SELECT id FROM levels WHERE type = ? ORDER BY id LIMIT 1').get(type).id;
    db.exec(`UPDATE users SET level_id = ${levelId('user')} WHERE level_id IS NULL OR level_id NOT IN (SELECT id FROM levels)`);
    const adminId = Number(
      insUser.run('Админ', 'Glendale', 'admin@glendale.app', hashPassword('admin123'), 'Администратор сети', 'Москва', '', '', start, Date.now()).lastInsertRowid,
    );
    const modId = Number(
      insUser.run('Модератор', 'Glendale', 'moderator@glendale.app', hash, 'Слежу за порядком', 'Казань', '', '', start, Date.now() - DAY).lastInsertRowid,
    );
    q('UPDATE users SET level_id = ?, verified = 1 WHERE id = ?').run(levelId('superadmin'), adminId);
    q('UPDATE users SET level_id = ?, verified = 1 WHERE id = ?').run(levelId('moderator'), modId);
    q('UPDATE users SET verified = 1 WHERE id = ?').run(others[1]);
    // One member waiting for approval, one banned.
    const pendingId = Number(insUser.run('Новый', 'Участник', 'pending@glendale.app', hash, '', 'Тверь', '', '', Date.now() - 3600_000, Date.now() - 3600_000).lastInsertRowid);
    q('UPDATE users SET approved = 0, level_id = ? WHERE id = ?').run(levelId('user'), pendingId);
    q('UPDATE users SET enabled = 0 WHERE id = ?').run(others[10]);

    q('INSERT INTO announcements (title, body, author_id, active, created_at) VALUES (?, ?, ?, 1, ?)').run(
      'Добро пожаловать в Glendale!',
      'Мы запустили новую версию сети: мгновенные сообщения, сообщества и тёмная тема. Пожалуйтесь на нарушение через меню «…» у записи — модераторы разберутся.',
      adminId,
      Date.now() - 2 * DAY,
    );
    const insReport = q('INSERT INTO reports (reporter_id, target_type, target_id, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    insReport.run(others[2], 'post', postIds[3], 'spam', 'Похоже на рекламу', Date.now() - 5 * 3600_000);
    insReport.run(others[5], 'post', postIds[3], 'spam', '', Date.now() - 4 * 3600_000);
    insReport.run(demo, 'user', others[9], 'fake', 'Чужие фотографии в профиле', Date.now() - 2 * 3600_000);

    // Demo music: synthesized tracks in a few libraries, a playlist and a post with a track.
    const trackIds = DEMO_TRACKS.map((d, i) => {
      const { buffer, duration } = renderWav({ chords: d.chords, bpm: d.bpm, wave: d.wave, bars: 12 });
      const name = `${crypto.randomBytes(12).toString('hex')}.wav`;
      fs.writeFileSync(path.join(uploadsDir, name), buffer);
      const owner = others[i % others.length];
      const id = Number(
        q('INSERT INTO tracks (owner_id, title, artist, album, duration, file, size, plays, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          owner, d.title, d.artist, d.album, duration, `/uploads/${name}`, buffer.length, 40 - i * 7, start + i * DAY,
        ).lastInsertRowid,
      );
      q('INSERT INTO user_tracks (user_id, track_id, added_at) VALUES (?, ?, ?)').run(owner, id, start + i * DAY);
      return id;
    });
    trackIds.forEach((id, i) => q('INSERT INTO user_tracks (user_id, track_id, added_at) VALUES (?, ?, ?)').run(demo, id, start + (i + 5) * DAY));
    const pl = Number(q('INSERT INTO playlists (owner_id, title, description, created_at) VALUES (?, ?, ?, ?)').run(demo, 'Для роботи', 'Спокійна музика без слів', start).lastInsertRowid);
    trackIds.forEach((id, i) => q('INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)').run(pl, id, i + 1, start));
    q("INSERT INTO posts (author_id, owner_type, owner_id, text, audio_id, created_at) VALUES (?, 'user', ?, ?, ?, ?)").run(
      others[4], others[4], 'Записав новий трек — послухайте 🎧', trackIds[1], Date.now() - 5 * 3600_000,
    );
  });
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({ reset: true });
  console.log('База заполнена демо-данными. Вход: demo@glendale.app / demo123, админ: admin@glendale.app / admin123');
}
