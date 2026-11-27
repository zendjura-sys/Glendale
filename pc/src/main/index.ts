import { spawn } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { loadCore } from './native';
import { Session } from './session';
import { isModuleId as isModule, type Mode, type ModuleId, WindowManager } from './windows';

/**
 * Установник Squirrel (як у Discord): під час встановлення, оновлення й видалення Windows запускає
 * програму з --squirrel-*; створюємо чи прибираємо ярлики (Пуск, робочий стіл) і одразу виходимо.
 */
function handleSquirrel(): boolean {
    const command = process.platform === 'win32' ? process.argv[1] : undefined;
    if (!command?.startsWith('--squirrel-')) return false;
    const update = join(dirname(process.execPath), '..', 'Update.exe');
    const exe = basename(process.execPath);
    const run = (args: string[]): void => {
        spawn(update, args, { detached: true }).on('close', () => app.quit());
    };
    if (command === '--squirrel-install' || command === '--squirrel-updated') run(['--createShortcut', exe]);
    else if (command === '--squirrel-uninstall') run(['--removeShortcut', exe]);
    else app.quit();
    return true;
}

const squirrel = handleSquirrel();
// Один екземпляр: другий запуск лише показує вже відкрите вікно.
if (!squirrel && !app.requestSingleInstanceLock()) app.quit();

const core = loadCore();
let store: InstanceType<typeof core.Store>;
let session: Session;
let windows: WindowManager;
let tray: Tray | null = null;

/** Налаштування програми: оверлей, автозапуск і модулі, які людина сама обрала (з увімкнених їй розділів). */
type Settings = { overlay: 'auto' | 'always' | 'off'; launchAtLogin: boolean; modules: ModuleId[] };
const defaults: Settings = { overlay: 'auto', launchAtLogin: false, modules: ['feed', 'messenger', 'friends', 'activity'] };
const settings = (): Settings => ({ ...defaults, ...((store.get('settings') as Partial<Settings> | null) ?? {}) });

function registerIpc(): void {
    // Вікно.
    ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
    ipcMain.handle('window:toggle-maximize', (e) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        if (win) (win.isMaximized() ? win.unmaximize() : win.maximize());
    });
    ipcMain.handle('window:close', (e) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        // Хрестик головного вікна — у трей: чати, дзвінки й оверлей працюють далі.
        if (win === windows.main) win?.hide();
        else win?.close();
    });

    // Режими й віджети.
    ipcMain.handle('layout:state', () => windows.snapshot());
    ipcMain.handle('layout:mode', (_e, mode: Mode) => windows.setMode(mode === 'widgets' ? 'widgets' : 'unified'));
    ipcMain.handle('layout:detach', (_e, id: unknown) => isModule(id) && windows.detach(id));
    ipcMain.handle('layout:toggle', (_e, id: unknown) => isModule(id) && windows.toggleWidget(id));
    ipcMain.handle('layout:hide', (_e, id: unknown) => isModule(id) && windows.hideWidget(id));
    ipcMain.handle('layout:pin', (_e, id: unknown, on: boolean) => isModule(id) && windows.pin(id, !!on));
    ipcMain.handle('layout:reset', () => windows.resetLayout());

    // Сесія й API (токен лише в Main).
    ipcMain.handle('session:signed-in', () => session.signedIn);
    ipcMain.handle('session:save', (_e, token: string) => {
        session.save(String(token));
        windows.broadcast('session', true);
    });
    ipcMain.handle('session:logout', async () => {
        await session.request('POST', '/api/v1/logout');
        session.clear();
        windows.broadcast('session', false);
    });
    ipcMain.handle('api', (_e, method: string, path: string, body?: unknown) => {
        if (typeof path !== 'string' || !path.startsWith('/api/')) return { ok: false, status: 400, message: 'Недозволений запит.' };
        return session.request(String(method).toUpperCase(), path, body);
    });

    // Синхронізація: подія з одного вікна (нове повідомлення, лайк) — в усі інші.
    ipcMain.on('sync', (e, topic: string, payload: unknown) => windows.broadcast('sync', { topic, payload }, e.sender));

    // Налаштування програми.
    ipcMain.handle('settings:get', () => settings());
    ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
        const next = { ...settings(), ...patch, modules: (patch.modules ?? settings().modules).filter(isModule) };
        store.set('settings', next);
        app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'] });
        if (next.overlay === 'always') windows.setGameOverlay(true);
        if (next.overlay === 'off') windows.setGameOverlay(false);
        windows.broadcast('settings', next);
        windows.broadcast('state', windows.snapshot());
        return next;
    });
}

