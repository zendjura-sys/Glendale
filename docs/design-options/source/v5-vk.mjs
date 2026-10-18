import { ic, avatar, who, me, people, posts, thread, quests, communities, chats, page } from './common.mjs';

// Варіант 5 — класична соцмережа (патерн VK / Facebook): світла тема, вузьке меню зліва текстом,
// стрічка карток по центру, віджети справа. Знайомий більшості аудиторії, найменше навчання.
const css = `
.v{--bg:#edeef0;--card:#fff;--line:#dce1e6;--tx:#000;--mut:#818c99;--acc:#4f46e5;--acc2:#eef0ff;--head:#fff;background:var(--bg);color:var(--tx);font-size:13px;line-height:1.4}
.v .hd{height:48px;background:var(--head);border-bottom:1px solid var(--line);padding:0 0 0 0}
.v .wrap{width:960px;margin:0 auto}
.v .card{background:var(--card);border-radius:12px;box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06)}
.v .mi{gap:10px;height:32px;padding:0 8px;border-radius:8px;font-size:13px}
.v .mi.on{background:#e5e7f0}
.v .mi svg{color:var(--acc)}
.v .cnt{margin-left:auto;background:#e5ebf1;color:#55677d;border-radius:9px;padding:0 6px;font-size:12px;line-height:18px}
.v .mut{color:var(--mut)}
.v .nm{color:#2a5885;font-weight:500}
.v .act{gap:6px;height:32px;padding:0 12px;border-radius:16px;background:#f0f2f5;color:#626d7a;font-weight:500}
.v .wh{font-weight:500;font-size:14px;padding:14px 16px 6px}
.v .btn{background:var(--acc);color:#fff;border-radius:8px;height:32px;padding:0 16px;font-weight:500;display:inline-flex;align-items:center}
.v .sbtn{background:var(--acc2);color:var(--acc);border-radius:8px;height:30px;padding:0 14px;font-weight:500;display:inline-flex;align-items:center}
.v .tabs{gap:4px;padding:8px}
.v .tb{height:32px;padding:0 12px;border-radius:8px;display:flex;align-items:center;font-weight:500;color:#626d7a}
.v .tb.on{background:#f0f2f5;color:#000}
`;

const menu = [
    ['user', 'Моя сторінка'],
    ['newspaper', 'Новини', 1],
    ['message-circle', 'Повідомлення', 0, 3],
    ['users', 'Друзі', 0, 4],
    ['shield', 'Спільноти'],
    ['image', 'Фотографії'],
    ['music', 'Музика'],
    ['film', 'Кіно'],
    ['crown', 'Сім’ї'],
    ['gamepad-2', 'Ігри'],
    ['server', 'Сервери GTA'],
    ['calendar', 'Події'],
];

const actions = (p, i) => `<div class="row" style="gap:8px;margin-top:12px"><span class="row act" style="${i === 0 ? 'background:#ffeef1;color:#e64646' : ''}">${ic('heart', 18, i === 0 ? 'fill:#e64646' : '')}${p.likes}</span><span class="row act">${ic('message-circle', 18)}${p.comments}</span><span class="row act">${ic('forward', 18)}${p.reposts}</span><span class="grow"></span><span class="row mut" style="gap:4px">${ic('eye', 16)}${p.views}</span></div>`;

const postCard = (p, i) => {
    const u = who(p.who);
    let extra = '';
    if (p.poll)
        extra = `<div style="margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:12px"><b style="font-weight:500">Анонімне опитування</b>${p.poll.map(([o, v], j) => `<div style="position:relative;height:34px;border-radius:8px;background:#f0f2f5;margin-top:8px;overflow:hidden"><i style="position:absolute;inset:0;width:${v}%;background:${j === 0 ? '#dfe1ff' : '#e5e7eb'}"></i><span class="row" style="position:relative;height:100%;padding:0 12px;justify-content:space-between;font-weight:${j === 0 ? 600 : 400}"><span>${o}</span><span>${v}%</span></span></div>`).join('')}<div class="mut" style="margin-top:8px">${p.votes} голосів</div></div>`;
    if (p.track)
        extra = `<div class="row" style="gap:12px;margin-top:10px;padding:8px;border-radius:10px;background:#f5f6f8"><div style="width:40px;height:40px;border-radius:50%;background:var(--acc);color:#fff;display:grid;place-items:center">${ic('play', 18, 'fill:#fff')}</div><div class="col grow"><b style="font-weight:500">${p.track.title}</b><span class="mut">${p.track.artist}</span></div><span class="mut">${p.track.dur}</span>${ic('plus', 18, 'color:var(--mut)')}</div>`;
    return `<div class="card" style="padding:12px 16px 12px"><div class="row" style="gap:10px">${avatar(u, 40)}<div class="col grow"><span class="nm">${u.name}${p.where ? ` <span class="mut" style="font-weight:400">→</span> ${p.where}` : ''}</span><span class="mut">сьогодні о ${['20:31', '19:44', '17:12'][i]}</span></div>${ic('ellipsis', 20, 'color:var(--mut)')}</div><div style="margin-top:10px;font-size:14px;line-height:1.45">${p.text}${p.tag ? ` <span style="color:#2a5885">${p.tag}</span>` : ''}</div>${extra}${actions(p, i)}</div>`;
};

