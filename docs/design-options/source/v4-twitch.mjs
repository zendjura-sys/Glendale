import { ic, avatar, who, me, people, posts, thread, movies, communities, page } from './common.mjs';

// Варіант 4 — патерн Twitch / Steam: медіа на першому місці. Ліва колонка «у мережі / наживо»,
// полиці з обкладинками (кіно, ігри, стріми), компактний чат з кольоровими ніками.
// Обкладинки — тональні заглушки з назвою (справжні постери підставляються з каталогу кіно).
const css = `
.t{--bg:#0e0e10;--s:#18181b;--s2:#1f1f23;--s3:#26262c;--tx:#efeff1;--mut:#adadb8;--acc:#9147ff;--live:#eb0400;background:var(--bg);color:var(--tx);font-size:13px}
.t .top{height:50px;background:var(--s);box-shadow:0 1px 2px rgba(0,0,0,.6);padding:0 10px;gap:20px;font-weight:600;font-size:16px;position:relative;z-index:2}
.t .side{width:240px;background:var(--s);padding:10px 0}
.t .sh{font-size:13px;font-weight:600;text-transform:uppercase;padding:6px 10px;color:var(--tx)}
.t .ch{padding:5px 10px;gap:10px}
.t .livedot{width:8px;height:8px;border-radius:50%;background:var(--live)}
.t .shelf{font-size:18px;font-weight:600;margin:24px 0 10px}
.t .shelf b{color:#bf94ff}
.t .cover{border-radius:4px;position:relative;overflow:hidden}
.t .lv{position:absolute;left:8px;top:8px;background:var(--live);color:#fff;font-weight:600;border-radius:4px;padding:0 5px;font-size:12px;text-transform:uppercase}
.t .vw{position:absolute;right:8px;top:8px;background:rgba(0,0,0,.6);border-radius:2px;padding:0 4px;font-size:12px}
.t .tag{background:var(--s3);border-radius:9px;padding:1px 8px;font-size:12px;font-weight:600;color:var(--mut)}
.t .mut{color:var(--mut)}
.t .btn{background:var(--acc);color:#fff;font-weight:600;border-radius:4px;height:30px;padding:0 10px;display:inline-flex;align-items:center;gap:6px}
.t .gbtn{background:var(--s3);color:var(--tx);font-weight:600;border-radius:4px;height:30px;padding:0 10px;display:inline-flex;align-items:center;gap:6px}
.t .chat{width:340px;background:var(--s);border-left:1px solid #2a2a2d}
.t .cl{padding:5px 20px;line-height:20px;font-size:13px}
`;

const cover = (m, w, h, extra = '') => `<div class="cover" style="width:${w}px;height:${h}px;background:radial-gradient(120% 90% at 30% 20%,${m.c[1]}55,transparent 60%),linear-gradient(160deg,${m.c[0]},#09090b);${extra}"><div style="position:absolute;left:12px;right:12px;bottom:12px;font-weight:800;font-size:${Math.round(w / 9)}px;line-height:1.05;letter-spacing:-.02em;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.4)">${m.t}</div></div>`;

const streams = [
    { m: movies[0], title: 'Кіноклуб: дивимось Sintel разом', who: 'maks', where: 'Кіноклуб', viewers: 86, tags: ['Кіно', 'Українською'] },
    { m: { t: 'CS2 · тренування', c: ['#1e1b4b', '#f97316'] }, title: 'Готуємось до GameCon Cup — рейтингові', who: 'sofia', where: 'Counter-Strike 2', viewers: 41, tags: ['FPS', 'Кіберспорт'] },
    { m: { t: 'Карпатський дрейф', c: ['#4a044e', '#22d3ee'] }, title: 'Слухаємо нові треки спільноти', who: 'olena', where: 'Музика', viewers: 23, tags: ['Музика', 'Чіл'] },
];

const streamCard = (s, w) => {
    const u = people[s.who];
    return `<div class="col" style="width:${w}px;gap:8px">${cover(s.m, w, Math.round((w * 9) / 16), '').replace('</div></div>', `</div><span class="lv">Наживо</span><span class="vw">${s.viewers} глядачів</span></div>`)}<div class="row" style="gap:10px;align-items:flex-start">${avatar(u, 40)}<div class="col" style="gap:2px;min-width:0"><b class="ell" style="font-size:14px">${s.title}</b><span class="mut">${u.name}</span><span class="mut">${s.where}</span><div class="row" style="gap:4px;margin-top:4px">${s.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div></div></div></div>`;
};

const followed = [
    ['maks', 'Кіноклуб', 86],
    ['sofia', 'Counter-Strike 2', 41],
    ['olena', 'Музика', 23],
    ['ivan', 'Голосовий · SCL'],
    ['vika'],
    ['andrew'],
];

