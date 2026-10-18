import { ic, avatar, who, me, people, posts, thread, quests, communities, page } from './common.mjs';

// Варіант 3 — Material Design 3 (Google): тональні поверхні, навігаційна рейка, FAB, чипи, нижня панель з «пігулкою».
// Палітра — схема M3, згенерована від індиго (#4F46E5) як seed-кольору.
const css = `
.m{--p:#4f46e5;--onp:#fff;--pc:#e1e0ff;--onpc:#0f0a5c;--sc:#e3e1f9;--onsc:#1a1a2c;--tc:#ffd8ee;--bg:#fbf8ff;--s1:#f5f2fd;--s2:#efecf8;--s3:#e9e6f3;--on:#1b1b21;--onv:#46464f;--ol:#c7c5d0;--olv:#777680;background:var(--bg);color:var(--on);font-size:14px;letter-spacing:.01em}
.m .rail{width:80px;align-items:center;padding-top:12px;gap:12px;background:var(--bg)}
.m .ri{align-items:center;gap:4px;font-size:12px;font-weight:500;color:var(--onv)}
.m .ri .ind{width:56px;height:32px;border-radius:16px;display:grid;place-items:center;position:relative}
.m .ri.on .ind{background:var(--sc);color:var(--onsc)}
.m .ri.on{color:var(--on);font-weight:700}
.m .fab{width:56px;height:56px;border-radius:16px;background:var(--pc);color:var(--onpc);display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2),0 4px 8px rgba(0,0,0,.08)}
.m .bdg{position:absolute;top:2px;left:30px;background:#ba1a1a;color:#fff;border-radius:8px;font-size:11px;font-weight:600;padding:0 5px;line-height:16px}
.m .bar{height:64px;padding:0 16px;gap:16px}
.m .sb{height:56px;border-radius:28px;background:var(--s3);padding:0 16px;gap:16px;color:var(--onv);font-size:16px}
.m .card{background:var(--s1);border-radius:12px;padding:16px}
.m .card.out{background:var(--bg);border:1px solid var(--ol)}
.m .card.fill{background:var(--s3)}
.m .chip{height:32px;border-radius:8px;border:1px solid var(--olv);padding:0 16px;gap:8px;font-weight:500;color:var(--onv)}
.m .chip.on{background:var(--sc);border-color:transparent;color:var(--onsc);padding-left:8px}
.m .tb{font-weight:500;color:var(--p);gap:8px;padding:10px 12px;border-radius:20px}
.m .tonal{background:var(--sc);color:var(--onsc);border-radius:20px;height:40px;padding:0 24px;font-weight:500}
.m .filled{background:var(--p);color:#fff;border-radius:20px;height:40px;padding:0 24px;font-weight:500}
.m .t-title{font-size:22px;font-weight:400}
.m .t-tm{font-size:16px;font-weight:500}
.m .lp{height:4px;border-radius:2px;background:var(--sc);overflow:hidden}
.m .lp i{display:block;height:100%;background:var(--p);border-radius:2px}
.m .li{padding:8px 16px;gap:16px;min-height:72px}
.m .mut{color:var(--onv)}
`;

const actions = (p, i) => `<div class="row" style="gap:4px;margin-top:8px;margin-left:-12px">
  <span class="row tb" style="${i === 0 ? 'background:var(--pc);color:var(--onpc)' : 'color:var(--onv)'}">${ic('thumbs-up', 18, i === 0 ? 'fill:currentColor' : '')}${p.likes}</span>
  <span class="row tb" style="color:var(--onv)">${ic('message-square', 18)}${p.comments}</span>
  <span class="row tb" style="color:var(--onv)">${ic('repeat-2', 18)}${p.reposts}</span>
  <span class="grow"></span><span class="row tb" style="color:var(--onv)">${ic('bookmark', 18)}</span><span class="row tb" style="color:var(--onv)">${ic('share-2', 18)}</span></div>`;

