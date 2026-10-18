import { ic, avatar, who, me, people, posts, thread, page } from './common.mjs';

// Варіант 2 — патерн X / Threads: одна колонка стрічки, рамки 1px, мінімум декору, акцент лише на діях.
const css = `
.x{--bg:#000;--line:#2f3336;--tx:#e7e9ea;--mut:#71767b;--acc:#6366f1;--hover:#16181c;background:var(--bg);color:var(--tx);font-size:15px}
.x .nav{width:275px;padding:4px 12px 0 0;align-items:flex-end}
.x .nav .in{width:259px}
.x .ni{gap:20px;padding:12px;border-radius:999px;font-size:20px;width:fit-content}
.x .ni.on{font-weight:700}
.x .btn{background:var(--tx);color:#0f1419;font-weight:700;border-radius:999px;display:grid;place-items:center}
.x .tl{width:600px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.x .tabs{height:53px;border-bottom:1px solid var(--line)}
.x .tab{flex:1;display:grid;place-items:center;color:var(--mut);font-weight:500;position:relative;height:100%}
.x .tab.on{color:var(--tx);font-weight:700}
.x .tab.on::after{content:'';position:absolute;bottom:0;height:4px;width:56px;border-radius:2px;background:var(--acc)}
.x .post{padding:12px 16px;border-bottom:1px solid var(--line);gap:12px;align-items:flex-start}
.x .nm{font-weight:700}
.x .mut{color:var(--mut)}
.x .acts{justify-content:space-between;margin-top:12px;color:var(--mut);font-size:13px;max-width:425px}
.x .acts span{gap:6px}
.x .card{border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-top:12px}
.x .opt{height:32px;border-radius:6px;position:relative;margin-bottom:6px;overflow:hidden}
.x .opt i{position:absolute;inset:0;background:#2f3336}
.x .opt.win i{background:rgba(99,102,241,.45)}
.x .opt span{position:relative;z-index:1;padding:0 12px;line-height:32px}
.x .side{width:350px;padding:0 0 0 30px}
.x .box{border:1px solid var(--line);border-radius:16px;margin-top:16px}
.x .box h3{font-size:20px;font-weight:800;padding:12px 16px}
.x .trend{padding:12px 16px}
.x .search{height:44px;border-radius:999px;background:#202327;margin-top:6px;padding:0 16px;gap:14px;color:var(--mut)}
.x .follow{background:var(--tx);color:#0f1419;font-weight:700;border-radius:999px;padding:6px 16px;font-size:14px}
.x .bub{max-width:78%;padding:10px 14px;border-radius:22px;line-height:1.35}
`;

const navItems = [
    ['house', 'Головна', 1],
    ['search', 'Огляд'],
    ['bell', 'Сповіщення', 0, 29],
    ['mail', 'Повідомлення', 0, 3],
    ['users', 'Спільноти'],
    ['film', 'Кіно'],
    ['music', 'Музика'],
    ['bookmark', 'Збережене'],
    ['user', 'Профіль'],
];

const actions = (p, i) => `<div class="row acts"><span class="row">${ic('message-circle', 18)}${p.comments}</span><span class="row" ${i === 2 ? 'style="color:#00ba7c"' : ''}>${ic('repeat-2', 18)}${p.reposts}</span><span class="row" ${i === 0 ? 'style="color:#f91880"' : ''}>${ic('heart', 18, i === 0 ? 'fill:#f91880' : '')}${p.likes}</span><span class="row">${ic('chart-no-axes-column', 18)}${p.views}</span><span class="row">${ic('bookmark', 18)}${ic('share', 18, 'margin-left:12px')}</span></div>`;

const post = (p, i, mobile = false) => {
    const u = who(p.who);
    let extra = '';
    if (p.poll)
        extra = `<div style="margin-top:12px">${p.poll.map(([o, v], j) => `<div class="opt ${j === 0 ? 'win' : ''}"><i style="width:${v}%"></i><span class="row" style="justify-content:space-between;font-weight:${j === 0 ? 700 : 400}"><span>${o}</span><span>${v}%</span></span></div>`).join('')}<div class="mut" style="font-size:14px;margin-top:4px">${p.votes} голосів · залишилось 2 дні</div></div>`;
    if (p.track)
        extra = `<div class="card row" style="gap:12px;padding:12px"><div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(135deg,#4338ca,#db2777);display:grid;place-items:center">${ic('music', 24)}</div><div class="col grow"><b>${p.track.title}</b><span class="mut">${p.track.artist} · ${p.track.dur}</span></div><div style="width:40px;height:40px;border-radius:50%;background:var(--tx);color:#000;display:grid;place-items:center">${ic('play', 18, 'fill:#000')}</div></div>`;
    return `<div class="post row">${avatar(u, 40)}<div class="col grow"><div class="row" style="gap:4px"><span class="nm">${u.name}</span>${u.verified ? ic('badge-check', 17, 'color:var(--acc)') : ''}<span class="mut ell">@${u.handle} · ${p.time}</span><span class="grow"></span>${ic('ellipsis', 18, 'color:var(--mut)')}</div>${p.where ? `<div class="mut" style="font-size:13px;margin-top:1px">${ic('users', 13, 'vertical-align:-2px;margin-right:4px')}${p.where}</div>` : ''}<div style="line-height:1.35;margin-top:2px">${p.text}${p.tag ? ` <span style="color:var(--acc)">${p.tag}</span>` : ''}</div>${extra}${actions(p, i)}</div></div>`;
};

