'use strict';

/**
 * GameCon для Windows (№261): сайт у власному вікні, значок у треї й оверлей тривог поверх ігор.
 *
 * Оверлей — прозоре вікно «завжди згори», що не перехоплює кліки (крім кнопки «Я в укритті»).
 * Видно в іграх у віконному й безрамковому режимах; у ексклюзивному повноекранному Windows
 * не дає малювати поверх — тоді лишається системне сповіщення зі звуком.
 * Дані — ті самі, що на сайті: /alerts/state з cookie входу (людина увійшла в головному вікні).
 */
const { app, BrowserWindow, Menu, Notification, Tray, net, screen, session, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { alertView, transition, xsrfHeader } = require('./alerts');

const SITE = process.env.GAMECON_URL || 'https://gamecon.online';
const POLL_MS = 20_000;
const ICON = path.join(__dirname, 'icon.png');

let main = null;
let overlay = null;
let tray = null;
let current = null;
let timer = null;

// ——— Налаштування (userData/settings.json) ———
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaults = { overlay: true, sound: true, startHidden: true };
function readSettings() {
    try {
        return { ...defaults, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
    } catch {
        return { ...defaults };
    }
}
let settings = defaults;
function saveSettings(patch) {
    settings = { ...settings, ...patch };
    try {
        fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
    } catch {
        // Немає доступу до теки — налаштування діють до перезапуску.
    }
    buildTray();
}

// ——— Вікна ———
function createMain() {
    main = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 420,
        minHeight: 560,
        title: 'GameCon',
        icon: ICON,
        backgroundColor: '#131313',
        show: !(process.argv.includes('--hidden') && settings.startHidden),
        webPreferences: { contextIsolation: true, sandbox: true },
    });
    main.removeMenu();
    void main.loadURL(`${SITE}/feed`);
    // Зовнішні посилання — у браузері, сайт — у вікні.
    main.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(SITE)) void shell.openExternal(url);
        return { action: url.startsWith(SITE) ? 'allow' : 'deny' };
    });
    // Хрестик ховає в трей — тривоги стежаться далі.
    main.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            main.hide();
        }
    });
}

function createOverlay() {
    const area = screen.getPrimaryDisplay().workArea;
    const width = 380;
    overlay = new BrowserWindow({
        width,
        height: 132,
        x: area.x + area.width - width - 16,
        y: area.y + 16,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        show: false,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
    });
    // Рівень «screen-saver» — вище за ігри у віконному/безрамковому режимі.
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlay.setIgnoreMouseEvents(true, { forward: true });
    void overlay.loadFile(path.join(__dirname, 'overlay.html'));
}

// ——— Тривоги ———
function request(method, route, body) {
    return new Promise((resolve, reject) => {
        const req = net.request({ method, url: `${SITE}${route}`, useSessionCookies: true });
        req.setHeader('Accept', 'application/json');
        req.setHeader('X-Requested-With', 'XMLHttpRequest');
        const send = async () => {
            if (method !== 'GET') {
                const [cookie] = await session.defaultSession.cookies.get({ url: SITE, name: 'XSRF-TOKEN' });
                const token = xsrfHeader(cookie?.value);
                if (token) req.setHeader('X-XSRF-TOKEN', token);
                req.setHeader('Content-Type', 'application/json');
            }
            let data = '';
            req.on('response', (res) => {
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.end(body ? JSON.stringify(body) : undefined);
        };
        void send().catch(reject);
    });
}

async function poll() {
    let next;
    try {
        const state = await request('GET', '/alerts/state');
        next = alertView(state.prefs);
    } catch {
        return; // Не увійшли, немає мережі чи розділ недоступний — пробуємо наступного разу.
    }
    const change = transition(current, next);
    current = next;
    if (change === 'start' && next) {
        new Notification({ title: next.title, body: [next.place, next.duration].filter(Boolean).join(' · '), icon: ICON, urgency: 'critical' }).show();
    } else if (change === 'end') {
        new Notification({ title: 'Відбій тривоги', body: 'Тривогу у вашому місці скасовано.', icon: ICON }).show();
    }
    if (overlay) {
        overlay.webContents.send('alert', next ? { ...next, sound: change === 'start' && settings.sound } : null);
        if (next && settings.overlay) overlay.showInactive();
        else overlay.hide();
    }
    buildTray();
}

ipcMain.handle('shelter', async (_event, on) => {
    try {
        const data = await request('PUT', '/alerts/preferences', { shelter: on === true });
        current = alertView(data.prefs);
        overlay?.webContents.send('alert', current);
        return true;
    } catch {
        return false;
    }
});
// Кнопка в оверлеї: поки миша над нею — вікно приймає кліки, інакше пропускає їх у гру.
ipcMain.on('interactive', (_event, on) => overlay?.setIgnoreMouseEvents(!on, { forward: true }));
ipcMain.on('open-alerts', () => showMain('/alerts'));

// ——— Трей ———
function showMain(route) {
    if (!main) return;
    if (route) void main.loadURL(`${SITE}${route}`);
    main.show();
    main.focus();
}

function buildTray() {
    if (!tray) return;
    tray.setToolTip(current ? `GameCon — ${current.title}` : 'GameCon');
    tray.setContextMenu(
        Menu.buildFromTemplate([
            { label: 'Відкрити GameCon', click: () => showMain() },
            { label: 'Мапа тривог', click: () => showMain('/alerts') },
            { type: 'separator' },
            { label: 'Оверлей тривог поверх ігор', type: 'checkbox', checked: settings.overlay, click: (item) => saveSettings({ overlay: item.checked }) },
            { label: 'Звук на початку тривоги', type: 'checkbox', checked: settings.sound, click: (item) => saveSettings({ sound: item.checked }) },
            {
                label: 'Запускати разом з Windows',
                type: 'checkbox',
                checked: app.getLoginItemSettings().openAtLogin,
                click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
            },
            { type: 'separator' },
            {
                label: 'Вийти',
                click: () => {
                    app.isQuitting = true;
                    app.quit();
                },
            },
        ]),
    );
}

// ——— Старт ———
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => showMain());
    app.whenReady().then(() => {
        app.setAppUserModelId('online.gamecon.desktop');
        settings = readSettings();
        createMain();
        createOverlay();
        tray = new Tray(ICON);
        tray.on('click', () => showMain());
        buildTray();
        void poll();
        timer = setInterval(() => void poll(), POLL_MS);
    });
    app.on('before-quit', () => {
        app.isQuitting = true;
        if (timer) clearInterval(timer);
    });
    // Усі вікна сховані — застосунок живе в треї.
    app.on('window-all-closed', (event) => event.preventDefault());
}