const card = (p, i) => {
    const u = who(p.who);
    let extra = '';
    if (p.poll)
        extra = `<div class="col" style="gap:8px;margin-top:12px">${p.poll.map(([o, v], j) => `<div class="row" style="gap:12px;height:48px;border-radius:12px;padding:0 16px;background:${j === 0 ? 'var(--pc)' : 'var(--s3)'};color:${j === 0 ? 'var(--onpc)' : 'var(--on)'}">${ic(j === 0 ? 'circle-check' : 'circle', 20)}<span class="grow" style="font-weight:${j === 0 ? 600 : 400}">${o}</span><b>${v}%</b></div>`).join('')}<span class="mut" style="font-size:12px">${p.votes} голосів · залишилось 2 дні</span></div>`;
    if (p.track)
        extra = `<div class="row" style="gap:16px;margin-top:12px;background:var(--s3);border-radius:12px;padding:12px"><div style="width:56px;height:56px;border-radius:8px;background:var(--tc);color:#5d1149;display:grid;place-items:center">${ic('music', 24)}</div><div class="col grow"><span class="t-tm">${p.track.title}</span><span class="mut">${p.track.artist} · ${p.track.dur}</span></div><div style="width:48px;height:48px;border-radius:16px;background:var(--p);color:#fff;display:grid;place-items:center">${ic('play', 22, 'fill:#fff')}</div></div>`;
    return `<div class="card ${i === 1 ? 'out' : ''}" style="${i === 1 ? '' : ''}"><div class="row" style="gap:12px">${avatar(u, 40)}<div class="col grow"><span class="t-tm">${u.name}${u.verified ? ic('badge-check', 16, 'color:var(--p);vertical-align:-2px;margin-left:4px') : ''}</span><span class="mut" style="font-size:12px">${p.where ? p.where + ' · ' : ''}${p.time} тому</span></div>${ic('ellipsis-vertical', 20, 'color:var(--onv)')}</div><div style="font-size:16px;line-height:24px;margin-top:12px;letter-spacing:.03em">${p.text}${p.tag ? ` <span style="color:var(--p);font-weight:500">${p.tag}</span>` : ''}</div>${extra}${actions(p, i)}</div>`;
};

const railItems = [
    ['house', 'Головна', 1],
    ['message-square', 'Чати', 0, 3],
    ['users', 'Спільноти'],
    ['film', 'Кіно'],
    ['music', 'Музика'],
    ['gamepad-2', 'Ігри'],
    ['bell', 'Сповіщ.', 0, 29],
];

