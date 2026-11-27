import { join } from 'node:path';
import { BrowserWindow, screen, shell } from 'electron';
import type { Core, CoreStore, Rect, WindowState } from './native';

/** Модуль = розділ GameCon (feed, messenger, families, …); які показувати — обирає людина. */
export type ModuleId = string;
export type Mode = 'unified' | 'widgets';
export const isModuleId = (id: unknown): id is ModuleId => typeof id === 'string' && /^[a-z_]{2,24}$/.test(id) && !['main', 'dock', 'studio', 'call'].includes(id);

const WIDGET_SIZE: Record<string, { width: number; height: number }> = {
    feed: { width: 380, height: 520 },
    messenger: { width: 400, height: 540 },
    friends: { width: 320, height: 440 },
    activity: { width: 320, height: 380 },
};
const sizeOf = (id: ModuleId): { width: number; height: number } => WIDGET_SIZE[id] ?? { width: 340, height: 440 };
const SNAP = 14;
const GAP = 10;

/**
 * Менеджер вікон: режим А — одне безрамочне вікно; режим Б — рій незалежних прозорих віджетів
 * і плаваюча «пігулка» Control Dock. Геометрія кожного вікна живе в Rust-ядрі й відновлюється там,
 * де людина його залишила; при відпусканні вікно магнітно прилипає до країв екрана й сусідів.
 */
export class WindowManager {
    main: BrowserWindow | null = null;
    private widgets = new Map<ModuleId, BrowserWindow>();
    private dock: BrowserWindow | null = null;
    /** Ігровий оверлей увімкнув віджети сам — після гри повертаємо попередній режим. */
    gameOverlay = false;

    constructor(
        private readonly core: Core,
        private readonly store: CoreStore,
        /** Модулі, які людина обрала в налаштуваннях (лише з увімкнених їй розділів). */
        private readonly chosen: () => ModuleId[],
        private readonly preload: string,
        private readonly rendererUrl: string | undefined,
        private readonly rendererFile: string,
    ) {}

    get mode(): Mode {
        return this.store.mode === 'widgets' ? 'widgets' : 'unified';
    }

    private load(win: BrowserWindow, hash: string): void {
        if (this.rendererUrl) void win.loadURL(`${this.rendererUrl}#${hash}`);
        else void win.loadFile(this.rendererFile, { hash });
    }

    private create(options: Electron.BrowserWindowConstructorOptions, hash: string): BrowserWindow {
        const win = new BrowserWindow({
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            hasShadow: true,
            show: false,
            title: 'GameCon',
            ...options,
            webPreferences: { preload: this.preload, contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false },
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
            void shell.openExternal(url);
            return { action: 'deny' };
        });
        // Перехід усередині вікна на сторонні сторінки заборонено — лише інтерфейс GameCon.
        win.webContents.on('will-navigate', (e, url) => {
            if (!url.startsWith(this.rendererUrl ?? 'file://')) {
                e.preventDefault();
                void shell.openExternal(url);
            }
        });
        this.load(win, hash);
        return win;
    }

    /** Режим А: одне вікно. */
    showMain(): void {
        if (this.main && !this.main.isDestroyed()) {
            this.main.show();
            this.main.focus();
            return;
        }
        const saved = this.store.window('main');
        const area = screen.getPrimaryDisplay().workArea;
        const width = saved?.width ?? Math.min(1360, area.width - 80);
        const height = saved?.height ?? Math.min(860, area.height - 80);
        const win = this.create(
            { width, height, x: saved?.x ?? area.x + Math.round((area.width - width) / 2), y: saved?.y ?? area.y + Math.round((area.height - height) / 2), minWidth: 980, minHeight: 640 },
            '/',
        );
        win.once('ready-to-show', () => win.show());
        this.track(win, 'main');
        win.on('closed', () => {
            this.main = null;
        });
        this.main = win;
    }