const desktop = `<div class="t col" style="height:100%">
  <div class="row top"><span style="color:var(--acc)">${ic('gamepad-2', 28)}</span><span>Стежу</span><span>Огляд</span><span class="mut">${ic('ellipsis-vertical', 20)}</span><span class="grow"></span><div class="row" style="width:380px;height:36px;background:var(--s2);border:1px solid #3a3a3d;border-radius:6px;padding:0 10px;color:var(--mut);font-weight:400;font-size:14px;justify-content:space-between">Пошук${ic('search', 18)}</div><span class="grow"></span>${ic('crown', 20, 'color:#bf94ff')}${ic('bell', 20)}${ic('message-square', 20)}<span class="btn">${ic('plus', 16)}Створити</span>${avatar(me, 30)}</div>
  <div class="row grow" style="align-items:stretch;overflow:hidden">
    <div class="col side"><div class="sh row" style="justify-content:space-between">Друзі зараз ${ic('arrow-left-to-line', 18, 'color:var(--mut)')}</div>
      ${followed.map(([k, act, v]) => `<div class="row ch" style="${act ? '' : 'opacity:.45'}">${avatar(people[k], 30)}<div class="col grow" style="min-width:0"><b class="ell">${people[k].name}</b><span class="mut ell">${act ?? 'Не в мережі'}</span></div>${v ? `<span class="row" style="gap:5px"><span class="livedot"></span>${v}</span>` : act ? '<span class="mut">●</span>' : ''}</div>`).join('')}
      <div class="sh" style="margin-top:14px">Спільноти</div>
      ${communities.map((c) => `<div class="row ch">${avatar(c, 30, 'border-radius:6px;font-size:10px')}<b class="grow ell">${c.name}</b>${c.unread ? `<span style="background:var(--acc);border-radius:8px;padding:0 6px;font-weight:600">${c.unread}</span>` : ''}</div>`).join('')}
    </div>
    <div class="col grow" style="padding:0 30px;overflow:hidden">
      <div class="row" style="gap:20px;margin-top:24px;height:330px">
        <div style="position:relative">${cover(movies[0], 586, 330, 'border-radius:6px')}<span class="lv" style="top:12px;left:12px;font-size:13px">Наживо</span><div class="row" style="position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(transparent,rgba(0,0,0,.8));padding:0 14px;gap:14px;justify-content:flex-end">${ic('volume-2', 20)}${ic('maximize', 20)}</div></div>
        <div class="col grow" style="background:var(--s);border-radius:6px;padding:20px;gap:10px"><div class="row" style="gap:10px">${avatar(people.maks, 50)}<div class="col"><b style="font-size:16px;color:#bf94ff">Максим Олійник</b><span class="mut">Кіноклуб · 86 глядачів</span></div></div><b style="font-size:18px;line-height:1.25">Кіноклуб: дивимось Sintel разом — п’ятниця, українською</b><div class="row" style="gap:4px"><span class="tag">Кіно</span><span class="tag">Українською</span><span class="tag">Фентезі</span></div><p class="mut" style="font-size:14px;line-height:1.45">Спільний перегляд з чатом. Після фільму — голосування, що дивимось наступного тижня.</p><div class="row" style="gap:8px;margin-top:auto"><span class="btn">${ic('play', 16)}Приєднатися</span><span class="gbtn">${ic('heart', 16)}Стежити</span><span class="gbtn">${ic('calendar', 16)}Нагадати</span></div></div>
      </div>
      <div class="shelf"><b>Наживо</b> у ваших друзів</div>
      <div class="row" style="gap:20px">${streams.map((s) => streamCard(s, 340)).join('')}</div>
      <div class="shelf">Новинки в <b>кіно</b></div>
      <div class="row" style="gap:20px">${movies.map((m) => `<div class="col" style="gap:6px">${cover(m, 150, 200)}<b>${m.t}</b><span class="mut">${m.y} · ${m.g} · ★ ${m.r}</span></div>`).join('')}</div>
    </div>
  </div>
</div>`;

