import fs from 'node:fs';

const ICONS = '/tmp/claude-0/shots/p2/lucide/package/icons';
const FONT = '/tmp/claude-0/shots/p2/fontsource-variable-inter-5.3.0/package/files';

export function ic(name, size = 20, style = '') {
    let svg = fs.readFileSync(`${ICONS}/${name}.svg`, 'utf8');
    svg = svg.replace(/<!--[\s\S]*?-->/g, '').trim();
    return svg
        .replace(/width="24"/, `width="${size}"`)
        .replace(/height="24"/, `height="${size}"`)
        .replace('<svg', `<svg style="flex:none;${style}"`);
}

export const fontCss = ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext']
    .map(
        (s) => `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;src:url(file://${FONT}/inter-${s}-wght-normal.woff2) format('woff2');}`,
    )
    .join('\n');

// Дані з демо-наповнення GameCon (DemoSeeder) — ті самі люди, спільноти й події.
export const me = { name: 'Марк', handle: 'mark', ini: 'МШ', c: ['#8b5cf6', '#6366f1'] };
export const people = {
    sofia: { name: 'Софія Мельник', handle: 'sofia', ini: 'СМ', c: ['#f43f5e', '#ec4899'], online: true, verified: true },
    olena: { name: 'Олена Коваленко', handle: 'olena', ini: 'ОК', c: ['#d946ef', '#a855f7'], verified: true },
    maks: { name: 'Максим Олійник', handle: 'maksym', ini: 'МО', c: ['#7c3aed', '#6366f1'], online: true },
    vika: { name: 'Вікторія Шевчук', handle: 'vika', ini: 'ВШ', c: ['#a855f7', '#6366f1'] },
    ivan: { name: 'Іван Бондар', handle: 'ivan', ini: 'ІБ', c: ['#0ea5e9', '#6366f1'], online: true },
    andrew: { name: 'Andrew_Bonucci', handle: 'bonucci', ini: 'AB', c: ['#f59e0b', '#ef4444'] },
    nastya: { name: 'Анастасія Ткачук', handle: 'nastya', ini: 'АТ', c: ['#10b981', '#0ea5e9'] },
};

export const communities = [
    { name: '[SCL] Scaletta Family', short: 'SCL', c: ['#f59e0b', '#b45309'], members: 48, unread: 4 },
    { name: 'CS2 Україна', short: 'CS', c: ['#ec4899', '#8b5cf6'], members: 1240, unread: 0 },
    { name: 'GameCon Cup · CS2', short: 'GC', c: ['#6366f1', '#22d3ee'], members: 320, unread: 2 },
    { name: 'Кіноклуб', short: 'КК', c: ['#ef4444', '#f97316'], members: 96, unread: 3 },
];

export const posts = [
    {
        who: 'sofia',
        where: 'CS2 Україна',
        time: '12 хв',
        text: 'Шукаємо п’ятого в команду на GameCon Cup у суботу 🎧 Ранг від Gold Nova, мікрофон обов’язково. Пишіть у приват або тегайте друзів.',
        tag: '#пошук_пати',
        likes: 24,
        comments: 8,
        reposts: 3,
        views: '1,2 тис.',
    },
    {
        who: 'maks',
        where: 'Кіноклуб',
        time: '1 год',
        text: 'Що дивимось разом у п’ятницю о 20:00?',
        poll: [
            ['Sintel', 46],
            ['Сталеві сльози', 31],
            ['Космічна пральня', 23],
        ],
        votes: 57,
        likes: 15,
        comments: 12,
        reposts: 1,
        views: '890',
    },
    {
        who: 'olena',
        time: '3 год',
        text: 'Нарешті дописала трек для нашого стріму. Слухайте й кажіть чесно 💜',
        track: { title: 'Карпатський дрейф', artist: 'Тарас Гончаренко', dur: '3:42' },
        likes: 41,
        comments: 6,
        reposts: 5,
        views: '2,4 тис.',
    },
];