const composer = `<div class="post row" style="padding-bottom:8px">${avatar(me, 40)}<div class="col grow"><div style="font-size:20px;color:var(--mut);padding:10px 0 16px">Що нового, Марк?</div><div class="row" style="border-top:1px solid var(--line);padding-top:10px;gap:16px;color:var(--acc)">${['image', 'sticker', 'chart-no-axes-column', 'music', 'eye-off', 'calendar-clock'].map((n) => ic(n, 20)).join('')}<span class="grow"></span><span class="btn" style="padding:0 16px;height:36px;opacity:.5;font-size:15px">Опублікувати</span></div></div></div>`;

const desktop = `<div class="x row" style="height:100%;align-items:stretch;justify-content:center">
  <div class="col nav"><div class="col in">
    <div style="padding:12px;color:var(--tx)">${ic('gamepad-2', 30)}</div>
    ${navItems.map(([n, l, on, b]) => `<div class="row ni ${on ? 'on' : ''}"><span style="position:relative">${ic(n, 26, on ? 'stroke-width:2.6' : '')}${b ? `<span style="position:absolute;top:-6px;right:-8px;background:var(--acc);color:#fff;font-size:11px;font-weight:700;border-radius:9px;padding:1px 5px">${b}</span>` : ''}</span>${l}</div>`).join('')}
    <div class="btn" style="height:52px;margin-top:16px;width:233px;font-size:17px;background:var(--acc);color:#fff">Створити</div>
    <div class="row" style="margin-top:auto;margin-bottom:12px;padding:12px;gap:12px;border-radius:999px">${avatar(me, 40)}<div class="col grow"><b>Марк</b><span class="mut">@mark</span></div>${ic('ellipsis', 18)}</div>
  </div></div>
  <div class="col tl">
    <div class="row tabs"><div class="tab on">Для вас</div><div class="tab">Друзі</div><div class="tab">Спільноти</div></div>
    ${composer}
    <div class="row" style="justify-content:center;height:52px;border-bottom:1px solid var(--line);color:var(--acc)">Показати 6 нових записів</div>
    ${posts.map((p, i) => post(p, i)).join('')}
  </div>
  <div class="col side">
    <div class="row search">${ic('search', 18)}Пошук людей, ігор, кіно</div>
    <div class="box"><h3>Завтра</h3><div class="trend row" style="gap:12px"><div class="col" style="align-items:center;width:44px;border-radius:10px;border:1px solid var(--line);padding:4px 0"><span class="mut" style="font-size:11px">ЖОВТ</span><b style="font-size:18px">17</b></div><div class="col"><b>Тижневі збори сім’ї</b><span class="mut" style="font-size:14px">17:00 · [SCL] Scaletta Family · 12 підуть</span></div></div></div>
    <div class="box"><h3>Що відбувається</h3>
      ${[['Кіберспорт · Популярне', '#GameConCup', '1 240 записів'], ['Кіноклуб · Наживо', 'Sintel — дивимось разом', '86 дивляться'], ['Ігри · Популярне', 'Counter-Strike 2', '3 412 записів'], ['Музика', '#карпатськийдрейф', '214 записів']].map(([a, b, c]) => `<div class="trend"><div class="mut" style="font-size:13px">${a}</div><b>${b}</b><div class="mut" style="font-size:13px">${c}</div></div>`).join('')}
    </div>
    <div class="box"><h3>Кого читати</h3>${['ivan', 'vika'].map((k) => `<div class="trend row" style="gap:12px">${avatar(people[k], 40)}<div class="col grow"><b>${people[k].name}</b><span class="mut">@${people[k].handle}</span></div><span class="follow">Стежити</span></div>`).join('')}</div>
  </div>
</div>`;