const mobileFeed = `<div class="t col" style="height:100%">
  <div class="row top" style="height:56px;gap:14px"><span style="color:var(--acc)">${ic('gamepad-2', 28)}</span><span class="grow"></span>${ic('bell', 22)}${ic('message-square', 22)}${ic('search', 22)}${avatar(me, 30)}</div>
  <div class="row" style="gap:20px;padding:10px 16px 0;font-weight:600;font-size:15px"><span style="border-bottom:2px solid var(--acc);padding-bottom:8px;color:#bf94ff">Стежу</span><span class="mut" style="padding-bottom:8px">Огляд</span><span class="mut" style="padding-bottom:8px">Кіно</span><span class="mut" style="padding-bottom:8px">Музика</span></div>
  <div class="col grow" style="padding:0 16px;overflow:hidden">
    <div class="shelf" style="font-size:16px;margin-top:14px">Друзі <b>наживо</b></div>
    <div class="row" style="gap:14px">${followed.slice(0, 5).map(([k, a, v]) => `<div class="col" style="align-items:center;gap:4px;width:58px"><div style="padding:2px;border-radius:50%;border:2px solid ${v ? 'var(--live)' : 'var(--s3)'}">${avatar(people[k], 48)}</div>${v ? `<span class="lv" style="position:static;margin-top:-12px;font-size:10px">Наживо</span>` : `<span class="mut" style="font-size:11px">${people[k].name.split(' ')[0]}</span>`}</div>`).join('')}</div>
    <div class="shelf" style="font-size:16px">Рекомендовані <b>трансляції</b></div>
    <div class="col" style="gap:16px">${streams.slice(0, 2).map((s) => streamCard(s, 358)).join('')}</div>
  </div>
  <div class="row" style="height:60px;background:var(--s);justify-content:space-around;font-size:11px;font-weight:600;color:var(--mut)">${[['heart', 'Стежу', 1], ['compass', 'Огляд'], ['film', 'Кіно'], ['message-square', 'Чати'], ['user', 'Профіль']].map(([n, l, on]) => `<div class="col" style="align-items:center;gap:3px;${on ? 'color:#bf94ff' : ''}">${ic(n, 24, on ? 'fill:#bf94ff' : '')}${l}</div>`).join('')}</div>
</div>`;

const nickColor = { andrew: '#ff7f50', ivan: '#1e90ff', sofia: '#ff69b4', me: '#9acd32', maks: '#daa520' };
const badges = { andrew: `<span style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:3px;background:#00ad03;vertical-align:-4px;margin-right:3px">${ic('shield', 12)}</span>`, me: `<span style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:3px;background:var(--acc);vertical-align:-4px;margin-right:3px">${ic('crown', 12)}</span>` };

const mobileChat = `<div class="t col" style="height:100%">
  <div style="position:relative">${cover({ t: '', c: ['#451a03', '#f59e0b'] }, 390, 219, 'border-radius:0')}<span class="lv">Наживо</span><span class="vw">48 у голосовому</span><div style="position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:22px;text-align:center">Тижневі збори<br>[SCL] Scaletta Family</div></div>
  <div class="row" style="gap:10px;padding:10px 12px;background:var(--s)">${avatar(communities[0], 36)}<div class="col grow"><b style="font-size:14px">[SCL] Scaletta Family</b><span class="mut">Голосовий канал · 12 учасників</span></div><span class="btn">${ic('mic', 16)}Увійти</span></div>
  <div class="row" style="justify-content:space-between;padding:8px 12px;border-bottom:1px solid #2a2a2d;font-weight:600;font-size:12px;text-transform:uppercase">Чат сім’ї ${ic('users', 18, 'color:var(--mut)')}</div>
  <div class="col grow" style="justify-content:flex-end;padding-bottom:8px;overflow:hidden;background:var(--s)">
    <div class="cl" style="background:var(--s2);margin:0 10px 8px;border-radius:6px;border-left:3px solid var(--acc)">${ic('pin', 14, 'vertical-align:-2px;margin-right:4px;color:#bf94ff')}<b>Закріплено:</b> збори завтра о 17:00, скріни звітів — до неділі</div>
    ${thread.map((m) => `<div class="cl" style="padding:4px 12px">${badges[m.who] ?? ''}<b style="color:${nickColor[m.who]}">${m.who === 'me' ? 'Марк' : who(m.who).name.split(' ')[0]}</b>: ${m.text}</div>`).join('')}
    <div class="cl" style="padding:4px 12px;color:var(--mut)"><i>Іван приєднався до голосового</i></div>
  </div>
  <div class="row" style="gap:8px;padding:8px 10px 18px;background:var(--s)"><div class="row grow" style="height:40px;border-radius:6px;background:var(--s3);padding:0 10px;color:var(--mut);justify-content:space-between">Надіслати повідомлення${ic('smile', 20)}</div><span class="btn" style="height:40px">Чат</span></div>
</div>`;

export default page('Варіант 4 — Twitch / Steam', css, [
    ['desktop-feed', 'desktop', desktop],
    ['mobile-feed', 'mobile', mobileFeed],
    ['mobile-chat', 'mobile', mobileChat],
]);