const desktop = `<div class="v col" style="height:100%">
  <div class="hd row"><div class="wrap row" style="gap:16px"><span class="row" style="gap:8px;width:150px;font-weight:700;font-size:16px;color:var(--acc)">${ic('gamepad-2', 26)}GameCon</span><div class="row" style="width:230px;height:32px;border-radius:8px;background:#ebedf0;padding:0 10px;gap:8px;color:var(--mut)">${ic('search', 16)}Пошук</div><span style="position:relative">${ic('bell', 22, 'color:var(--acc)')}<span style="position:absolute;top:-6px;right:-10px;background:#e64646;color:#fff;border-radius:8px;font-size:11px;font-weight:600;padding:0 5px;line-height:16px">29</span></span>${ic('music', 22, 'color:var(--acc);margin-left:8px')}<span class="grow"></span><span class="row" style="gap:6px;font-weight:500">Марк ${avatar(me, 28)} ${ic('chevron-down', 14, 'color:var(--mut)')}</span></div></div>
  <div class="wrap row" style="gap:16px;align-items:flex-start;margin-top:16px">
    <div class="col" style="width:150px;gap:2px">${menu.map(([n, l, on, b]) => `<div class="row mi ${on ? 'on' : ''}">${ic(n, 18)}<span>${l}</span>${b ? `<span class="cnt">${b}</span>` : ''}</div>`).join('')}<div class="mut" style="font-size:12px;padding:12px 8px;line-height:1.6">Блог · Розробникам · Умови · Ще</div></div>
    <div class="col" style="width:550px;gap:12px">
      <div class="card row" style="gap:12px;padding:12px 16px">${[me, people.sofia, people.maks, people.ivan, people.olena, people.vika, people.nastya].map((u, i) => `<div class="col" style="align-items:center;gap:4px;width:64px"><div style="padding:2px;border-radius:50%;border:2px solid ${i === 0 ? 'var(--line)' : 'var(--acc)'};position:relative">${avatar(u, 52)}${i === 0 ? `<span style="position:absolute;right:-2px;bottom:-2px;width:20px;height:20px;border-radius:50%;background:var(--acc);border:2px solid #fff;display:grid;place-items:center;color:#fff">${ic('plus', 12)}</span>` : ''}</div><span style="font-size:12px" class="ell">${i === 0 ? 'Історія' : u.name.split(' ')[0]}</span></div>`).join('')}</div>
      <div class="card row" style="gap:10px;padding:12px 16px">${avatar(me, 28)}<span class="grow mut" style="font-size:14px">Що у вас нового?</span>${['image', 'chart-no-axes-column', 'music'].map((n) => ic(n, 20, 'color:var(--mut)')).join('')}</div>
      <div class="card row tabs"><span class="tb on">Друзі</span><span class="tb">Рекомендації</span><span class="tb">Спільноти</span><span class="tb">Країна</span><span class="grow"></span>${ic('sliders-horizontal', 18, 'color:var(--mut);margin-right:8px')}</div>
      ${posts.map(postCard).join('')}
    </div>
    <div class="col" style="width:228px;gap:12px">
      <div class="card" style="padding-bottom:12px"><div class="wh">Завтра</div><div class="row" style="gap:10px;padding:4px 16px"><div class="col" style="align-items:center;width:40px;border-radius:8px;background:var(--acc2);color:var(--acc);padding:3px 0;line-height:1.15"><span style="font-size:10px;font-weight:600">ЖОВТ</span><b style="font-size:16px">17</b></div><div class="col"><b style="font-weight:500">Тижневі збори сім’ї</b><span class="mut">17:00 · 12 підуть</span></div></div><div style="padding:8px 16px 0"><span class="sbtn" style="width:100%;justify-content:center">Піду</span></div></div>
      <div class="card" style="padding-bottom:10px"><div class="wh row" style="justify-content:space-between">Завдання дня<span class="mut" style="font-weight:400;font-size:12px">Сезон</span></div>${quests.map(([t, a, b, xp]) => `<div style="padding:6px 16px"><div class="row" style="justify-content:space-between"><span>${t}</span><span class="mut">+${xp}</span></div><div style="height:4px;border-radius:2px;background:#e5e7eb;margin-top:5px"><i style="display:block;height:100%;border-radius:2px;width:${(a / b) * 100}%;background:var(--acc)"></i></div></div>`).join('')}</div>
      <div class="card" style="padding-bottom:10px"><div class="wh">Друзі онлайн <span class="mut" style="font-weight:400">3</span></div>${['sofia', 'maks', 'ivan'].map((k) => `<div class="row" style="gap:10px;padding:6px 16px"><div style="position:relative">${avatar(people[k], 36)}<span style="position:absolute;right:0;bottom:0;width:10px;height:10px;border-radius:50%;background:#4bb34b;border:2px solid #fff"></span></div><span class="nm" style="font-weight:400">${people[k].name}</span></div>`).join('')}</div>
    </div>
  </div>
</div>`;