const mobileFeed = `<div class="x col" style="height:100%">
  <div class="row" style="height:52px;padding:0 16px;justify-content:space-between">${avatar(me, 32)}${ic('gamepad-2', 28)}<span style="width:32px"></span></div>
  <div class="row tabs" style="height:48px"><div class="tab on">Для вас</div><div class="tab">Друзі</div><div class="tab">Спільноти</div></div>
  <div class="row" style="gap:14px;padding:12px 16px;border-bottom:1px solid var(--line);overflow:hidden">${[me, people.sofia, people.maks, people.ivan, people.olena, people.vika].map((u, i) => `<div class="col" style="align-items:center;gap:4px;font-size:12px;color:var(--mut)"><div style="padding:2px;border-radius:50%;background:${i === 0 ? 'var(--line)' : 'linear-gradient(45deg,#6366f1,#ec4899)'}"><div style="padding:2px;border-radius:50%;background:#000">${avatar(u, 52)}</div></div>${i === 0 ? 'Ваша' : u.name.split(' ')[0]}</div>`).join('')}</div>
  <div class="col grow" style="overflow:hidden">${posts.map((p, i) => post(p, i, true)).join('')}</div>
  <div class="btn" style="position:absolute;right:16px;bottom:72px;width:56px;height:56px;background:var(--acc);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.5)">${ic('plus', 26)}</div>
  <div class="row" style="height:56px;border-top:1px solid var(--line);justify-content:space-around;background:#000">${[['house', 1], ['search'], ['film'], ['bell', 0, 29], ['mail', 0, 3]].map(([n, on, b]) => `<span style="position:relative">${ic(n, 26, on ? 'stroke-width:2.6' : 'color:#e7e9ea')}${b ? `<span style="position:absolute;top:-4px;right:-8px;background:var(--acc);color:#fff;font-size:11px;font-weight:700;border-radius:9px;padding:1px 5px">${b}</span>` : ''}</span>`).join('')}</div>
</div>`;

const bubble = (m, i) => {
    const mine = m.who === 'me';
    const u = who(m.who);
    const next = thread[i + 1];
    const last = !next || next.who !== m.who;
    return `<div class="row" style="gap:8px;align-items:flex-end;justify-content:${mine ? 'flex-end' : 'flex-start'};margin-top:${i && thread[i - 1].who === m.who ? 2 : 10}px">${!mine ? (last ? avatar(u, 28) : '<span style="width:28px"></span>') : ''}<div class="col" style="max-width:78%;align-items:${mine ? 'flex-end' : 'flex-start'}">${!mine && (i === 0 || thread[i - 1].who !== m.who) ? `<span class="mut" style="font-size:12px;margin:0 0 2px 12px">${u.name}</span>` : ''}<div class="bub" style="max-width:100%;background:${mine ? 'var(--acc)' : '#2f3336'};${mine ? 'border-bottom-right-radius:6px' : 'border-bottom-left-radius:6px'}">${m.text}</div>${last ? `<span class="mut" style="font-size:12px;margin:3px 6px 0">${m.time}${mine ? ' · Прочитано' : ''}</span>` : ''}</div></div>`;
};

const mobileChat = `<div class="x col" style="height:100%">
  <div class="row" style="height:56px;padding:0 12px;gap:12px;border-bottom:1px solid var(--line)">${ic('arrow-left', 22)}<div style="display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#b45309);font-size:12px;font-weight:700">SCL</div><div class="col grow"><b>[SCL] Scaletta Family</b><span class="mut" style="font-size:13px">48 учасників · 3 у мережі</span></div>${ic('phone', 20)}${ic('info', 20, 'margin-left:8px')}</div>
  <div class="col grow" style="justify-content:flex-end;padding:0 12px 12px;overflow:hidden">
    <div class="mut" style="text-align:center;font-size:13px;margin:8px 0">Сьогодні</div>
    ${thread.map(bubble).join('')}
  </div>
  <div class="row" style="padding:8px 12px 20px;gap:12px;border-top:1px solid var(--line)"><div class="row grow" style="background:#202327;border-radius:22px;height:44px;padding:0 14px;gap:12px;color:var(--acc)">${ic('image', 20)}${ic('sticker', 20)}<span class="mut grow">Повідомлення</span>${ic('mic', 20)}</div>${ic('send-horizontal', 22, 'color:var(--acc)')}</div>
</div>`;

export default page('Варіант 2 — X / Threads', css, [
    ['desktop-feed', 'desktop', desktop],
    ['mobile-feed', 'mobile', mobileFeed],
    ['mobile-chat', 'mobile', mobileChat],
]);
