import { fileURLToPath } from 'node:url';
import { db, q, tx } from './db.js';
import { hashPassword } from './auth.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { uploadsDir } from './uploads.js';
import { renderWav, DEMO_TRACKS } from './demoAudio.js';

const PEOPLE = [
  ['Олексій', 'Коваленко', 'Київ', 'Кава, код і велосипед'],
  ['Марія', 'Шевченко', 'Львів', 'Фотографую місто ☕'],
  ['Дмитро', 'Бондаренко', 'Харків', 'Frontend-розробник'],
  ['Анна', 'Мельник', 'Одеса', 'Подорожую й пишу про це'],
  ['Іван', 'Ткаченко', 'Дніпро', 'Музика — це все'],
  ['Катерина', 'Кравченко', 'Київ', 'Дизайнерка інтерфейсів'],
  ['Сергій', 'Олійник', 'Вінниця', 'Бігаю марафони'],
  ['Ольга', 'Шевчук', 'Ужгород', 'Гори, сонце, йога'],
  ['Микита', 'Поліщук', 'Запоріжжя', 'Граю в CS і вчу Rust'],
  ['Поліна', 'Бойко', 'Львів', 'Читаю по книжці на тиждень'],
  ['Артем', 'Лисенко', 'Полтава', ''],
];

const GROUPS = [
  ['Glendale — офіційна спільнота', 'Новини й оновлення соціальної мережі Glendale. Тут ми розповідаємо про нові функції.'],
  ['Розробники UA', 'Усе про розробку: JavaScript, Rust, Go, бази даних і трохи мемів.'],
  ['Подорожі Україною', 'Гарні місця нашої країни: маршрути, поради й фотографії.'],
  ['Гарна музика', 'Ділимося треками, які варто послухати.'],
];

const POSTS = [
  'Нарешті дістався Карпат. Гори, смереки й тиша — найкращий відпочинок за останній рік 🌲',
  'Хтось знає гарну кав’ярню біля центру? Хочеться попрацювати з ноутбуком у затишному місці.',
  'Сьогодні пробіг свої перші 21 км! Напівмарафон підкорено 🏃‍♂️',
  'Перечитую «Тигроловів» Багряного. Щоразу знаходжу щось нове.',
  'Випустили нову версію нашого застосунку. Працює вдвічі швидше, дякуємо всім, хто тестував!',
  'Який фільм подивитися на вихідних? Пропонуйте в коментарях 🎬',
  'Львів сьогодні здивував — сонце цілий день! Гуляли центром до самого вечора.',
  'Вчу Rust третій тиждень. Borrow checker поки перемагає, але я не здаюся 🦀',
  'Зібрала плейлист для довгих поїздок. Кому скинути?',
  'Хто йде на концерт у суботу? Збираймося компанією!',
  'Приготувала сирники за бабусиним рецептом. Ділюся: сир, яйце, трохи борошна — і жодної манки.',
  'Порада дня: робіть бекапи. Просто робіть бекапи.',
];

const GROUP_POSTS = [
  [0, 'Ласкаво просимо до Glendale! Ми зробили соцмережу, яка працює миттєво: повідомлення приходять у реальному часі, стрічка підвантажується сама, а темна тема вмикається одним натисканням.'],
  [0, 'Нове: тепер можна ділитися дописами, залишати коментарі й відзначати те, що сподобалося. Спробуйте!'],
  [1, 'Опитування: на чому пишете бекенд у 2026 році? Node.js, Go, Rust чи щось інше? Пишіть у коментарях.'],
  [1, 'SQLite у продакшені — це нормально. Для більшості проєктів її вистачить із головою.'],
  [2, 'Топ-5 місць для осінньої подорожі: Карпати, Кам’янець-Подільський, Шацькі озера, Одеса та Хортиця.'],
  [3, 'Трек дня — вмикайте голосніше й гарного вам вечора 🎧'],
];