/** Ігровий оверлей і статус «Граю»: раз на 3 с ядро дивиться, що на передньому плані. */
function watchGames(): void {
    let current: string | null = null;
    let ticks = 0;
    setInterval(() => {
        const game = core.foregroundGame(process.pid);
        const mode = settings().overlay;
        windows.setGameOverlay(mode === 'always' || (mode === 'auto' && game !== null));
        ticks++;
        // Друзям — що за гра (сервер розпізнає гру чи сервер з каталогу); зміна — одразу, інакше раз на ~15 с.
        if (session.signedIn && (game !== current || (game !== null && ticks % 5 === 0))) {
            current = game;
            void session.request('POST', '/api/v1/me/playing/pc', { title: game });
            windows.broadcast('game', game);
        }
    }, 3000);
}

function createTray(): void {
    const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'));
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('GameCon');
    const menu = (): Menu =>
        Menu.buildFromTemplate([
            { label: 'Відкрити GameCon', click: () => windows.setMode('unified') },
            { label: 'Режим віджетів', type: 'checkbox', checked: windows.mode === 'widgets', click: (i) => windows.setMode(i.checked ? 'widgets' : 'unified') },
            { type: 'separator' },
            { label: 'Оверлей у грі: авто', type: 'radio', checked: settings().overlay === 'auto', click: () => store.set('settings', { ...settings(), overlay: 'auto' }) },
            { label: 'Оверлей завжди поверх', type: 'radio', checked: settings().overlay === 'always', click: () => store.set('settings', { ...settings(), overlay: 'always' }) },
            { label: 'Без оверлею', type: 'radio', checked: settings().overlay === 'off', click: () => store.set('settings', { ...settings(), overlay: 'off' }) },
            { type: 'separator' },
            { label: 'Вийти', click: () => app.exit(0) },
        ]);
    tray.setContextMenu(menu());
    tray.on('click', () => windows.setMode('unified'));
    tray.on('right-click', () => tray?.setContextMenu(menu()));
}

/** Глобальні клавіші (діють і в грі): показати GameCon, перемкнути режим віджетів. */
function registerHotkeys(): void {
    globalShortcut.register('CommandOrControl+Shift+G', () => windows.setMode('unified'));
    globalShortcut.register('CommandOrControl+Shift+O', () => windows.setMode(windows.mode === 'widgets' ? 'unified' : 'widgets'));
}

app.on('second-instance', () => windows?.setMode('unified'));

app.whenReady().then(() => {
    if (squirrel) return;
    store = new core.Store(join(app.getPath('userData'), 'core'));
    session = new Session(store);
    windows = new WindowManager(core, store, () => settings().modules, join(__dirname, '../preload/index.js'), process.env.ELECTRON_RENDERER_URL, join(__dirname, '../renderer/index.html'));
    registerIpc();
    createTray();
    registerHotkeys();
    watchGames();
    const hidden = process.argv.includes('--hidden');
    if (windows.mode === 'widgets') windows.setMode('widgets');
    else if (!hidden) windows.showMain();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
// Програма живе в треї — закриття всіх вікон не завершує її.
app.on('window-all-closed', () => undefined);
