import { ic, avatar, who, me, people, communities, posts, thread, quests, page } from './common.mjs';

// Варіант 1 — патерн Discord: рейка серверів, канали, стрічка як канал, список учасників.
const css = `
.d{--rail:#1e1f22;--side:#2b2d31;--bg:#313338;--hover:#35373c;--active:#404249;--tx:#dbdee1;--mut:#949ba4;--head:#f2f3f5;--acc:#5865f2;--green:#23a55a;color:var(--tx);font-size:15px}
.d .rail{width:72px;background:var(--rail);padding:12px 0;gap:8px;align-items:center}
.d .srv{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:15px;position:relative}
.d .srv.on{border-radius:16px}
.d .pill{position:absolute;left:-12px;width:4px;border-radius:0 4px 4px 0;background:#fff}
.d .sep{width:32px;height:2px;background:#35363c;border-radius:1px}
.d .side{width:240px;background:var(--side)}
.d .shead{height:48px;padding:0 16px;border-bottom:1px solid #1f2023;font-weight:600;color:var(--head);justify-content:space-between}
.d .cat{font-size:12px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.02em;padding:18px 8px 4px 16px;gap:2px}
.d .ch{margin:1px 8px;padding:6px 8px;border-radius:4px;gap:6px;color:var(--mut);font-weight:500}
.d .ch.on{background:var(--active);color:#fff}
.d .ch.unread{color:#fff}
.d .badge{background:#f23f43;color:#fff;font-size:12px;font-weight:700;border-radius:8px;min-width:16px;height:16px;padding:0 4px;display:grid;place-items:center}
.d .vu{margin:0 8px 0 36px;padding:3px 8px;gap:8px;color:var(--mut);font-size:14px}
.d .me{height:52px;background:#232428;padding:0 8px;gap:8px;margin-top:auto}
.d .main,.d.main{background:var(--bg)}
.d .mhead{height:48px;padding:0 16px;border-bottom:1px solid #26272b;gap:8px;color:var(--head);font-weight:600}
.d .msg{padding:8px 16px 8px 72px;position:relative}
.d .msg .av{position:absolute;left:16px;top:10px}
.d .nm{font-weight:600;color:#f2f3f5}
.d .tm{font-size:12px;color:var(--mut);margin-left:8px;font-weight:400}
.d .emb{border-left:4px solid var(--acc);background:#2b2d31;border-radius:4px;padding:12px 16px;margin-top:8px;max-width:520px}
.d .react{gap:6px;margin-top:8px}
.d .rc{background:#2b2d31;border:1px solid transparent;border-radius:8px;padding:2px 8px;font-size:14px;gap:6px;color:var(--tx)}
.d .rc.mine{background:#373a6d;border-color:var(--acc)}
.d .input{margin:0 16px 24px;background:#383a40;border-radius:8px;height:44px;padding:0 16px;gap:16px;color:var(--mut)}
.d .members{width:240px;background:var(--side);padding:16px 8px}
.d .mrow{padding:6px 8px;gap:12px;border-radius:4px}
.d .dot{position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;border-radius:50%;background:var(--green);border:3px solid var(--side)}
.d .bar{height:8px;border-radius:4px;background:#1e1f22;overflow:hidden}
.d .bar i{display:block;height:100%;background:var(--acc)}
.d .day{margin:16px 16px 4px;gap:8px;font-size:12px;font-weight:600;color:var(--mut)}
.d .day::before,.d .day::after{content:'';flex:1;height:1px;background:#3f4147}
`;

const rail = (active = 0) => `<div class="col rail">
  <div class="srv on" style="background:var(--acc)">${ic('gamepad-2', 26)}</div>
  <div class="sep"></div>
  ${communities
      .map(
          (c, i) => `<div class="srv ${i === active ? 'on' : ''}" style="background:linear-gradient(135deg,${c.c[0]},${c.c[1]})">${i === active ? '<span class="pill" style="height:40px"></span>' : c.unread ? '<span class="pill" style="height:8px"></span>' : ''}${c.short}${c.unread ? `<span class="badge" style="position:absolute;right:-4px;bottom:-4px;border:3px solid var(--rail);height:22px;border-radius:11px">${c.unread}</span>` : ''}</div>`,
      )
      .join('')}
  <div class="srv" style="background:#313338;color:var(--green)">${ic('plus', 24)}</div>
  <div class="srv" style="background:#313338;color:var(--green)">${ic('compass', 24)}</div>
</div>`;