export const chats = [
    { title: '[SCL] Scaletta Family', group: 'SCL', from: 'Andrew_Bonucci', last: 'Нагадую: скріни звітів до неділі', time: '20:43', unread: 4 },
    { title: 'Олена Коваленко', p: 'olena', last: '🥰 Стікер', time: '20:37', unread: 3 },
    { title: 'GameCon Cup · CS2', group: 'GC', from: 'Іван', last: 'Голосове повідомлення', time: '20:29', unread: 2 },
    { title: 'Кіноклуб', group: 'КК', from: 'Анастасія', last: 'Даринко, наступного разу з нами?', time: '20:00', unread: 3, muted: true },
    { title: 'Софія Мельник', p: 'sofia', last: '🎉 Стікер', time: '19:52' },
    { title: 'Вікторія Шевчук', p: 'vika', last: 'Звісно, буду рада 💜', time: '14 жовт.' },
    { title: 'Максим Олійник', p: 'maks', last: 'Ви: Бери не думаючи! Panzer Dragoon…', time: '10 жовт.' },
];

// Одна розмова для екрана чату (група сім’ї).
export const thread = [
    { who: 'andrew', text: 'Всім привіт! Нагадую: скріни звітів до неділі 📸', time: '20:31' },
    { who: 'ivan', text: 'Скинув свої вчора в #звіти', time: '20:33' },
    { who: 'sofia', text: 'А збори завтра о 17:00 як завжди?', time: '20:35' },
    { who: 'me', text: 'Так, о 17:00 у голосовому. Буду з новим складом на Cup 🙌', time: '20:38' },
    { who: 'andrew', text: 'Супер. Хто не може — відпишіться тут, щоб я позначив у таблиці.', time: '20:41' },
    { who: 'sofia', text: 'Я буду 👍', time: '20:43' },
];

export const quests = [
    ['Завантажте фото', 0, 1, 10],
    ['Залиште 3 коментарі', 1, 3, 15],
    ['Проголосуйте за сервер', 0, 1, 15],
];

export const movies = [
    { t: 'Sintel', y: 2010, g: 'Фентезі', c: ['#7c2d12', '#f59e0b'], r: '7.4' },
    { t: 'Сталеві сльози', y: 2012, g: 'Фантастика', c: ['#0f172a', '#38bdf8'], r: '6.8' },
    { t: 'Великий кролик Бак', y: 2008, g: 'Мультфільм', c: ['#14532d', '#a3e635'], r: '6.5' },
    { t: 'Космічна пральня', y: 2015, g: 'Комедія', c: ['#312e81', '#f472b6'], r: '6.9' },
    { t: 'Агент 327', y: 2017, g: 'Пригоди', c: ['#1e293b', '#facc15'], r: '7.6' },
    { t: 'Спрайт: Лісовий жах', y: 2021, g: 'Мультфільм', c: ['#064e3b', '#34d399'], r: '7.1' },
];

export function who(key) {
    return key === 'me' ? me : people[key];
}

export function avatar(p, size, extra = '') {
    const fs2 = Math.round(size * 0.36);
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,${p.c[0]},${p.c[1]});color:#fff;font-weight:650;font-size:${fs2}px;letter-spacing:.02em;${extra}">${p.ini ?? p.short}</div>`;
}

export function page(title, css, frames) {
    return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${title}</title><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#888;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;padding:40px;display:flex;flex-direction:column;gap:40px;align-items:flex-start}
.frame{overflow:hidden;position:relative}
.frame.desktop{width:1440px;height:900px}
.frame.mobile{width:390px;height:844px}
.row{display:flex;align-items:center}
.col{display:flex;flex-direction:column}
.grow{flex:1;min-width:0}
.ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${css}
</style></head><body>${frames.map(([id, cls, html]) => `<div id="${id}" class="frame ${cls}">${html}</div>`).join('\n')}</body></html>`;
}