const desktop = `<div class="m row" style="height:100%;align-items:stretch">
  <div class="col rail">${ic('menu', 24, 'margin:8px 0')}<div class="fab">${ic('pencil', 24)}</div><div style="height:16px"></div>${railItems.map(([n, l, on, b]) => `<div class="col ri ${on ? 'on' : ''}"><div class="ind">${ic(n, 24, on ? 'fill:var(--sc)' : '')}${b ? `<span class="bdg">${b}</span>` : ''}</div>${l}</div>`).join('')}</div>
  <div class="col grow" style="background:var(--s1);border-radius:16px 0 0 0;margin-top:8px;overflow:hidden">
    <div class="row bar" style="height:80px;padding:0 24px"><span style="font-size:22px;font-weight:500;width:220px">GameCon</span><div class="row sb grow" style="max-width:720px">${ic('search', 24)}<span class="grow">Пошук людей, ігор, кіно, серверів</span>${ic('mic', 24)}</div><span class="grow"></span>${ic('circle-help', 24, 'color:var(--onv)')}${ic('settings', 24, 'color:var(--onv);margin-left:8px')}${avatar(me, 32, 'margin-left:8px')}</div>
    <div class="row" style="gap:24px;padding:0 24px;align-items:flex-start;overflow:hidden;flex:1">
      <div class="col" style="gap:12px;width:280px">
        <div class="card" style="background:var(--bg)"><div class="row" style="gap:12px">${avatar(me, 56)}<div class="col"><span class="t-tm" style="font-size:18px">Марк</span><span class="mut">@mark · Рівень 12</span></div></div><div class="lp" style="margin-top:16px"><i style="width:62%"></i></div><div class="row mut" style="justify-content:space-between;font-size:12px;margin-top:6px"><span>1 240 / 2 000 XP</span><span>Сезон 3</span></div></div>
        <div class="card" style="background:var(--bg);padding:8px 0"><div class="mut" style="padding:8px 16px;font-weight:500">Мої спільноти</div>${communities.map((c) => `<div class="row li" style="min-height:56px">${avatar(c, 40, 'border-radius:12px')}<span class="grow ell" style="font-size:16px">${c.name}</span>${c.unread ? `<span class="mut" style="font-size:12px">${c.unread}</span>` : ''}</div>`).join('')}</div>
      </div>
      <div class="col" style="gap:12px;width:600px">
        <div class="card" style="background:var(--bg)"><div class="row" style="gap:12px">${avatar(me, 40)}<div class="row grow" style="height:48px;border-radius:24px;border:1px solid var(--olv);padding:0 16px;color:var(--onv);font-size:16px">Що нового, Марк?</div></div><div class="row" style="gap:8px;margin-top:12px;padding-left:52px">${[['image', 'Фото'], ['chart-no-axes-column', 'Опитування'], ['music', 'Музика'], ['eye-off', 'Спойлер']].map(([n, l]) => `<span class="row chip" style="gap:8px;padding:0 12px">${ic(n, 18, 'color:var(--p)')}${l}</span>`).join('')}</div></div>
        <div class="row" style="gap:8px"><span class="row chip on">${ic('check', 18)}Друзі</span><span class="row chip">Рекомендації</span><span class="row chip">Спільноти</span><span class="row chip">Країна</span><span class="grow"></span><span class="row chip" style="border:none">${ic('languages', 18)}Усі мови${ic('chevron-down', 18)}</span></div>
        ${posts.map(card).join('')}
      </div>
      <div class="col" style="gap:12px;width:320px">
        <div class="card fill" style="background:var(--pc);color:var(--onpc)"><div class="row" style="gap:8px;font-weight:500">${ic('calendar', 20)}Завтра, 17:00</div><div style="font-size:22px;margin-top:8px">Тижневі збори сім’ї</div><div style="opacity:.8;margin-top:4px">[SCL] Scaletta Family · 12 підуть</div><div class="row" style="gap:8px;margin-top:16px"><span class="row filled">Піду</span><span class="row tonal" style="background:transparent;border:1px solid var(--onpc)">Нагадати</span></div></div>
        <div class="card" style="background:var(--bg)"><div class="row" style="justify-content:space-between"><span class="t-tm">Завдання дня</span><span style="color:var(--p);font-weight:500">Сезон</span></div>${quests.map(([t, a, b, xp]) => `<div style="margin-top:16px"><div class="row" style="justify-content:space-between"><span>${t}</span><span class="mut" style="font-size:12px">${a}/${b} · +${xp} XP</span></div><div class="lp" style="margin-top:8px"><i style="width:${(a / b) * 100}%"></i></div></div>`).join('')}</div>
        <div class="card" style="background:var(--bg);padding:8px 0"><div class="t-tm" style="padding:8px 16px">Зараз онлайн</div>${['sofia', 'maks', 'ivan'].map((k) => `<div class="row li" style="min-height:56px"><div style="position:relative">${avatar(people[k], 40)}<span style="position:absolute;right:0;bottom:0;width:12px;height:12px;border-radius:50%;background:#1e8e3e;border:2px solid var(--bg)"></span></div><div class="col grow"><span style="font-size:16px">${people[k].name}</span><span class="mut" style="font-size:13px">${k === 'sofia' ? 'Counter-Strike 2' : k === 'maks' ? 'Дивиться Sintel' : 'Слухає музику'}</span></div></div>`).join('')}</div>
      </div>
    </div>
  </div>
</div>`;

const navbar = (active) => `<div class="row" style="height:80px;background:var(--s2);justify-content:space-around;padding-bottom:4px">${[['house', 'Головна'], ['message-square', 'Чати', 3], ['users', 'Спільноти'], ['clapperboard', 'Кіно'], ['user', 'Профіль']].map(([n, l, b], i) => `<div class="col ri ${i === active ? 'on' : ''}"><div class="ind">${ic(n, 24, i === active ? 'fill:var(--sc)' : '')}${b ? `<span class="bdg">${b}</span>` : ''}</div>${l}</div>`).join('')}</div>`;