const channels = `<div class="col side">
  <div class="row shead"><span>[SCL] Scaletta Family</span>${ic('chevron-down', 18)}</div>
  <div class="col" style="padding-top:8px">
    <div class="ch row">${ic('calendar', 20)}<span class="grow">Події</span><span class="badge">1</span></div>
    <div class="ch row">${ic('users', 20)}<span>Учасники · 48</span></div>
    <div class="row cat">${ic('chevron-down', 12)}Текстові канали</div>
    <div class="ch row on">${ic('hash', 20)}<span>новини</span></div>
    <div class="ch row unread">${ic('hash', 20)}<span class="grow">загальний</span><span class="badge">4</span></div>
    <div class="ch row">${ic('hash', 20)}<span>звіти</span></div>
    <div class="ch row">${ic('hash', 20)}<span>пошук-пати</span></div>
    <div class="ch row">${ic('film', 20)}<span>кіноклуб</span></div>
    <div class="row cat">${ic('chevron-down', 12)}Голосові канали</div>
    <div class="ch row">${ic('volume-2', 20)}<span>Збори сім’ї</span></div>
    ${['maks', 'ivan', 'sofia'].map((k) => `<div class="vu row">${avatar(people[k], 24)}<span class="grow">${people[k].name}</span>${k === 'ivan' ? ic('mic-off', 16, 'color:#f23f43') : ''}</div>`).join('')}
    <div class="ch row">${ic('volume-2', 20)}<span>CS2 · тренування</span></div>
  </div>
  <div class="row me">${avatar(me, 32)}<div class="col grow"><b style="font-size:14px;color:#f2f3f5">Марк</b><span style="font-size:12px;color:var(--mut)">У мережі</span></div>${ic('mic', 20, 'color:#b5bac1')}${ic('headphones', 20, 'color:#b5bac1;margin-left:8px')}${ic('settings', 20, 'color:#b5bac1;margin:0 8px')}</div>
</div>`;

const reactions = (p, i) => `<div class="row react"><span class="rc row ${i === 0 ? 'mine' : ''}">❤️ ${p.likes}</span><span class="rc row">🔥 ${Math.round(p.likes / 3)}</span><span class="rc row">${ic('message-circle', 15)} ${p.comments}</span><span class="rc row" style="color:var(--mut)">${ic('smile-plus', 16)}</span></div>`;

const feedMsg = (p, i) => {
    const u = who(p.who);
    let body = `<div style="line-height:1.375;margin-top:2px">${p.text}${p.tag ? ` <span style="color:#00a8fc">${p.tag}</span>` : ''}</div>`;
    if (p.poll)
        body += `<div class="emb"><div style="font-weight:600;color:#f2f3f5;margin-bottom:10px">${ic('chart-no-axes-column', 16, 'vertical-align:-2px;margin-right:6px')}Опитування · ${p.votes} голосів</div>${p.poll
            .map(
                ([o, v], j) => `<div style="margin-bottom:10px"><div class="row" style="justify-content:space-between;font-size:14px;margin-bottom:4px"><span>${j === 0 ? '✅ ' : ''}${o}</span><span style="color:var(--mut)">${v}%</span></div><div class="bar"><i style="width:${v}%"></i></div></div>`,
            )
            .join('')}</div>`;
    if (p.track)
        body += `<div class="emb row" style="gap:12px;border-left-color:#eb459e"><div style="width:48px;height:48px;border-radius:6px;background:linear-gradient(135deg,#eb459e,#5865f2);display:grid;place-items:center;color:#fff">${ic('music', 22)}</div><div class="col grow"><b style="color:#f2f3f5">${p.track.title}</b><span style="font-size:13px;color:var(--mut)">${p.track.artist} · ${p.track.dur}</span></div><div style="width:36px;height:36px;border-radius:50%;background:var(--acc);display:grid;place-items:center;color:#fff">${ic('play', 18)}</div></div>`;
    return `<div class="msg"><div class="av">${avatar(u, 40)}</div><div><span class="nm">${u.name}</span>${u.verified ? ic('badge-check', 15, 'color:#5865f2;vertical-align:-2px;margin-left:4px') : ''}<span class="tm">${p.where ? 'у ' + p.where + ' · ' : ''}сьогодні о ${['20:31', '19:44', '17:12'][i]}</span></div>${body}${reactions(p, i)}</div>`;
};