const COMMENTS = ['Круто!', 'Згоден 👍', 'Дуже цікаво, розкажи докладніше', 'Ахаха, життєво', 'Супер!', 'Теж хочу', 'Дякую, що поділився', '🔥🔥🔥'];

const DIALOG = [
  [1, 'Привіт! Як справи?'],
  [0, 'Привіт! Чудово, щойно повернувся з поїздки'],
  [1, 'О, куди їздив?'],
  [0, 'У Карпати, виклав фотки на стіну'],
  [1, 'Уже подивилася, дуже гарно! Теж хочу туди 😍'],
];

export function seed({ reset = false } = {}) {
  if (reset) {
    for (const t of ['group_requests', 'chat_messages', 'chat_members', 'chats', 'playlist_tracks', 'playlists', 'user_tracks', 'tracks', 'admin_log', 'reports', 'announcements', 'notifications', 'photos', 'messages', 'comments', 'likes', 'posts', 'group_members', 'groups', 'friend_requests', 'friends', 'sessions', 'users']) {
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
    users.push(Number(insUser.run('Демо', 'Користувач', 'demo@glendale.app', hash, 'Пробую Glendale 🚀', 'Київ', 'Це демо-акаунт. Пароль: demo123', '1998-05-17', start, Date.now()).lastInsertRowid));
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
      { text: 'Всім привіт! Це мій перший запис у Glendale 👋', author: demo, group: null },
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
      others[1], others[1], 'Чудова новина!', postIds[0], tick(),
    );

    const insMsg = q('INSERT INTO messages (from_id, to_id, text, is_read, created_at) VALUES (?, ?, ?, ?, ?)');
    let mt = Date.now() - 2 * 60 * 60 * 1000;
    DIALOG.forEach(([fromOther, text], i) => {
      const [from, to] = fromOther ? [others[1], demo] : [demo, others[1]];
      insMsg.run(from, to, text, i === DIALOG.length - 1 ? 0 : 1, (mt += 4 * 60 * 1000));
    });
    insMsg.run(others[0], demo, 'Привіт! Завтра зустріч у силі?', 1, Date.now() - DAY);
    insMsg.run(demo, others[0], 'Так, о 19:00 біля метро', 1, Date.now() - DAY + 5 * 60 * 1000);
    insMsg.run(others[2], demo, 'Глянь, який я баг знайшов 😂', 0, Date.now() - 30 * 60 * 1000);

    const insNotif = q('INSERT INTO notifications (user_id, actor_id, type, post_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const demoPost = q("SELECT id FROM posts WHERE author_id = ? AND owner_type = 'user' ORDER BY id DESC").get(demo);
    if (demoPost) {
      insNotif.run(demo, others[3], 'like', demoPost.id, '', Date.now() - 3 * 60 * 60 * 1000);
      insNotif.run(demo, others[4], 'comment', demoPost.id, 'Привіт! Ласкаво просимо 🙂', Date.now() - 2 * 60 * 60 * 1000);
    }
    insNotif.run(demo, others[8], 'friend_request', null, '', Date.now() - DAY);

    // Staff accounts and admin-panel sample data.
    const levelId = (type) => q('SELECT id FROM levels WHERE type = ? ORDER BY id LIMIT 1').get(type).id;
    db.exec(`UPDATE users SET level_id = ${levelId('user')} WHERE level_id IS NULL OR level_id NOT IN (SELECT id FROM levels)`);
    const adminId = Number(
      insUser.run('Адмін', 'Glendale', 'admin@glendale.app', hashPassword('admin123'), 'Адміністратор мережі', 'Київ', '', '', start, Date.now()).lastInsertRowid,
    );
    const modId = Number(
      insUser.run('Модератор', 'Glendale', 'moderator@glendale.app', hash, 'Стежу за порядком', 'Харків', '', '', start, Date.now() - DAY).lastInsertRowid,
    );
    q('UPDATE users SET level_id = ?, verified = 1 WHERE id = ?').run(levelId('superadmin'), adminId);
    q('UPDATE users SET level_id = ?, verified = 1 WHERE id = ?').run(levelId('moderator'), modId);
    q('UPDATE users SET verified = 1 WHERE id = ?').run(others[1]);
    // One member waiting for approval, one banned.
    const pendingId = Number(insUser.run('Новий', 'Учасник', 'pending@glendale.app', hash, '', 'Чернігів', '', '', Date.now() - 3600_000, Date.now() - 3600_000).lastInsertRowid);
    q('UPDATE users SET approved = 0, level_id = ? WHERE id = ?').run(levelId('user'), pendingId);
    q('UPDATE users SET enabled = 0 WHERE id = ?').run(others[10]);

    q('INSERT INTO announcements (title, body, author_id, active, created_at) VALUES (?, ?, ?, 1, ?)').run(
      'Ласкаво просимо до Glendale!',
      'Ми запустили нову версію мережі: миттєві повідомлення, спільноти, музика й темна тема. Поскаржитися на порушення можна через меню «…» біля допису — модератори розберуться.',
      adminId,
      Date.now() - 2 * DAY,
    );
    const insReport = q('INSERT INTO reports (reporter_id, target_type, target_id, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    insReport.run(others[2], 'post', postIds[3], 'spam', 'Схоже на рекламу', Date.now() - 5 * 3600_000);
    insReport.run(others[5], 'post', postIds[3], 'spam', '', Date.now() - 4 * 3600_000);
    insReport.run(demo, 'user', others[9], 'fake', 'Чужі фотографії в профілі', Date.now() - 2 * 3600_000);

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
    // A closed community: the demo user's request waits for approval, and one request waits in the demo user's own group.
    q("UPDATE groups SET privacy = 'closed' WHERE id = ?").run(groupIds[3]);
    q('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupIds[3], demo);
    q('INSERT OR IGNORE INTO group_requests (group_id, user_id, created_at) VALUES (?, ?, ?)').run(groupIds[3], demo, Date.now() - DAY);
    q("UPDATE groups SET privacy = 'closed' WHERE id = ?").run(groupIds[0]);
    q('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupIds[0], others[7]);
    q('INSERT OR IGNORE INTO group_requests (group_id, user_id, created_at) VALUES (?, ?, ?)').run(groupIds[0], others[7], Date.now() - 3600_000);

    // Demo group chat with the demo user and three friends.
    const chatStart = Date.now() - 3 * 3600_000;
    const chatId = Number(q('INSERT INTO chats (title, owner_id, created_at) VALUES (?, ?, ?)').run('Похід у Карпати 🏔', others[0], chatStart).lastInsertRowid);
    q("INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(chatId, others[0], chatStart);
    for (const uid of [demo, others[1], others[3]]) q('INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)').run(chatId, uid, chatStart);
    const insChat = q('INSERT INTO chat_messages (chat_id, from_id, kind, text, created_at) VALUES (?, ?, ?, ?, ?)');
    let ct = chatStart;
    insChat.run(chatId, others[0], 'system', JSON.stringify({ k: '{actor} создал(а) беседу «{title}»', p: { actor: `${PEOPLE[0][0]} ${PEOPLE[0][1]}`, title: 'Похід у Карпати 🏔' } }), ct);
    const chatLines = [
      [others[0], 'Всім привіт! Пропоную в суботу виїхати о 7:00'],
      [others[1], 'Я за! Беру термос і бутерброди ☕'],
      [others[3], 'А хто за кермом?'],
      [demo, 'Можу я, у мене 5 місць'],
      [others[0], 'Супер, тоді зустрічаємось біля метро'],
    ];
    const chatIds = chatLines.map(([from, text]) => Number(insChat.run(chatId, from, 'text', text, (ct += 9 * 60_000)).lastInsertRowid));
    q('UPDATE chat_members SET last_read_id = ? WHERE chat_id = ?').run(chatIds[chatIds.length - 1], chatId);
    q('UPDATE chat_members SET last_read_id = ? WHERE chat_id = ? AND user_id = ?').run(chatIds[2], chatId, demo);

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