const mobileFeed = `<div class="m col" style="height:100%">
  <div class="row bar">${ic('menu', 24)}<span class="grow" style="font-size:22px">GameCon</span>${ic('search', 24)}<span style="position:relative">${ic('bell', 24)}<span class="bdg" style="left:12px;top:-6px">29</span></span>${avatar(me, 32)}</div>
  <div class="row" style="gap:8px;padding:4px 16px 12px;overflow:hidden"><span class="row chip on">${ic('check', 18)}Друзі</span><span class="row chip">Рекомендації</span><span class="row chip">Спільноти</span><span class="row chip">Країна</span></div>
  <div class="col grow" style="gap:8px;padding:0 12px;overflow:hidden">
    <div class="card fill row" style="gap:16px;background:var(--pc);color:var(--onpc);padding:12px 16px">${ic('calendar', 24)}<div class="col grow"><b style="font-weight:500;font-size:16px">Тижневі збори сім’ї</b><span style="font-size:13px;opacity:.8">Завтра, 17:00 · Scaletta Family</span></div><span class="row filled" style="height:36px;padding:0 16px">Піду</span></div>
    ${posts.map(card).join('')}
  </div>
  <div class="row" style="position:absolute;right:16px;bottom:96px;height:56px;border-radius:16px;background:var(--pc);color:var(--onpc);padding:0 20px;gap:12px;font-weight:500;font-size:16px;box-shadow:0 3px 6px rgba(0,0,0,.18)">${ic('pencil', 22)}Запис</div>
  ${navbar(0)}
</div>`;

const mobileChat = `<div class="m col" style="height:100%">
  <div class="row bar">${ic('arrow-left', 24)}${avatar(communities[0], 40)}<div class="col grow"><span style="font-size:16px;font-weight:500">[SCL] Scaletta Family</span><span class="mut" style="font-size:12px">48 учасників · 3 онлайн</span></div>${ic('phone', 24)}${ic('ellipsis-vertical', 24)}</div>
  <div class="col grow" style="justify-content:flex-end;padding:0 12px 8px;gap:2px;overflow:hidden">
    <div class="mut" style="text-align:center;font-size:12px;margin-bottom:8px">Сьогодні</div>
    ${thread
        .map((m, i) => {
            const mine = m.who === 'me';
            const u = who(m.who);
            const first = i === 0 || thread[i - 1].who !== m.who;
            return `<div class="row" style="gap:8px;align-items:flex-end;justify-content:${mine ? 'flex-end' : 'flex-start'};margin-top:${first ? 10 : 0}px">${!mine ? avatar(u, 32) : ''}<div class="col" style="max-width:76%;align-items:${mine ? 'flex-end' : 'flex-start'}">${!mine && first ? `<span style="font-size:12px;font-weight:500;color:var(--p);margin:0 0 3px 16px">${u.name}</span>` : ''}<div style="padding:10px 16px;border-radius:20px;font-size:15px;line-height:21px;background:${mine ? 'var(--p)' : 'var(--s3)'};color:${mine ? '#fff' : 'var(--on)'}">${m.text}</div><span class="mut" style="font-size:11px;margin:3px 12px 0">${m.time}${mine ? ' · ✓✓' : ''}</span></div></div>`;
        })
        .join('')}
  </div>
  <div class="row" style="gap:8px;padding:8px 12px 16px">${ic('circle-plus', 26, 'color:var(--p)')}<div class="row grow" style="height:48px;border-radius:24px;background:var(--s3);padding:0 16px;gap:12px;color:var(--onv);font-size:16px">${ic('smile', 22)}<span class="grow">Повідомлення</span>${ic('image', 22)}</div><div style="width:48px;height:48px;border-radius:16px;background:var(--pc);color:var(--onpc);display:grid;place-items:center">${ic('mic', 22)}</div></div>
</div>`;

export default page('Варіант 3 — Material 3', css, [
    ['desktop-feed', 'desktop', desktop],
    ['mobile-feed', 'mobile', mobileFeed],
    ['mobile-chat', 'mobile', mobileChat],
]);