const membersCol = `<div class="col members">
  <div class="cat" style="padding:8px">Завтра</div>
  <div style="background:#232428;border-radius:8px;padding:12px;margin:0 8px 8px"><div style="font-size:12px;color:var(--green);font-weight:600">${ic('calendar', 13, 'vertical-align:-2px;margin-right:4px')}ЗАВТРА · 17:00</div><div style="font-weight:600;color:#f2f3f5;margin-top:4px">Тижневі збори сім’ї</div><div style="font-size:13px;color:var(--mut);margin-top:2px">Голосовий канал · 12 підуть</div></div>
  <div class="cat" style="padding:16px 8px 4px">Завдання дня</div>
  ${quests.map(([t, a, b, xp]) => `<div style="padding:6px 8px"><div class="row" style="justify-content:space-between;font-size:13px"><span>${t}</span><span style="color:var(--mut)">+${xp} XP</span></div><div class="bar" style="margin-top:6px;height:6px"><i style="width:${(a / b) * 100}%"></i></div></div>`).join('')}
  <div class="cat" style="padding:16px 8px 4px">У мережі — 3</div>
  ${['maks', 'ivan', 'sofia'].map((k) => `<div class="mrow row"><div style="position:relative">${avatar(people[k], 32)}<span class="dot"></span></div><div class="col"><span style="font-weight:500;color:#f2f3f5">${people[k].name}</span><span style="font-size:12px;color:var(--mut)">${k === 'sofia' ? 'Грає в Counter-Strike 2' : k === 'maks' ? 'Дивиться Sintel' : 'У голосовому'}</span></div></div>`).join('')}
  <div class="cat" style="padding:16px 8px 4px">Не в мережі — 2</div>
  ${['olena', 'vika'].map((k) => `<div class="mrow row" style="opacity:.4">${avatar(people[k], 32)}<span style="font-weight:500">${people[k].name}</span></div>`).join('')}
</div>`;

const desktop = `<div class="d row" style="height:100%;align-items:stretch">${rail(0)}${channels}
<div class="col main grow">
  <div class="row mhead">${ic('hash', 24, 'color:#80848e')}<span>новини</span><span style="width:1px;height:24px;background:#3f4147;margin:0 8px"></span><span style="font-weight:400;color:var(--mut);font-size:14px" class="grow">Стрічка друзів і спільнот</span>${ic('bell', 22, 'color:#b5bac1')}${ic('pin', 22, 'color:#b5bac1;margin-left:16px')}${ic('users', 22, 'color:#fff;margin-left:16px')}<div class="row" style="background:#1e1f22;border-radius:4px;height:24px;width:144px;padding:0 6px;margin-left:16px;color:var(--mut);font-size:13px;justify-content:space-between;font-weight:400">Пошук${ic('search', 14)}</div></div>
  <div class="col grow" style="overflow:hidden;justify-content:flex-end;padding-bottom:8px">
    <div class="day row">16 жовтня 2026</div>
    ${posts.slice().reverse().map((p, i) => feedMsg(p, 2 - i)).join('')}
  </div>
  <div class="row input">${ic('circle-plus', 22, 'color:#b5bac1')}<span class="grow">Що нового, Марк? Написати в #новини</span>${ic('gift', 22, 'color:#b5bac1')}${ic('sticker', 22, 'color:#b5bac1')}${ic('smile', 22, 'color:#b5bac1')}</div>
</div>${membersCol}</div>`;