    /** Режим Б: віджет модуля (відкріплений), там, де його залишили. */
    openWidget(id: ModuleId): void {
        const existing = this.widgets.get(id);
        if (existing && !existing.isDestroyed()) {
            existing.show();
            return;
        }
        const size = sizeOf(id);
        const saved = this.store.window(id);
        const index = Math.max(0, this.chosen().indexOf(id));
        const area = screen.getPrimaryDisplay().workArea;
        // Типове місце: дві колонки біля правого краю; висота не виходить за робочу область
        // (знизу лишаємо місце для пігулки Control Dock).
        const row = Math.floor(index / 2);
        const rowHeight = Math.floor((area.height - 120 - GAP) / 2);
        const height = Math.min(size.height, rowHeight);
        const state: WindowState = saved ?? {
            x: area.x + area.width - (index % 2 === 0 ? 2 : 1) * (size.width + GAP) - 16,
            y: area.y + 16 + (row % 2) * (rowHeight + GAP) + Math.floor(row / 2) * 24,
            width: size.width,
            height,
            alwaysOnTop: false,
            visible: true,
        };
        const win = this.create(
            { x: state.x, y: state.y, width: state.width, height: state.height, minWidth: 260, minHeight: 200, skipTaskbar: true, alwaysOnTop: state.alwaysOnTop },
            `/widget/${id}`,
        );
        if (state.alwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver');
        win.once('ready-to-show', () => win.showInactive());
        this.track(win, id);
        win.on('closed', () => this.widgets.delete(id));
        this.widgets.set(id, win);
        this.store.saveWindow(id, { ...state, visible: true });
    }

    /** Плаваюча «пігулка» Control Dock: зібрати все назад, показати/сховати віджети, скинути розклад. */
    private openDock(): void {
        if (this.dock && !this.dock.isDestroyed()) return this.dock.show();
        const area = screen.getPrimaryDisplay().workArea;
        const saved = this.store.window('dock');
        const win = this.create(
            { x: saved?.x ?? area.x + Math.round(area.width / 2 - 170), y: saved?.y ?? area.y + area.height - 88, width: 340, height: 72, resizable: false, skipTaskbar: true, alwaysOnTop: true },
            '/dock',
        );
        win.setAlwaysOnTop(true, 'screen-saver');
        win.once('ready-to-show', () => win.showInactive());
        this.track(win, 'dock');
        win.on('closed', () => {
            this.dock = null;
        });
        this.dock = win;
    }

    private studio: BrowserWindow | null = null;

    /** Студія LiveCast — окреме велике вікно (сцени, джерела, мікшер, ефір). */
    openStudio(): void {
        if (this.studio && !this.studio.isDestroyed()) {
            this.studio.show();
            this.studio.focus();
            return;
        }
        const area = screen.getPrimaryDisplay().workArea;
        const win = this.create({ width: Math.min(1480, area.width - 40), height: Math.min(920, area.height - 40), minWidth: 1100, minHeight: 700, center: true }, '/studio');
        win.once('ready-to-show', () => win.show());
        this.track(win, 'studio');
        win.on('closed', () => {
            this.studio = null;
        });
        this.studio = win;
    }

    call: BrowserWindow | null = null;

    /** Голосова кімната — окреме компактне вікно: дзвінок живе, хоч би як людина перемикала режими. */
    openCall(): void {
        if (this.call && !this.call.isDestroyed()) {
            this.call.show();
            this.call.focus();
            return;
        }
        const area = screen.getPrimaryDisplay().workArea;
        const saved = this.store.window('call');
        const win = this.create({ x: saved?.x ?? area.x + 24, y: saved?.y ?? area.y + area.height - 560, width: saved?.width ?? 340, height: saved?.height ?? 520, minWidth: 300, minHeight: 360, alwaysOnTop: true }, '/call');
        win.setAlwaysOnTop(true, 'screen-saver');
        win.once('ready-to-show', () => win.show());
        this.track(win, 'call');
        win.on('closed', () => {
            this.call = null;
        });
        this.call = win;
    }

    /** Перемкнути режим (Mode-Switch Toggle). */
    setMode(mode: Mode): void {
        this.store.setMode(mode);
        if (mode === 'widgets') {
            const saved = this.store.windows();
            const chosen = this.chosen();
            const open = chosen.filter((id) => saved[id]?.visible ?? true);
            for (const id of open.length ? open : chosen) this.openWidget(id);
            this.openDock();
            this.main?.hide();
        } else {
            for (const win of this.widgets.values()) win.destroy();
            this.widgets.clear();
            this.dock?.destroy();
            this.showMain();
        }
        this.broadcast('state', this.snapshot());
    }

    /** «Відкріпити» одну картку з єдиного вікна — у віджет (і перейти в режим віджетів). */
    detach(id: ModuleId): void {
        const saved = this.store.window(id);
        this.store.saveWindow(id, { ...(saved ?? this.defaultState(id)), visible: true });
        this.setMode('widgets');
    }

    /** Сховати віджет (у пігулці його можна показати знову). */
    hideWidget(id: ModuleId): void {
        const win = this.widgets.get(id);
        const saved = this.store.window(id);
        if (saved) this.store.saveWindow(id, { ...saved, visible: false });
        win?.destroy();
        this.widgets.delete(id);
        if (this.mode === 'widgets' && this.widgets.size === 0) this.setMode('unified');
        else this.broadcast('state', this.snapshot());
    }

    toggleWidget(id: ModuleId): void {
        if (this.widgets.has(id)) this.hideWidget(id);
        else {
            this.openWidget(id);
            this.broadcast('state', this.snapshot());
        }
    }

    /** Pin: «завжди поверх» (поверх ігор у віконному/безрамковому режимі). */
    pin(id: ModuleId, on: boolean): void {
        const win = this.widgets.get(id);
        win?.setAlwaysOnTop(on, 'screen-saver');
        const saved = this.store.window(id);
        if (saved) this.store.saveWindow(id, { ...saved, alwaysOnTop: on });
        this.broadcast('state', this.snapshot());
    }

    /** Ігровий оверлей: усі видимі віджети — поверх гри; після гри — як було. */
    setGameOverlay(on: boolean): void {
        if (on === this.gameOverlay) return;
        this.gameOverlay = on;
        if (on && this.mode !== 'widgets') this.setMode('widgets');
        for (const [id, win] of this.widgets) win.setAlwaysOnTop(on || (this.store.window(id)?.alwaysOnTop ?? false), 'screen-saver');
        this.broadcast('state', this.snapshot());
    }

    resetLayout(): void {
        this.store.resetWindows();
        if (this.mode === 'widgets') {
            for (const win of this.widgets.values()) win.destroy();
            this.widgets.clear();
            this.dock?.destroy();
            this.setMode('widgets');
        }
    }

    snapshot(): { mode: Mode; widgets: Record<string, { open: boolean; pinned: boolean }>; gameOverlay: boolean } {
        const saved = this.store.windows();
        return {
            mode: this.mode,
            gameOverlay: this.gameOverlay,
            widgets: Object.fromEntries(this.chosen().map((id) => [id, { open: this.widgets.has(id), pinned: saved[id]?.alwaysOnTop ?? false }])),
        };
    }

    /** Подія для всіх вікон (синхронізація даних і стану між режимами). */
    broadcast(channel: string, payload: unknown, except?: Electron.WebContents): void {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed() && win.webContents !== except) win.webContents.send(channel, payload);
        }
    }

    allWidgets(): BrowserWindow[] {
        return [...this.widgets.values()];
    }

    private defaultState(id: ModuleId): WindowState {
        const area = screen.getPrimaryDisplay().workArea;
        return { x: area.x + 40, y: area.y + 40, ...sizeOf(id), alwaysOnTop: false, visible: true };
    }

    /** Пам'ять геометрії + магнітне прилипання після переміщення. */
    private track(win: BrowserWindow, id: string): void {
        let timer: NodeJS.Timeout | null = null;
        const save = (): void => {
            if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
            const b = win.getBounds();
            const prev = this.store.window(id);
            this.store.saveWindow(id, { x: b.x, y: b.y, width: b.width, height: b.height, alwaysOnTop: prev?.alwaysOnTop ?? false, visible: prev?.visible ?? true });
        };
        const later = (): void => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(save, 300);
        };
        win.on('resize', later);
        win.on('moved', () => {
            if (id !== 'main' && !win.isDestroyed()) {
                const areas: Rect[] = screen.getAllDisplays().map((d) => d.workArea);
                const neighbors: Rect[] = [...this.widgets.values(), this.dock].filter((w): w is BrowserWindow => !!w && w !== win && !w.isDestroyed()).map((w) => w.getBounds());
                const snapped = this.core.snap(win.getBounds(), areas, neighbors, SNAP, GAP);
                win.setBounds(snapped, false);
            }
            later();
        });
        win.on('move', later);
    }
}