const tabbar = (active) => `<div class="row" style="height:56px;background:#fff;border-top:1px solid var(--line);justify-content:space-around;font-size:10px;color:#99a2ad">${[['newspaper', 'Головна'], ['compass', 'Огляд'], ['message-circle', 'Чати', 3], ['users', 'Друзі', 4], ['user', 'Профіль']].map(([n, l, b], i) => `<div class="col" style="align-items:center;gap:2px;position:relative;${i === active ? 'color:var(--acc)' : ''}">${ic(n, 26)}${l}${b ? `<span style="position:absolute;top:-2px;right:-4px;background:#e64646;color:#fff;border-radius:8px;font-size:11px;font-weight:600;padding:0 5px;line-height:16px;border:2px solid #fff">${b}</span>` : ''}</div>`).join('')}</div>`;

const mobileFeed = `<div class="v col" style="height:100%">
  <div class="row" style="height:52px;background:#fff;padding:0 12px;gap:12px">${avatar(me, 30)}<b class="grow row" style="font-size:20px;gap:4px">Новини ${ic('chevron-down', 18, 'color:var(--mut)')}</b>${ic('search', 24, 'color:var(--acc)')}<span style="position:relative">${ic('bell', 24, 'color:var(--acc)')}<span style="position:absolute;top:-6px;right:-8px;background:#e64646;color:#fff;border-radius:8px;font-size:11px;font-weight:600;padding:0 5px;line-height:16px">29</span></span></div>
  <div class="col grow" style="gap:8px;overflow:hidden">
    <div class="row" style="gap:10px;padding:10px 12px;background:#fff">${[me, people.sofia, people.maks, people.ivan, people.olena].map((u, i) => `<div class="col" style="align-items:center;gap:4px;width:64px"><div style="padding:2px;border-radius:50%;border:2px solid ${i === 0 ? 'var(--line)' : 'var(--acc)'}">${avatar(u, 56)}</div><span style="font-size:12px">${i === 0 ? 'Історія' : u.name.split(' ')[0]}</span></div>`).join('')}</div>
    <div class="row" style="gap:8px;padding:0 12px"><span class="tb on" style="background:#fff">Друзі</span><span class="tb">Рекомендації</span><span class="tb">Спільноти</span></div>
    ${posts.slice(0, 2).map((p, i) => postCard(p, i).replace('class="card" style="', 'class="card" style="border-radius:0;')).join('')}
  </div>
  ${tabbar(0)}
</div>`;

const mobileChat = `<div class="v col" style="height:100%;background:#fff">
  <div class="row" style="height:56px;padding:0 8px;gap:10px;border-bottom:1px solid var(--line)">${ic('chevron-left', 26, 'color:var(--acc)')}${avatar(communities[0], 36)}<div class="col grow"><b style="font-weight:500;font-size:15px">[SCL] Scaletta Family</b><span class="mut">48 учасників</span></div>${ic('phone', 22, 'color:var(--acc)')}${ic('ellipsis-vertical', 22, 'color:var(--acc)')}</div>
  <div class="col grow" style="justify-content:flex-end;padding:0 8px 8px;gap:4px;overflow:hidden;background:#f5f6f8">
    <div style="align-self:center;background:rgba(0,0,0,.06);border-radius:10px;padding:2px 10px;margin:8px 0;font-size:12px" class="mut">сьогодні</div>
    ${thread
        .map((m, i) => {
            const mine = m.who === 'me';
            const u = who(m.who);
            const first = i === 0 || thread[i - 1].who !== m.who;
            return `<div class="row" style="gap:8px;align-items:flex-end;justify-content:${mine ? 'flex-end' : 'flex-start'};margin-top:${first ? 6 : 0}px">${!mine ? avatar(u, 30) : ''}<div style="max-width:76%;padding:7px 12px;border-radius:18px;font-size:15px;line-height:1.35;background:${mine ? '#d8dbff' : '#fff'};box-shadow:0 1px .5px rgba(0,0,0,.08)">${!mine && first ? `<div style="font-size:13px;font-weight:500;color:var(--acc)">${u.name}</div>` : ''}${m.text}<span class="mut" style="font-size:11px;margin-left:8px;float:right;margin-top:6px">${m.time}</span></div></div>`;
        })
        .join('')}
  </div>
  <div class="row" style="gap:10px;padding:8px 10px 16px;border-top:1px solid var(--line)">${ic('paperclip', 24, 'color:var(--mut)')}<div class="row grow" style="height:38px;border-radius:19px;border:1px solid var(--line);padding:0 12px;color:var(--mut);justify-content:space-between;font-size:15px">Повідомлення${ic('smile', 22)}</div>${ic('mic', 24, 'color:var(--acc)')}</div>
</div>`;

export default page('Варіант 5 — VK / Facebook', css, [
    ['desktop-feed', 'desktop', desktop],
    ['mobile-feed', 'mobile', mobileFeed],
    ['mobile-chat', 'mobile', mobileChat],
]);