const mobileFeed = `<div class="d col" style="height:100%;background:var(--bg)">
  <div class="row" style="flex:1;min-height:0;align-items:stretch">
    ${rail(0)}
    <div class="col side grow" style="border-radius:16px 0 0 0;width:auto">
      <div class="row shead" style="height:56px"><span style="font-size:16px">[SCL] Scaletta Family</span>${ic('ellipsis', 20)}</div>
      <div class="row" style="margin:12px 12px 4px;gap:8px"><div class="row grow" style="background:#1e1f22;border-radius:8px;height:36px;padding:0 10px;gap:8px;color:var(--mut);font-size:14px">${ic('search', 16)}Пошук</div><div style="width:36px;height:36px;border-radius:50%;background:#1e1f22;display:grid;place-items:center;color:var(--mut)">${ic('user-plus', 18)}</div></div>
      <div style="margin:8px 12px;background:#232428;border-radius:10px;padding:12px"><div style="font-size:12px;color:var(--green);font-weight:600">ЗАВТРА · 17:00</div><div style="font-weight:600;color:#f2f3f5;margin-top:2px">Тижневі збори сім’ї</div><div style="font-size:13px;color:var(--mut)">12 підуть · Голосовий канал</div></div>
      <div class="row cat">${ic('chevron-down', 12)}Текстові канали</div>
      <div class="ch row on">${ic('hash', 20)}<span>новини</span></div>
      <div class="ch row unread">${ic('hash', 20)}<span class="grow">загальний</span><span class="badge">4</span></div>
      <div class="ch row">${ic('hash', 20)}<span>звіти</span></div>
      <div class="ch row">${ic('hash', 20)}<span>пошук-пати</span></div>
      <div class="ch row">${ic('film', 20)}<span>кіноклуб</span></div>
      <div class="row cat">${ic('chevron-down', 12)}Голосові канали</div>
      <div class="ch row">${ic('volume-2', 20)}<span>Збори сім’ї</span></div>
      ${['maks', 'ivan', 'sofia'].map((k) => `<div class="vu row" style="margin-left:36px">${avatar(people[k], 22)}<span>${people[k].name}</span></div>`).join('')}
      <div class="ch row">${ic('volume-2', 20)}<span>CS2 · тренування</span></div>
    </div>
  </div>
  <div class="row" style="height:64px;background:#1e1f22;justify-content:space-around;color:var(--mut);font-size:11px;font-weight:500">
    ${[['house', 'Головна', 1], ['message-circle', 'Чати', 0, 3], ['bell', 'Сповіщення', 0, 29], ['user', 'Ви', 0]].map(([n, l, on, b]) => `<div class="col" style="align-items:center;gap:3px;position:relative;${on ? 'color:#fff' : ''}">${ic(n, 24)}${l}${b ? `<span class="badge" style="position:absolute;top:-4px;right:2px">${b}</span>` : ''}</div>`).join('')}
  </div>
</div>`;

const chatMsg = (m, prev) => {
    const u = who(m.who);
    const grouped = prev && prev.who === m.who;
    if (grouped) return `<div style="padding:2px 16px 2px 72px;line-height:1.375">${m.text}</div>`;
    return `<div class="msg" style="padding-top:12px"><div class="av">${avatar(u, 40)}</div><div><span class="nm" style="${m.who === 'andrew' ? 'color:#f0b232' : ''}">${u.name}</span><span class="tm">сьогодні о ${m.time}</span></div><div style="line-height:1.375;margin-top:2px">${m.text}</div></div>`;
};

const mobileChat = `<div class="d col main" style="height:100%">
  <div class="row mhead" style="height:56px;gap:10px">${ic('menu', 24, 'color:#b5bac1')}${ic('hash', 22, 'color:#80848e')}<span class="grow" style="font-size:16px">загальний</span>${ic('search', 22, 'color:#b5bac1')}${ic('users', 22, 'color:#b5bac1;margin-left:12px')}</div>
  <div class="col grow" style="justify-content:flex-end;overflow:hidden;padding-bottom:8px">
    <div class="day row">Сьогодні</div>
    ${thread.map((m, i) => chatMsg(m, thread[i - 1])).join('')}
    <div class="row react" style="padding-left:72px"><span class="rc row mine">👍 5</span><span class="rc row">🔥 2</span></div>
    <div style="padding:8px 16px 0;font-size:13px;color:var(--mut)"><b style="color:var(--tx)">Іван Бондар</b> друкує…</div>
  </div>
  <div class="row" style="gap:10px;padding:8px 12px 20px">
    <div style="width:40px;height:40px;border-radius:50%;background:#2b2d31;display:grid;place-items:center;color:#b5bac1">${ic('plus', 22)}</div>
    <div class="row grow" style="background:#2b2d31;border-radius:20px;height:40px;padding:0 14px;color:var(--mut);justify-content:space-between">Написати в #загальний${ic('smile', 20)}</div>
    <div style="width:40px;height:40px;border-radius:50%;background:#2b2d31;display:grid;place-items:center;color:#b5bac1">${ic('mic', 20)}</div>
  </div>
</div>`;

export default page('Варіант 1 — Discord', css, [
    ['desktop-feed', 'desktop', desktop],
    ['mobile-feed', 'mobile', mobileFeed],
    ['mobile-chat', 'mobile', mobileChat],
]);
