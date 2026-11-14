/**
 * GameCon Overlay SDK для Web / CEF / Electron / WebView / Overwolf.
 * Збирається в /sdk/v1/gamecon-sdk.js (npm run sdk:build) — без залежностей, одним файлом.
 *
 *   GameConSDK.init({ clientId: 'gc_…', modules: ['hud', 'party', 'chat', 'family', 'drop'] });
 *
 * Полотно 100 % прозоре й не перехоплює кліки (гра їх отримує); клікабельні лише скляні віджети.
 * Вхід — OAuth 2.1: PKCE з поверненням на redirectUri або за кодом пристрою (gamecon.online/link).
 */
import css from './gamecon-overlay.css?raw';

type Dict = Record<string, string>;
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type ModuleKey = 'hud' | 'party' | 'chat' | 'family' | 'drop';
type TabKey =
    | 'friends'
    | 'party'
    | 'chat'
    | 'voice'
    | 'groups'
    | 'music'
    | 'achievements';
/** Розділ: вкладка єдиного вікна або окреме вікно; game — свої пункти гри, settings — шестерня. */
type Section = TabKey | 'game' | 'settings';
/** unified — усе одним вікном; separate — кожен розділ окремо; custom — на вибір. */
type Layout = 'unified' | 'separate' | 'custom';

export type GameConOptions = {
    clientId?: string;
    /** Готовий токен доступу (якщо гра вже увійшла сама — напр. нативний SDK передає його в CEF). */
    token?: string;
    /** Демо-дані без мережі (пісочниця, прев'ю в порталі). */
    demo?: boolean;
    base?: string;
    root?: HTMLElement;
    locale?: string;
    modules?: ModuleKey[];
    position?: Partial<Record<'hud' | 'party' | 'family', Corner>>;
    side?: 'left' | 'right' | 'top';
    offset?: number;
    hotkeys?: { toggle?: string; chat?: string };
    theme?: 'dark' | 'light' | 'auto';
    radius?: number;
    /** Щільність скла в активному режимі, 60–100. */
    density?: number;
    accent?: string;
    logo?: string | null;
    title?: string | null;
    tabs?: TabKey[];
    toasts?: Corner | 'top' | 'off';
    gamepad?: boolean;
    swipe?: boolean;
    hideWhenBusy?: boolean;
    /** Перетягування віджетів мишею. */
    draggable?: boolean;
    /** 'auto' — визначити, чи вміє рушій розмиття; false — одразу щільна підкладка (старі CEF). */
    blur?: boolean | 'auto';
    redirectUri?: string;
    scopes?: string[];
    /** Брати вигляд із порталу розробника (типово так). */
    remoteConfig?: boolean;
    /** Розділи одним вікном чи окремо (типово — як у порталі). */
    layout?: Layout;
    /** Для layout 'custom': які розділи — окремими вікнами. */
    windows?: Section[];
    /** Платформа (типово визначається сама): розробник може вимкнути оверлей для неї в порталі. */
    platform?: 'pc' | 'console' | 'mobile' | 'deck';
    /** Профілі за контекстом гри: які модулі видно в меню, лобі й матчі. */
    contexts?: Partial<Record<'menu' | 'lobby' | 'match', ModuleKey[]>>;
    /** Свої пункти гри в панелі: посилання або команда в гру (подія command). */
    customItems?: {
        label: string;
        url?: string | null;
        command?: string | null;
    }[];
    /** Привітання при першому запуску й підказка хоткея (перші 3 запуски). */
    onboarding?: boolean;
    hotkeyHint?: boolean;
    /** Режим стрімера: ховати ніки, повідомлення й коди входу. */
    streamer?: boolean;
    /** Масштаб віджетів, 80–130 %. */
    scale?: number;
    onReady?: (sdk: Sdk) => void;
    onLogin?: (user: User) => void;
    onEvent?: (name: string, data?: unknown) => void;
};

type User = {
    sub: string;
    preferred_username: string;
    name: string;
    picture: string | null;
};
type Friend = {
    id: number;
    username: string;
    name: string;
    avatar_url: string | null;
    online: boolean;
    presence?: { status: string; lobby: string | null } | null;
};
type Conversation = { id: number; title: string; unread?: number };
type Message = { id: number; body: string; mine: boolean; author?: string };
type Member = {
    name: string;
    avatar: string | null;
    online: boolean;
    mic?: 'on' | 'off' | 'speaking';
    rank?: string;
};

// ───────── Переклад ─────────
const DICT: Dict =
    (globalThis as unknown as { __GC_SDK_I18N__?: Dict }).__GC_SDK_I18N__ ?? {};
function tr(source: string, params?: Record<string, string | number>): string {
    const text = DICT[source] ?? source;
    return params
        ? text.replace(/\{(\w+)\}/g, (m, k: string) =>
              k in params ? String(params[k]) : m,
          )
        : text;
}

// ───────── Іконки Lucide (ISC) ─────────
const ICONS: Record<string, string> = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    micOff: '<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    gamepad:
        '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
    settings:
        '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    external:
        '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>',
    dock: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="m9 15 3-3 3 3"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
};
const icon = (name: string) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
const esc = (s: unknown) =>
    String(s ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c] as string,
    );
const initials = (name: string) =>
    name
        .split(/\s+/)
        .map((p) => p[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase();

const SECTION_ICONS: Record<Section, string> = {
    friends: 'users',
    party: 'swords',
    chat: 'chat',
    voice: 'mic',
    groups: 'shield',
    music: 'music',
    achievements: 'trophy',
    game: 'gamepad',
    settings: 'settings',
};
const SECTION_LABELS: Record<Section, string> = {
    friends: 'Друзі',
    party: 'Паті',
    chat: 'Чат',
    voice: 'Голос',
    groups: 'Сім’я й клан',
    music: 'Музика',
    achievements: 'Досягнення',
    game: 'Гра',
    settings: 'Налаштування',
};
/** Старі назви модулів (party/family/chat) ↔ розділи. */
const SECTION_MODULE: Partial<Record<Section, string>> = {
    party: 'party',
    groups: 'family',
    chat: 'chat',
};
const DEFAULT_CORNER: Partial<Record<Section, Corner>> = {
    friends: 'top-left',
    groups: 'top-right',
    party: 'bottom-left',
    voice: 'bottom-right',
    achievements: 'top-right',
    music: 'bottom-right',
    game: 'bottom-right',
};
const PRESETS: Record<string, ModuleKey[]> = {
    minimal: ['drop'],
    standard: ['hud', 'drop', 'chat'],
    full: ['hud', 'drop', 'chat', 'party', 'family'],
};

/** ПК, консоль, телефон чи Steam Deck — розробник може вимкнути оверлей для будь-якої. */
function detectPlatform(): 'pc' | 'console' | 'mobile' | 'deck' {
    const ua = navigator.userAgent;
    if (/PlayStation|Xbox|Nintendo/i.test(ua)) return 'console';
    if (
        /SteamDeck|Steam Deck/i.test(ua) ||
        (/Linux/.test(ua) && screen.width === 1280 && screen.height === 800)
    )
        return 'deck';
    if (/Android|iPhone|iPad|Mobile/i.test(ua)) return 'mobile';
    return 'pc';
}

// ───────── Демо-дані (пісочниця) ─────────
const DEMO = {
    user: {
        sub: '1',
        preferred_username: 'nova',
        name: 'Нова',
        picture: null,
    } as User,
    friends: [
        {
            id: 2,
            username: 'sashko',
            name: 'Сашко',
            avatar_url: null,
            online: true,
            presence: { status: 'У матчі · 12:40', lobby: 'A-7' },
        },
        {
            id: 3,
            username: 'marta',
            name: 'Марта',
            avatar_url: null,
            online: true,
            presence: { status: 'У лобі', lobby: 'A-7' },
        },
        {
            id: 4,
            username: 'dmytro',
            name: 'Дмитро',
            avatar_url: null,
            online: true,
            presence: null,
        },
        {
            id: 5,
            username: 'ira',
            name: 'Іра',
            avatar_url: null,
            online: false,
            presence: null,
        },
    ] as Friend[],
    party: [
        { name: 'Нова', avatar: null, online: true, mic: 'speaking' },
        { name: 'Сашко', avatar: null, online: true, mic: 'on' },
        { name: 'Марта', avatar: null, online: true, mic: 'off' },
    ] as Member[],
    family: {
        name: 'Black Rose',
        tag: 'BR',
        treasury: 1250000,
        my_balance: 42000,
        online: 7,
        members_count: 24,
        members: [
            { name: 'Tony Rose', avatar: null, online: true, rank: 'Лідер' },
            {
                name: 'Nova Rose',
                avatar: null,
                online: true,
                rank: 'Заступниця',
            },
            { name: 'Mark Rose', avatar: null, online: true, rank: 'Боєць' },
            { name: 'Ira Rose', avatar: null, online: false, rank: 'Новачок' },
        ] as Member[],
    },
    conversations: [
        { id: 1, title: 'Паті A-7', unread: 2 },
        { id: 2, title: 'Black Rose' },
        { id: 3, title: 'Сашко' },
    ] as Conversation[],
    messages: {
        1: [
            { id: 1, body: 'Хто на точку B?', mine: false, author: 'Сашко' },
            { id: 2, body: 'Я, вже біжу', mine: true },
            { id: 3, body: 'Тримаю праву', mine: false, author: 'Марта' },
        ],
        2: [
            {
                id: 4,
                body: 'Збір о 21:00 біля штабу',
                mine: false,
                author: 'Tony',
            },
        ],
        3: [{ id: 5, body: 'Го ще одну?', mine: false, author: 'Сашко' }],
    } as Record<number, Message[]>,
    track: { title: 'Midnight Drive', artist: 'Neon Lake', playing: true },
};

// ───────── Сам SDK ─────────
class Sdk {
    readonly version = '1.0.0';
    private o: GameConOptions & {
        base: string;
        demo: boolean;
        locale: string;
        modules: ModuleKey[];
        side: 'left' | 'right' | 'top';
        offset: number;
        theme: 'dark' | 'light' | 'auto';
        radius: number;
        density: number;
        accent: string;
        tabs: TabKey[];
        toasts: Corner | 'top' | 'off';
        gamepad: boolean;
        swipe: boolean;
        hideWhenBusy: boolean;
        draggable: boolean;
        blur: boolean | 'auto';
        scopes: string[];
        remoteConfig: boolean;
        position: Record<string, Corner>;
        hotkeys: { toggle: string; chat: string };
    };
    private vp!: HTMLDivElement;
    private token: string | null = null;
    private refresh: string | null = null;
    user: User | null = null;
    private tab: Section = 'friends';
    private open = false;
    private chatOpen = false;
    private conv: number | null = null;
    private busy = false;
    private handlers: Record<string, ((d?: unknown) => void)[]> = {};
    private timers: number[] = [];
    private device: { user_code: string; uri: string } | null = null;
    private cleanup: (() => void)[] = [];

    constructor(opts: GameConOptions) {
        this.o = {
            base: 'https://gamecon.online',
            demo: false,
            locale: (navigator.language || 'uk').slice(0, 2),
            modules: ['hud', 'drop'],
            side: 'left',
            offset: 50,
            theme: 'dark',
            radius: 22,
            density: 84,
            accent: '#4f7cff',
            tabs: [
                'friends',
                'chat',
                'voice',
                'groups',
                'music',
                'achievements',
            ],
            toasts: 'top-right',
            gamepad: true,
            swipe: true,
            hideWhenBusy: true,
            draggable: false,
            blur: 'auto',
            scopes: [
                'profile',
                'friends',
                'chat',
                'voice',
                'groups',
                'music',
                'presence',
                'invites',
                'achievements',
            ],
            remoteConfig: true,
            ...opts,
            position: {
                hud: 'top-right',
                party: 'bottom-left',
                family: 'top-left',
                ...(opts.position ?? {}),
            },
            hotkeys: {
                toggle: 'Shift+Tab',
                chat: 'Alt+G',
                ...(opts.hotkeys ?? {}),
            },
        };
        this.o.base = this.o.base.replace(/\/+$/, '');
        this.token = opts.token ?? null;
    }

    // ── Життєвий цикл ──
    async start(): Promise<this> {
        if (!this.o.demo && this.o.clientId && this.o.remoteConfig) {
            await this.loadRemote();
        }
        // Розробник вимкнув оверлей для цієї платформи — SDK працює лише як API.
        if (this.platforms[this.o.platform ?? detectPlatform()] === false)
            this.disabled = true;
        if (this.read('off') === '1') this.disabled = true;
        this.applyPrefs(
            JSON.parse(this.read('prefs') ?? '{}') as Record<string, unknown>,
        );
        this.mount();
        this.bindKeys();
        if (this.o.demo) {
            this.user = DEMO.user;
        } else {
            this.restore();
            await this.finishRedirect();
            if (this.token) await this.loadUser();
            if (this.user) await this.syncPrefs();
        }
        this.welcome =
            !this.o.demo &&
            !this.user &&
            !this.disabled &&
            this.o.onboarding !== false &&
            this.read('welcomed') !== '1';
        this.render();
        if (this.user) this.poll();
        this.hint();
        this.o.onReady?.(this);
        this.emit('ready');
        return this;
    }

    destroy(): void {
        this.timers.forEach((t) => clearInterval(t));
        this.cleanup.forEach((f) => f());
        this.vp?.remove();
    }

    /** Профіль за контекстом гри: 'menu' | 'lobby' | 'match' (модулі — з порталу розробника). */
    setContext(ctx: 'menu' | 'lobby' | 'match' | null): void {
        this.context = ctx;
        this.render();
        this.emit('context', ctx);
    }

    /** Модулі з урахуванням вибору гравця, пресета й контексту. */
    private modules(): Set<ModuleKey> {
        if (this.disabled) return new Set();
        const preset = this.prefs.preset as string | undefined;
        let list: ModuleKey[] =
            preset && preset !== 'custom' && PRESETS[preset]
                ? PRESETS[preset]
                : ((this.prefs.modules as ModuleKey[] | undefined) ??
                  this.o.modules);
        const ctx = this.context ? this.o.contexts?.[this.context] : undefined;
        if (ctx) list = list.filter((m) => ctx.includes(m));
        return new Set(list);
    }

    private applyPrefs(p: Record<string, unknown>) {
        this.prefs = p ?? {};
        if (p.positions) Object.assign(this.o.position, p.positions);
        if (typeof p.hotkey === 'string') this.o.hotkeys.toggle = p.hotkey;
        if (typeof p.chat_hotkey === 'string')
            this.o.hotkeys.chat = p.chat_hotkey;
        if (typeof p.gamepad === 'boolean') this.o.gamepad = p.gamepad;
        if (typeof p.density === 'number') this.o.density = p.density;
        if (typeof p.scale === 'number') this.o.scale = p.scale;
        if (typeof p.streamer === 'boolean') this.o.streamer = p.streamer;
        if (this.vp) this.applyVars();
    }

    /** Налаштування гравця з акаунта GameCon (синхронізація між пристроями). */
    private async syncPrefs() {
        try {
            const r = await this.api<{
                data: {
                    enabled: boolean;
                    prefs: Record<string, unknown>;
                    allowed: string[];
                };
            }>('overlay/prefs');
            this.playerCan = r.data.allowed;
            if (!r.data.enabled) this.disabled = true;
            this.applyPrefs(Array.isArray(r.data.prefs) ? {} : r.data.prefs);
            this.store('prefs', JSON.stringify(this.prefs));
        } catch {
            /* без мережі — локальна копія */
        }
    }

    /** Зберегти налаштування гравця: одразу локально, на сервер — з паузою. */
    savePrefs(patch: Record<string, unknown>, enabled?: boolean): void {
        this.applyPrefs({ ...this.prefs, ...patch });
        this.store('prefs', JSON.stringify(this.prefs));
        this.render();
        if (this.o.demo || !this.user) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => {
            void this.api('overlay/prefs', {
                method: 'PUT',
                body: JSON.stringify({
                    prefs: this.prefs,
                    ...(enabled === undefined ? {} : { enabled }),
                }),
            }).catch(() => undefined);
        }, 600);
    }

    /** «Скинути до варіанта гри». */
    async resetPrefs(): Promise<void> {
        this.prefs = {};
        this.store('prefs', null);
        if (!this.o.demo && this.user)
            await this.api('overlay/prefs', { method: 'DELETE' }).catch(
                () => undefined,
            );
        location.reload();
    }

    /** Вимкнути оверлей у цій грі (гравець). Увімкнути знову — у налаштуваннях GameCon чи гри. */
    disable(): void {
        this.disabled = true;
        this.open = this.chatOpen = false;
        this.store('off', '1');
        if (!this.o.demo && this.user)
            void this.api('overlay/prefs', {
                method: 'PUT',
                body: JSON.stringify({ enabled: false }),
            }).catch(() => undefined);
        this.render();
        this.emit('disabled');
    }
    enable(): void {
        this.disabled = false;
        this.store('off', null);
        if (!this.o.demo && this.user)
            void this.api('overlay/prefs', {
                method: 'PUT',
                body: JSON.stringify({ enabled: true }),
            }).catch(() => undefined);
        this.render();
        this.emit('enabled');
    }
    get isEnabled(): boolean {
        return !this.disabled;
    }

    /** Підказка хоткея — перші 3 запуски. */
    private hint() {
        if (this.disabled || this.o.hotkeyHint === false || this.o.demo) return;
        const n = Number(this.read('hints') ?? '0');
        if (n >= 3) return;
        this.store('hints', String(n + 1));
        setTimeout(
            () =>
                this.toast(
                    tr('{key} — відкрити GameCon', {
                        key: this.o.hotkeys.toggle,
                    }),
                    undefined,
                    'gamepad',
                ),
            1500,
        );
    }

    /** Змінити налаштування на льоту (пісочниця, гра в рантаймі). */
    configure(patch: Partial<GameConOptions>): void {
        Object.assign(this.o, patch, {
            position: { ...this.o.position, ...(patch.position ?? {}) },
            hotkeys: { ...this.o.hotkeys, ...(patch.hotkeys ?? {}) },
        });
        this.applyVars();
        this.render();
    }

    on(name: string, cb: (d?: unknown) => void): () => void {
        (this.handlers[name] ??= []).push(cb);
        return () => {
            this.handlers[name] = (this.handlers[name] ?? []).filter(
                (h) => h !== cb,
            );
        };
    }

    private emit(name: string, data?: unknown) {
        this.o.onEvent?.(name, data);
        (this.handlers[name] ?? []).forEach((h) => h(data));
        // Хост (рушій гри через CEF/iframe) отримує події теж.
        try {
            window.parent?.postMessage(
                { source: 'gamecon-sdk', event: name, data },
                '*',
            );
        } catch {
            /* немає батьківського вікна */
        }
    }

    // ── Публічні дії ──
    toggle(force?: boolean, tab?: TabKey): void {
        this.open = force ?? !this.open;
        if (tab) this.tab = tab;
        this.vp.dataset.mode = this.open || this.chatOpen ? 'active' : 'hud';
        this.render();
        this.emit(this.open ? 'open' : 'close');
    }
    openChat(force?: boolean): void {
        this.chatOpen = force ?? !this.chatOpen;
        this.vp.dataset.mode = this.open || this.chatOpen ? 'active' : 'hud';
        this.render();
        if (this.chatOpen)
            setTimeout(
                () =>
                    this.vp
                        .querySelector<HTMLInputElement>('.gc-sdk-input input')
                        ?.focus(),
                60,
            );
    }
    /** Гравець у бою: «крапля» й капсула ледь помітні, панелі закриваються. */
    setBusy(on: boolean): void {
        this.busy = on;
        if (this.o.hideWhenBusy) this.vp.dataset.busy = on ? '1' : '0';
        if (on) {
            this.open = false;
            this.chatOpen = false;
            this.vp.dataset.mode = 'hud';
            this.render();
        }
    }
    setMode(mode: 'hud' | 'active'): void {
        this.vp.dataset.mode = mode;
    }

    toast(title: string, body?: string, iconName = 'bell'): void {
        if (this.o.toasts === 'off') return;
        const box = this.vp.querySelector('.gc-sdk-toasts');
        if (!box) return;
        const el = document.createElement('div');
        el.className = 'gc-sdk-toast gc-sdk-frosted-glass gc-sdk-interactive';
        el.setAttribute('role', 'status');
        el.innerHTML = `<span class="gc-sdk-dot"></span>${icon(iconName)}<div class="gc-sdk-grow"><div class="gc-sdk-title">${esc(title)}</div>${body ? `<div class="gc-sdk-sub">${esc(body)}</div>` : ''}</div>`;
        box.prepend(el);
        requestAnimationFrame(() => (el.dataset.in = '1'));
        setTimeout(() => {
            el.dataset.in = '0';
            setTimeout(() => el.remove(), 300);
        }, 5000);
    }

    // API (для гри): усе, що вміє REST, — тут одним викликом.
    async api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
        if (!this.token) throw new Error('GameCon: not signed in');
        const res = await fetch(
            `${this.o.base}/api/developer/v1/${path.replace(/^\/+/, '')}`,
            {
                ...init,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}`,
                    ...(init.headers ?? {}),
                },
            },
        );
        if (res.status === 401 && this.refresh && (await this.renew())) {
            return this.api<T>(path, init);
        }
        if (!res.ok) throw new Error(`GameCon API ${res.status}`);
        return (await res.json()) as T;
    }
    setPresence(status: string | null, lobby?: string) {
        return this.o.demo
            ? Promise.resolve()
            : this.api('presence', {
                  method: 'PUT',
                  body: JSON.stringify({ status, lobby }),
              });
    }
    invite(username: string, lobby: string, url?: string) {
        if (this.o.demo) {
            this.toast(tr('Запрошення надіслано'), username);
            return Promise.resolve();
        }
        return this.api('invites', {
            method: 'POST',
            body: JSON.stringify({ username, lobby, url }),
        });
    }
    unlockAchievement(key: string) {
        return this.o.demo
            ? Promise.resolve()
            : this.api(`achievements/${encodeURIComponent(key)}/unlock`, {
                  method: 'POST',
              });
    }
    submitScore(board: string, score: number) {
        return this.o.demo
            ? Promise.resolve()
            : this.api(`leaderboards/${encodeURIComponent(board)}/scores`, {
                  method: 'POST',
                  body: JSON.stringify({ score }),
              });
    }
    /** Дані для LiveKit-клієнта гри: { url, token, room }. */
    joinVoice(room: string, listenOnly = false) {
        return this.api(`voice/rooms/${encodeURIComponent(room)}/join`, {
            method: 'POST',
            body: JSON.stringify({ listen_only: listenOnly }),
        });
    }

    // ── Вхід (OAuth 2.1) ──
    private key(k: string) {
        return `gc_sdk_${this.o.clientId ?? 'demo'}_${k}`;
    }
    private store(k: string, v: string | null) {
        try {
            if (v === null) localStorage.removeItem(this.key(k));
            else localStorage.setItem(this.key(k), v);
        } catch {
            /* приватний режим */
        }
    }
    private read(k: string): string | null {
        try {
            return localStorage.getItem(this.key(k));
        } catch {
            return null;
        }
    }
    private restore() {
        if (this.token) return;
        this.token = this.read('access');
        this.refresh = this.read('refresh');
    }
    private saveTokens(t: { access_token: string; refresh_token?: string }) {
        this.token = t.access_token;
        this.refresh = t.refresh_token ?? this.refresh;
        this.store('access', this.token);
        this.store('refresh', this.refresh);
    }
    private async tokenRequest(body: Record<string, string>) {
        const res = await fetch(`${this.o.base}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({
                client_id: this.o.clientId ?? '',
                ...body,
            }),
        });
        return {
            ok: res.ok,
            json: (await res.json().catch(() => ({}))) as Record<
                string,
                string
            >,
        };
    }
    private async renew(): Promise<boolean> {
        const r = await this.tokenRequest({
            grant_type: 'refresh_token',
            refresh_token: this.refresh ?? '',
        });
        if (!r.ok) {
            this.logout();
            return false;
        }
        this.saveTokens(
            r.json as { access_token: string; refresh_token: string },
        );
        return true;
    }

    /** Вхід через браузер (PKCE). Якщо redirectUri не задано — за кодом пристрою. */
    async login(): Promise<void> {
        if (this.o.demo) return;
        if (!this.o.redirectUri) return this.loginWithCode();
        const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = b64url(
            new Uint8Array(
                await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(verifier),
                ),
            ),
        );
        const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
        this.store('pkce', JSON.stringify({ verifier, state }));
        const q = new URLSearchParams({
            response_type: 'code',
            client_id: this.o.clientId ?? '',
            redirect_uri: this.o.redirectUri,
            scope: this.o.scopes.join(' '),
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
        });
        location.assign(`${this.o.base}/oauth/authorize?${q}`);
    }
    private async finishRedirect() {
        const url = new URL(location.href);
        const code = url.searchParams.get('code');
        const saved = this.read('pkce');
        if (!code || !saved) return;
        const { verifier, state } = JSON.parse(saved) as {
            verifier: string;
            state: string;
        };
        if (url.searchParams.get('state') !== state) return;
        this.store('pkce', null);
        const r = await this.tokenRequest({
            grant_type: 'authorization_code',
            code,
            code_verifier: verifier,
            redirect_uri: this.o.redirectUri ?? '',
        });
        if (r.ok)
            this.saveTokens(
                r.json as { access_token: string; refresh_token: string },
            );
        ['code', 'state', 'iss'].forEach((k) => url.searchParams.delete(k));
        history.replaceState(null, '', url.toString());
    }
    /** RFC 8628: код і QR у панелі, гравець підтверджує на телефоні — гра входить сама. */
    async loginWithCode(): Promise<void> {
        const res = await fetch(`${this.o.base}/oauth/device`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({
                client_id: this.o.clientId ?? '',
                scope: this.o.scopes.join(' '),
            }),
        });
        const d = (await res.json()) as {
            device_code: string;
            user_code: string;
            verification_uri_complete: string;
            interval: number;
            expires_in: number;
        };
        if (!res.ok) return;
        this.device = {
            user_code: d.user_code,
            uri: d.verification_uri_complete,
        };
        this.toggle(true);
        let wait = (d.interval || 5) * 1000;
        const until = Date.now() + d.expires_in * 1000;
        const tick = async () => {
            if (!this.device || Date.now() > until) {
                this.device = null;
                this.render();
                return;
            }
            const r = await this.tokenRequest({
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                device_code: d.device_code,
            });
            if (r.ok) {
                this.device = null;
                this.saveTokens(
                    r.json as { access_token: string; refresh_token: string },
                );
                await this.loadUser();
                this.render();
                this.poll();
                return;
            }
            if (r.json.error === 'slow_down') wait += 5000;
            if (
                r.json.error === 'access_denied' ||
                r.json.error === 'expired_token'
            ) {
                this.device = null;
                this.render();
                return;
            }
            setTimeout(tick, wait);
        };
        setTimeout(tick, wait);
    }
    logout(): void {
        this.token = this.refresh = null;
        this.user = null;
        this.store('access', null);
        this.store('refresh', null);
        this.render();
        this.emit('logout');
    }
    private async loadUser() {
        try {
            this.user = await this.api<User>('userinfo');
            this.o.onLogin?.(this.user);
            this.emit('login', this.user);
        } catch {
            this.user = null;
        }
    }
    private async loadRemote() {
        try {
            const r = await fetch(
                `${this.o.base}/api/developer/v1/sdk/config/${encodeURIComponent(this.o.clientId ?? '')}`,
            );
            if (!r.ok) return;
            const c = (
                (await r.json()) as {
                    data: { overlay: Record<string, unknown> };
                }
            ).data.overlay;
            // Значення з коду гри мають перевагу над порталом.
            const map: Record<string, keyof GameConOptions> = {
                accent: 'accent',
                logo_url: 'logo',
                title: 'title',
                side: 'side',
                offset: 'offset',
                theme: 'theme',
                radius: 'radius',
                opacity: 'density',
                toasts: 'toasts',
                tabs: 'tabs',
                gamepad: 'gamepad',
                swipe: 'swipe',
                hide_when_busy: 'hideWhenBusy',
            };
            for (const [from, to] of Object.entries(map)) {
                if (
                    c[from] !== undefined &&
                    c[from] !== null &&
                    !(to in this.given)
                )
                    (this.o as Record<string, unknown>)[to] = c[from];
            }
            if (c.hotkey && !this.given.hotkeys)
                this.o.hotkeys.toggle = String(c.hotkey);
            if (c.chat_hotkey && !this.given.hotkeys)
                this.o.hotkeys.chat = String(c.chat_hotkey);
            if (Array.isArray(c.modules) && !this.given.modules)
                this.o.modules = c.modules as ModuleKey[];
            if (c.positions && !this.given.position)
                Object.assign(this.o.position, c.positions);
            if (c.contexts && !this.given.contexts)
                this.o.contexts = c.contexts as GameConOptions['contexts'];
            if (Array.isArray(c.custom_items) && !this.given.customItems)
                this.o.customItems =
                    c.custom_items as GameConOptions['customItems'];
            if (
                typeof c.onboarding === 'boolean' &&
                !('onboarding' in this.given)
            )
                this.o.onboarding = c.onboarding;
            if (
                typeof c.hotkey_hint === 'boolean' &&
                !('hotkeyHint' in this.given)
            )
                this.o.hotkeyHint = c.hotkey_hint;
            if (typeof c.layout === 'string' && !this.given.layout)
                this.o.layout = c.layout as Layout;
            if (Array.isArray(c.windows) && !this.given.windows)
                this.o.windows = c.windows as Section[];
            if (Array.isArray(c.player_can))
                this.playerCan = c.player_can as string[];
            if (c.platforms && typeof c.platforms === 'object')
                this.platforms = c.platforms as Record<string, boolean>;
            if (c.enabled === false && !this.given.modules)
                this.o.modules = this.o.modules.filter((m) => m !== 'drop');
        } catch {
            /* без мережі — типовий вигляд */
        }
    }
    private given: Partial<GameConOptions> = {};
    /** Оверлей вимкнено: гравцем, розробником для цієї платформи або в привітанні. */
    private disabled = false;
    private context: 'menu' | 'lobby' | 'match' | null = null;
    private playerCan: string[] = [
        'move',
        'modules',
        'hotkeys',
        'density',
        'disable',
    ];
    private prefs: Record<string, unknown> = {};
    private platforms: Record<string, boolean> = {};
    private welcome = false;
    private saveTimer = 0;

    // ── Дані ──
    private friends: Friend[] = [];
    private party: Member[] = [];
    private family: (typeof DEMO)['family'] | null = null;
    private convs: Conversation[] = [];
    private msgs: Message[] = [];
    private track: { title: string; artist: string; playing: boolean } | null =
        null;

    private poll() {
        const load = async () => {
            if (this.o.demo) {
                this.friends = DEMO.friends;
                this.party = DEMO.party;
                this.family = DEMO.family;
                this.convs = DEMO.conversations;
                this.conv ??= this.convs[0]?.id ?? null;
                this.msgs = this.conv ? (DEMO.messages[this.conv] ?? []) : [];
                this.track = DEMO.track;
            } else {
                await Promise.allSettled([
                    this.api<{ data: Friend[] }>('friends/online').then((r) => {
                        this.friends = r.data;
                        // Паті — друзі в тому ж лобі, що й гравець (presence.lobby).
                        const lobby = r.data.find((f) => f.presence?.lobby)
                            ?.presence?.lobby;
                        this.party = r.data
                            .filter((f) => lobby && f.presence?.lobby === lobby)
                            .map((f) => ({
                                name: f.name,
                                avatar: f.avatar_url,
                                online: f.online,
                                mic: 'on',
                            }));
                    }),
                    this.api<{ data: { kind: string; id: number }[] }>(
                        'groups',
                    ).then(async (r) => {
                        const fam = r.data.find((g) => g.kind === 'family');
                        if (!fam) return;
                        const m = await this.api<{
                            data: {
                                nickname: string;
                                rank_title: string;
                                user: {
                                    avatar_url: string | null;
                                    online: boolean;
                                } | null;
                            }[];
                            family: (typeof DEMO)['family'];
                        }>(`groups/families/${fam.id}/members`);
                        this.family = {
                            ...m.family,
                            members: m.data.map((x) => ({
                                name: x.nickname,
                                avatar: x.user?.avatar_url ?? null,
                                online: !!x.user?.online,
                                rank: x.rank_title,
                            })),
                        };
                    }),
                    this.api<{ data: Conversation[] }>(
                        'chat/conversations',
                    ).then((r) => {
                        this.convs = r.data.slice(0, 12);
                        this.conv ??= this.convs[0]?.id ?? null;
                    }),
                    this.api<{
                        data: {
                            title?: string;
                            artist?: string;
                            playing?: boolean;
                        } | null;
                    }>('music/now').then((r) => {
                        this.track = r.data?.title
                            ? {
                                  title: r.data.title,
                                  artist: r.data.artist ?? '',
                                  playing: !!r.data.playing,
                              }
                            : null;
                    }),
                ]);
                if (this.conv && this.chatOpen) await this.loadMessages();
            }
            this.render();
        };
        void load();
        if (!this.o.demo) this.timers.push(window.setInterval(load, 20000));
    }
    private async loadMessages() {
        if (!this.conv || this.o.demo) return;
        try {
            const r = await this.api<{
                data: {
                    id: number;
                    body: string;
                    mine?: boolean;
                    is_mine?: boolean;
                    user?: { name: string };
                }[];
            }>(`chat/conversations/${this.conv}/messages`);
            this.msgs = r.data.map((m) => ({
                id: m.id,
                body: m.body,
                mine: !!(m.mine ?? m.is_mine),
                author: m.user?.name,
            }));
        } catch {
            this.msgs = [];
        }
    }
    private async send(text: string) {
        if (!text.trim() || !this.conv) return;
        this.msgs = [...this.msgs, { id: Date.now(), body: text, mine: true }];
        this.render();
        if (!this.o.demo) {
            await this.api(`chat/conversations/${this.conv}/messages`, {
                method: 'POST',
                body: JSON.stringify({ body: text }),
            }).catch(() => undefined);
        }
    }

    // ── Розмітка ──
    private mount() {
        if (!document.getElementById('gc-sdk-style')) {
            const style = document.createElement('style');
            style.id = 'gc-sdk-style';
            style.textContent = css;
            document.head.appendChild(style);
        }
        this.vp = document.createElement('div');
        this.vp.className =
            'gc-sdk-viewport' + (this.o.root ? ' gc-sdk-contained' : '');
        this.vp.dataset.mode = 'hud';
        this.vp.setAttribute('aria-label', 'GameCon');
        (this.o.root ?? document.body).appendChild(this.vp);
        // Рушій без GPU-розмиття (старі CEF) — щільніша підкладка.
        // У фреймі/CEF поверх гри розмивати нічого — сторінка не бачить кадр рушія; тоді теж щільне скло.
        const framed = !this.o.root && window.top !== window.self;
        const noBlur =
            this.o.blur === false ||
            (this.o.blur === 'auto' &&
                (framed ||
                    !(
                        CSS.supports?.('backdrop-filter', 'blur(1px)') ||
                        CSS.supports?.('-webkit-backdrop-filter', 'blur(1px)')
                    )));
        this.vp.classList.toggle('gc-sdk-no-blur', noBlur);
        this.applyVars();
        this.vp.addEventListener('click', (e) => this.onClick(e));
        this.vp.addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            if (input.dataset.pref)
                this.savePrefs({ [input.dataset.pref]: Number(input.value) });
        });
        this.vp.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).querySelector('input');
            if (input) {
                void this.send(input.value);
                input.value = '';
            }
        });
    }
    private applyVars() {
        const s = this.vp.style;
        s.setProperty('--gc-accent', this.o.accent);
        s.setProperty('--gc-radius', `${this.o.radius}px`);
        s.setProperty(
            '--gc-scale',
            String(Math.min(130, Math.max(80, this.o.scale ?? 100)) / 100),
        );
        const a = Math.min(100, Math.max(60, this.o.density)) / 100;
        s.setProperty('--gc-glass-active', `rgba(16, 18, 24, ${a})`);
        s.setProperty(
            '--gc-glass',
            `rgba(16, 18, 24, ${Math.max(0.6, a - 0.06)})`,
        );
        const dark =
            this.o.theme === 'dark' ||
            (this.o.theme === 'auto' &&
                !matchMedia('(prefers-color-scheme: light)').matches);
        this.vp.dataset.theme = dark ? 'dark' : 'light';
    }

    private corner(c: Corner, gap = 12) {
        const [v, h] = c.split('-');
        return `${v}:${gap}px;${h}:${gap}px;`;
    }

    // ── Розмітка: вкладки в одному вікні або окремі вікна ──

    /** Розділи, доступні в цій грі. */
    private sections(): Section[] {
        const list: Section[] = [...this.o.tabs];
        if (!list.includes('party')) list.splice(1, 0, 'party');
        if (this.o.customItems?.length) list.push('game');
        return list;
    }

    /** Які розділи — окремими вікнами (решта — вкладками єдиного вікна). */
    private windows(): Section[] {
        const layout =
            (this.prefs.layout as Layout | undefined) ??
            this.o.layout ??
            'custom';
        const all = this.sections();
        let list: Section[];
        if (layout === 'unified') list = [];
        else if (layout === 'separate') list = all;
        else {
            const legacy: Section[] = [];
            if (this.o.modules.includes('party')) legacy.push('party');
            if (this.o.modules.includes('family')) legacy.push('groups');
            if (this.o.modules.includes('chat')) legacy.push('chat');
            list = (
                (this.prefs.windows as Section[] | undefined) ??
                this.o.windows ??
                legacy
            ).filter((s) => all.includes(s));
        }
        // Профіль контексту (меню/лобі/матч) ховає зайві окремі вікна.
        const ctx = this.context ? this.o.contexts?.[this.context] : undefined;
        if (ctx)
            list = list.filter(
                (s) =>
                    ctx.includes(s as ModuleKey) ||
                    ctx.includes(SECTION_MODULE[s] as ModuleKey),
            );
        return this.disabled ? [] : list;
    }

    private render() {
        if (!this.vp) return;
        const m = this.modules();
        const wins = this.user || this.o.demo ? this.windows() : [];
        this.vp.classList.toggle('gc-sdk-streamer', !!this.o.streamer);
        this.vp.dataset.panel = this.open && m.has('drop') ? '1' : '0';
        this.vp.dataset.hudCorner = m.has('hud') ? this.o.position.hud : '';
        const keep =
            this.vp.querySelector<HTMLInputElement>('.gc-sdk-input input')
                ?.value ?? '';
        const parts: string[] = [];
        // Кути екрана — стопки: капсула першою, далі окремі вікна; нічого не перекривається.
        const stacks: Record<Corner, string[]> = {
            'top-left': [],
            'top-right': [],
            'bottom-left': [],
            'bottom-right': [],
        };
        if (m.has('hud'))
            stacks[this.o.position.hud ?? 'top-right'].push(this.hud());
        for (const s of wins) {
            if (s === 'chat') continue;
            stacks[this.cornerOf(s)].push(this.windowCard(s));
        }
        for (const [corner, items] of Object.entries(stacks)) {
            if (items.length)
                parts.push(
                    `<div class="gc-sdk-stack" data-corner="${corner}" style="${this.corner(corner as Corner)}">${items.join('')}</div>`,
                );
        }
        if (m.has('drop')) parts.push(this.drop());
        if (wins.includes('chat') || m.has('chat')) parts.push(this.drawer());
        if (this.welcome) parts.push(this.welcomeCard());
        const tp = this.o.toasts === 'off' ? 'top-right' : this.o.toasts;
        const toastPos =
            tp === 'top'
                ? 'top:12px;left:50%;transform:translateX(-50%);'
                : this.corner(tp as Corner, 12);
        const oldToasts = this.vp.querySelector('.gc-sdk-toasts');
        this.vp.innerHTML = parts.join('');
        const toasts = oldToasts ?? document.createElement('div');
        toasts.className = 'gc-sdk-toasts';
        toasts.setAttribute(
            'style',
            toastPos +
                (m.has('hud') && tp === this.o.position.hud
                    ? 'margin-top:52px;'
                    : '') +
                (this.chatOpen && tp.endsWith('right') ? 'right:364px;' : ''),
        );
        this.vp.appendChild(toasts);
        const input = this.vp.querySelector<HTMLInputElement>(
            '.gc-sdk-input input',
        );
        if (input && keep) input.value = keep;
        if (this.o.draggable || this.playerCan.includes('move'))
            this.enableDrag();
        this.vp
            .querySelectorAll('.gc-sdk-messages')
            .forEach((l) => (l.scrollTop = l.scrollHeight));
    }

    private cornerOf(s: Section): Corner {
        const p = this.o.position as Record<string, Corner | undefined>;
        return (
            p[s] ??
            p[SECTION_MODULE[s] ?? ''] ??
            DEFAULT_CORNER[s] ??
            'top-left'
        );
    }

    private avatar(name: string, url: string | null, online?: boolean) {
        return `<span class="gc-sdk-avatar" data-online="${online ? 1 : 0}" ${url ? `style="background-image:url('${esc(url)}')"` : ''}>${url ? '' : esc(initials(name))}</span>`;
    }
    private logo() {
        return this.o.logo
            ? `<span class="gc-sdk-logo" style="background-image:url('${esc(this.o.logo)}')"></span>`
            : '<span class="gc-sdk-logo">G</span>';
    }

    private hud() {
        const online = this.friends.filter((f) => f.online).length;
        const voice = this.party.length
            ? `<span class="gc-sdk-row gc-sdk-live">${icon('mic')}<span>${this.party.length}</span></span><span class="gc-sdk-sep"></span>`
            : '';
        const who = this.user
            ? `<span class="gc-sdk-row">${icon('users')}<span>${tr('{n} онлайн', { n: online })}</span></span><span class="gc-sdk-sep"></span>${voice}`
            : `<span class="gc-sdk-row">${icon('login')}<span>${tr('Увійти')}</span></span><span class="gc-sdk-sep"></span>`;
        return `<button type="button" data-act="toggle" class="gc-sdk-pill gc-sdk-frosted-glass gc-sdk-interactive" data-w="hud" aria-label="GameCon">${this.logo()}${who}<span class="gc-sdk-kbd">${esc(this.o.hotkeys.toggle)}</span></button>`;
    }

    /** Окреме вікно розділу: той самий вміст, що й вкладка, у власній скляній картці. */
    private windowCard(s: Section) {
        const title =
            s === 'groups' && this.family
                ? `${esc(this.family.name)} <span class="gc-sdk-sub">[${esc(this.family.tag)}]</span>`
                : esc(tr(SECTION_LABELS[s]));
        const meta =
            s === 'party'
                ? tr('{n} у голосі', { n: this.party.length })
                : s === 'groups' && this.family
                  ? tr('{n} онлайн', { n: this.family.online })
                  : s === 'friends'
                    ? tr('{n} онлайн', {
                          n: this.friends.filter((f) => f.online).length,
                      })
                    : '';
        return `<section class="gc-sdk-card gc-sdk-frosted-glass gc-sdk-interactive" data-w="${s}" aria-label="${esc(tr(SECTION_LABELS[s]))}">
<div class="gc-sdk-card-head">${icon(s === 'groups' ? 'crown' : SECTION_ICONS[s])}<span class="gc-sdk-grow gc-sdk-title">${title}</span><span class="gc-sdk-sub">${meta}</span><button type="button" class="gc-sdk-icon-btn" data-act="dock" data-s="${s}" title="${tr('У спільне вікно')}" aria-label="${tr('У спільне вікно')}">${icon('dock')}</button></div>
<div class="gc-sdk-list">${this.sectionBody(s)}</div></section>`;
    }

    private drop() {
        const side = this.o.side;
        const pos =
            side === 'top'
                ? `left:${this.o.offset}%;`
                : `top:${this.o.offset}%;`;
        const arrow =
            side === 'top'
                ? this.open
                    ? 'up'
                    : 'down'
                : (side === 'left') !== this.open
                  ? 'right'
                  : 'left';
        return `<button type="button" data-act="toggle" class="gc-sdk-drop gc-sdk-frosted-glass gc-sdk-interactive" data-side="${side}" style="${pos}" aria-expanded="${this.open}" aria-label="${tr('Відкрити GameCon')}">${icon(arrow)}</button>
<section class="gc-sdk-panel gc-sdk-frosted-glass" data-side="${side}" data-open="${this.open ? 1 : 0}" style="${pos}" role="dialog" aria-label="GameCon">${this.panelBody()}</section>`;
    }

    private panelBody() {
        const head = `<div class="gc-sdk-row">${this.logo()}<span class="gc-sdk-grow gc-sdk-title">${esc(this.o.title || 'GameCon')}</span><button type="button" class="gc-sdk-icon-btn" data-act="close" aria-label="${tr('Закрити')}">${icon('x')}</button></div>`;
        if (!this.user) return head + this.loginBody();
        const wins = this.windows();
        const tabs: Section[] = [
            ...this.sections().filter((s) => !wins.includes(s)),
            'settings',
        ];
        if (!tabs.includes(this.tab)) this.tab = tabs[0];
        const buttons = tabs
            .map(
                (t) =>
                    `<button type="button" class="gc-sdk-tab" role="tab" data-tab="${t}" aria-selected="${this.tab === t}" title="${esc(tr(SECTION_LABELS[t]))}" aria-label="${esc(tr(SECTION_LABELS[t]))}">${icon(SECTION_ICONS[t])}</button>`,
            )
            .join('');
        // Усе винесено окремими вікнами — у панелі лишається тільки шестерня, без смуги вкладок.
        const bar =
            tabs.length > 1
                ? `<div class="gc-sdk-tabs" role="tablist">${buttons}</div>`
                : '';
        return `${head}${bar}<div class="gc-sdk-body">${this.sectionBody(this.tab)}</div>`;
    }

    private loginBody() {
        if (this.device) {
            return `<div class="gc-sdk-body" style="align-items:center;text-align:center;gap:10px">
<img alt="" width="132" height="132" style="border-radius:14px;background:#fff;padding:6px" class="gc-sdk-secret" src="${esc(this.o.base)}/link/qr.svg?code=${encodeURIComponent(this.device.user_code)}">
<div class="gc-sdk-sub">${tr('Скануйте QR у застосунку GameCon або відкрийте gamecon.online/link і введіть код')}</div>
<div class="gc-sdk-secret" style="font:600 22px ui-monospace,monospace;letter-spacing:.2em">${esc(this.device.user_code)}</div></div>`;
        }
        return `<div class="gc-sdk-body" style="gap:10px"><div class="gc-sdk-sub">${tr('Увійдіть через GameCon, щоб бачити друзів, чат, голос і свою сім’ю просто в грі.')}</div>
<button type="button" class="gc-sdk-btn" data-act="login">${icon('login')}${tr('Увійти через GameCon')}</button>
<div class="gc-sdk-sub">${tr('Немає акаунта? Його можна створити за хвилину під час входу.')}</div></div>`;
    }

    private memberRow(p: Member) {
        return `<div class="gc-sdk-slot">${this.avatar(p.name, p.avatar, p.online)}<span class="gc-sdk-grow"><span class="gc-sdk-title gc-sdk-name" style="display:block">${esc(p.name)}</span>${p.rank ? `<span class="gc-sdk-sub">${esc(p.rank)}</span>` : ''}</span>${p.mic ? `<span class="${p.mic === 'speaking' ? 'gc-sdk-live' : 'gc-sdk-mute'}">${icon(p.mic === 'off' ? 'micOff' : 'mic')}</span>` : ''}</div>`;
    }

    /** Вміст розділу — однаковий у вкладці й в окремому вікні. */
    private sectionBody(s: Section): string {
        const money = (n: number) => '$' + n.toLocaleString(this.o.locale);
        switch (s) {
            case 'friends':
                return (
                    this.friends
                        .map(
                            (f) =>
                                `<div class="gc-sdk-slot">${this.avatar(f.name, f.avatar_url, f.online)}<span class="gc-sdk-grow"><span class="gc-sdk-title gc-sdk-name" style="display:block">${esc(f.name)}</span><span class="gc-sdk-sub">${esc(f.presence?.status ?? (f.online ? tr('Онлайн') : tr('Не в мережі')))}</span></span>${f.online ? `<button type="button" class="gc-sdk-btn gc-sdk-btn-sm" data-act="invite" data-user="${esc(f.username)}">${tr('Покликати')}</button>` : ''}</div>`,
                        )
                        .join('') ||
                    `<div class="gc-sdk-sub">${tr('Друзів поки немає')}</div>`
                );
            case 'party':
                return `${this.party.map((p) => this.memberRow(p)).join('') || `<div class="gc-sdk-sub">${tr('Покличте друзів із вкладки «Друзі»')}</div>`}
<button type="button" class="gc-sdk-btn" data-act="ready" aria-pressed="${this.ready ? 'true' : 'false'}">${icon('gamepad')}${tr('Готовий грати')}</button>`;
            case 'chat':
                return this.chatBody(true);
            case 'voice':
                return this.party.length
                    ? this.party.map((p) => this.memberRow(p)).join('')
                    : `<div class="gc-sdk-sub">${tr('Голосовий канал порожній')}</div>`;
            case 'groups': {
                const f = this.family;
                if (!f)
                    return `<div class="gc-sdk-sub">${tr('Ви ще не в сім’ї чи клані')}</div>`;
                return `<div class="gc-sdk-stats"><div class="gc-sdk-slot gc-sdk-stat"><span class="gc-sdk-sub">${tr('Казна штабу')}</span><b>${money(f.treasury)}</b></div><div class="gc-sdk-slot gc-sdk-stat"><span class="gc-sdk-sub">${tr('Мій баланс')}</span><b>${money(f.my_balance)}</b></div></div>${f.members
                    .slice(0, 8)
                    .map((p) => this.memberRow({ ...p, mic: undefined }))
                    .join('')}`;
            }
            case 'music':
                return this.track
                    ? `<div class="gc-sdk-slot">${icon('music')}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${esc(this.track.title)}</span><span class="gc-sdk-sub">${esc(this.track.artist)}</span></span><button type="button" class="gc-sdk-icon-btn" data-act="music" data-cmd="${this.track.playing ? 'pause' : 'play'}" aria-label="${this.track.playing ? tr('Пауза') : tr('Грати')}">${icon(this.track.playing ? 'pause' : 'play')}</button><button type="button" class="gc-sdk-icon-btn" data-act="music" data-cmd="next" aria-label="${tr('Далі')}">${icon('next')}</button></div>`
                    : `<div class="gc-sdk-sub">${tr('Зараз нічого не грає')}</div>`;
            case 'achievements':
                return `<div class="gc-sdk-slot">${icon('trophy')}<span class="gc-sdk-grow">${tr('Досягнення гри з’являться тут')}</span></div>`;
            case 'game':
                return (this.o.customItems ?? [])
                    .map(
                        (it, i) =>
                            `<button type="button" class="gc-sdk-slot" data-act="item" data-i="${i}">${icon(it.url ? 'external' : 'gamepad')}<span class="gc-sdk-grow gc-sdk-title">${esc(it.label)}</span></button>`,
                    )
                    .join('');
            case 'settings':
                return this.settingsBody();
        }
        return '';
    }

    private chatBody(inline: boolean) {
        const chips = this.convs
            .map(
                (c) =>
                    `<button type="button" class="gc-sdk-chip" role="tab" data-act="conv" data-id="${c.id}" aria-selected="${c.id === this.conv}">${esc(c.title)}${c.unread ? ' <span class="gc-sdk-dot" style="display:inline-block"></span>' : ''}</button>`,
            )
            .join('');
        const msgs = this.msgs
            .map(
                (m) =>
                    `<div class="gc-sdk-bubble" data-mine="${m.mine ? 1 : 0}">${m.author && !m.mine ? `<div class="gc-sdk-sub gc-sdk-name">${esc(m.author)}</div>` : ''}${esc(m.body)}</div>`,
            )
            .join('');
        return `<div class="gc-sdk-convs" role="tablist">${chips}</div><div class="gc-sdk-messages"${inline ? ' style="max-height:220px"' : ''}>${msgs || `<div class="gc-sdk-sub">${this.user ? tr('Повідомлень поки немає') : tr('Увійдіть, щоб писати друзям')}</div>`}</div>
<form class="gc-sdk-input"><input placeholder="${tr('Повідомлення…')}" aria-label="${tr('Повідомлення…')}" ${this.user ? '' : 'disabled'}><button type="submit" class="gc-sdk-btn" aria-label="${tr('Надіслати')}" ${this.user ? '' : 'disabled'}>${icon('send')}</button></form>`;
    }

    private drawer() {
        return `<aside class="gc-sdk-drawer gc-sdk-frosted-glass ${this.chatOpen ? 'gc-sdk-interactive' : ''}" data-open="${this.chatOpen ? 1 : 0}" aria-hidden="${!this.chatOpen}">
<div class="gc-sdk-row">${icon('chat')}<span class="gc-sdk-grow gc-sdk-title">${tr('Чат GameCon')}</span><span class="gc-sdk-kbd">${esc(this.o.hotkeys.chat)}</span><button type="button" class="gc-sdk-icon-btn" data-act="chat-close" aria-label="${tr('Закрити')}">${icon('x')}</button></div>
${this.chatBody(false)}</aside>`;
    }

    /** Шестерня: вигляд, пресети, щільність, масштаб, хоткей, режим стрімера, вимкнення. */
    private settingsBody() {
        const can = (k: string) => this.playerCan.includes(k);
        const layout =
            (this.prefs.layout as Layout | undefined) ??
            this.o.layout ??
            'custom';
        const seg = (act: string, cur: string, opts: [string, string][]) =>
            `<div class="gc-sdk-seg">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('')}</div>`;
        const toggle = (act: string, on: boolean, label: string, extra = '') =>
            `<button type="button" class="gc-sdk-slot" data-act="${act}" ${extra} aria-pressed="${on}"><span class="gc-sdk-grow">${esc(label)}</span><span class="gc-sdk-switch" data-on="${on ? 1 : 0}"></span></button>`;
        const out: string[] = [];
        if (can('modules')) {
            out.push(
                `<div class="gc-sdk-sub">${tr('Вигляд')}</div>`,
                seg('layout', layout, [
                    ['unified', tr('Одним вікном')],
                    ['separate', tr('Окремими вікнами')],
                    ['custom', tr('На вибір')],
                ]),
            );
            if (layout === 'custom') {
                const wins = this.windows();
                this.sections().forEach((s) =>
                    out.push(
                        toggle(
                            'win',
                            wins.includes(s),
                            tr('{name} — окремим вікном', {
                                name: tr(SECTION_LABELS[s]),
                            }),
                            `data-s="${s}"`,
                        ),
                    ),
                );
            }
            const preset =
                (this.prefs.preset as string | undefined) ?? 'custom';
            out.push(
                `<div class="gc-sdk-sub">${tr('Набір віджетів')}</div>`,
                seg('preset', preset, [
                    ['minimal', tr('Мінімал')],
                    ['standard', tr('Стандарт')],
                    ['full', tr('Повний')],
                    ['custom', tr('Свій')],
                ]),
            );
        }
        if (can('density')) {
            out.push(
                `<label class="gc-sdk-slot gc-sdk-range"><span class="gc-sdk-grow">${tr('Щільність скла')}</span><input type="range" min="60" max="100" value="${this.o.density}" data-pref="density" aria-label="${tr('Щільність скла')}"></label>`,
                `<label class="gc-sdk-slot gc-sdk-range"><span class="gc-sdk-grow">${tr('Розмір')}</span><input type="range" min="80" max="130" step="5" value="${this.o.scale ?? 100}" data-pref="scale" aria-label="${tr('Розмір')}"></label>`,
            );
        }
        if (can('hotkeys')) {
            out.push(
                `<button type="button" class="gc-sdk-slot" data-act="rebind" data-k="hotkey"><span class="gc-sdk-grow">${tr('Відкрити GameCon')}</span><span class="gc-sdk-kbd">${this.rebinding === 'hotkey' ? tr('Натисніть клавіші…') : esc(this.o.hotkeys.toggle)}</span></button>`,
                `<button type="button" class="gc-sdk-slot" data-act="rebind" data-k="chat_hotkey"><span class="gc-sdk-grow">${tr('Чат')}</span><span class="gc-sdk-kbd">${this.rebinding === 'chat_hotkey' ? tr('Натисніть клавіші…') : esc(this.o.hotkeys.chat)}</span></button>`,
                toggle(
                    'gamepad',
                    this.o.gamepad,
                    tr('Кнопка «Додому» на геймпаді'),
                ),
            );
        }
        out.push(
            toggle(
                'streamer',
                !!this.o.streamer,
                tr('Режим стрімера: ховати ніки й повідомлення'),
            ),
        );
        out.push(
            `<button type="button" class="gc-sdk-slot" data-act="reset"><span class="gc-sdk-grow">${tr('Скинути до варіанта гри')}</span></button>`,
        );
        if (can('disable'))
            out.push(
                `<button type="button" class="gc-sdk-slot" data-act="disable"><span class="gc-sdk-grow">${tr('Вимкнути GameCon у цій грі')}</span></button>`,
            );
        return out.join('');
    }

    private welcomeCard() {
        return `<section class="gc-sdk-welcome gc-sdk-frosted-glass gc-sdk-interactive" role="dialog" aria-label="GameCon">
<div class="gc-sdk-row">${this.logo()}<div class="gc-sdk-grow"><div class="gc-sdk-title">${tr('«{game}» підтримує GameCon', { game: this.o.title || document.title || tr('Гра') })}</div><div class="gc-sdk-sub">${tr('Друзі, чат, голос і сім’я — просто в грі, без Alt+Tab.')}</div></div></div>
<div class="gc-sdk-row" style="justify-content:flex-end;gap:6px"><button type="button" class="gc-sdk-btn gc-sdk-btn-ghost" data-act="welcome-off">${tr('Вимкнути')}</button><button type="button" class="gc-sdk-btn gc-sdk-btn-ghost" data-act="welcome-later">${tr('Не зараз')}</button><button type="button" class="gc-sdk-btn" data-act="welcome-login">${icon('login')}${tr('Увійти')}</button></div></section>`;
    }

    private rebinding: string | null = null;
    private ready = false;

    private onClick(e: MouseEvent) {
        const el = (e.target as HTMLElement).closest<HTMLElement>(
            '[data-act],[data-tab]',
        );
        if (!el || this.dragged) return;
        if (el.dataset.tab) {
            this.tab = el.dataset.tab as Section;
            this.render();
            return;
        }
        const wins = () => this.windows();
        switch (el.dataset.act) {
            case 'toggle':
                if (
                    !this.user &&
                    !this.o.demo &&
                    el.classList.contains('gc-sdk-pill')
                )
                    return void this.login();
                return this.toggle();
            case 'close':
                return this.toggle(false);
            case 'chat-close':
                return this.openChat(false);
            case 'login':
                return void this.login();
            case 'ready':
                this.ready = !this.ready;
                void this.setPresence(this.ready ? tr('Готовий грати') : null);
                this.render();
                if (this.ready)
                    this.toast(
                        tr('Друзі бачать, що ви готові грати'),
                        undefined,
                        'gamepad',
                    );
                return;
            case 'invite':
                return void this.invite(el.dataset.user ?? '', 'lobby');
            case 'conv':
                this.conv = Number(el.dataset.id);
                if (this.o.demo) this.msgs = DEMO.messages[this.conv] ?? [];
                // Чат окремим вікном — відкриваємо шторку; у спільному вікні — лишаємось у вкладці.
                if (wins().includes('chat') || !this.open) this.openChat(true);
                else this.render();
                void this.loadMessages().then(() => this.render());
                return;
            case 'music': {
                const cmd = el.dataset.cmd ?? 'play';
                if (this.track && cmd !== 'next')
                    this.track = { ...this.track, playing: cmd === 'play' };
                this.render();
                if (!this.o.demo)
                    void this.api('music/command', {
                        method: 'POST',
                        body: JSON.stringify({ command: cmd }),
                    }).catch(() => undefined);
                return;
            }
            case 'item': {
                const it = this.o.customItems?.[Number(el.dataset.i)];
                if (it?.url) window.open(it.url, '_blank', 'noopener');
                if (it?.command) this.emit('command', { command: it.command });
                return;
            }
            case 'dock': {
                // Окреме вікно → назад у спільне вікно (вкладкою).
                const s = el.dataset.s as Section;
                this.savePrefs({
                    layout: 'custom',
                    windows: wins().filter((w) => w !== s),
                });
                return;
            }
            case 'layout':
                return this.savePrefs({ layout: el.dataset.v });
            case 'win': {
                const s = el.dataset.s as Section;
                const cur = wins();
                return this.savePrefs({
                    layout: 'custom',
                    windows: cur.includes(s)
                        ? cur.filter((w) => w !== s)
                        : [...cur, s],
                });
            }
            case 'preset':
                return this.savePrefs({ preset: el.dataset.v });
            case 'gamepad':
                return this.savePrefs({ gamepad: !this.o.gamepad });
            case 'streamer':
                return this.savePrefs({ streamer: !this.o.streamer });
            case 'rebind':
                this.rebinding = el.dataset.k ?? null;
                this.render();
                return;
            case 'reset':
                return void this.resetPrefs();
            case 'disable':
                return this.disable();
            case 'welcome-login':
                this.welcome = false;
                this.store('welcomed', '1');
                return void this.login();
            case 'welcome-later':
                this.welcome = false;
                this.store('welcomed', '1');
                return this.render();
            case 'welcome-off':
                this.welcome = false;
                this.store('welcomed', '1');
                return this.disable();
        }
    }

    // ── Керування: клавіші, геймпад, свайп ──
    private bindKeys() {
        const match = (combo: string, e: KeyboardEvent) => {
            const parts = combo.split('+').map((p) => p.trim().toLowerCase());
            const key = parts.pop();
            return (
                parts.includes('shift') === e.shiftKey &&
                parts.includes('alt') === e.altKey &&
                parts.includes('ctrl') === e.ctrlKey &&
                parts.includes('meta') === e.metaKey &&
                (e.key.toLowerCase() === key ||
                    e.code.toLowerCase() === `key${key}` ||
                    e.code.toLowerCase() === key)
            );
        };
        const onKey = (e: KeyboardEvent) => {
            // Переназначення хоткея з шестерні: наступне сполучення клавіш.
            if (this.rebinding) {
                if (['Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
                e.preventDefault();
                const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                const combo = [
                    e.ctrlKey && 'Ctrl',
                    e.shiftKey && 'Shift',
                    e.altKey && 'Alt',
                    e.metaKey && 'Meta',
                    key,
                ]
                    .filter(Boolean)
                    .join('+');
                const k = this.rebinding;
                this.rebinding = null;
                if (e.key !== 'Escape') this.savePrefs({ [k]: combo });
                else this.render();
                return;
            }
            if (match(this.o.hotkeys.toggle, e)) {
                e.preventDefault();
                this.toggle();
            } else if (match(this.o.hotkeys.chat, e)) {
                e.preventDefault();
                this.openChat();
            } else if (e.key === 'Escape' && (this.open || this.chatOpen)) {
                this.open = this.chatOpen = false;
                this.vp.dataset.mode = 'hud';
                this.render();
            }
        };
        window.addEventListener('keydown', onKey, true);
        this.cleanup.push(() =>
            window.removeEventListener('keydown', onKey, true),
        );

        // Кнопка «Додому» (16) на стандартному геймпаді.
        if (this.o.gamepad && 'getGamepads' in navigator) {
            let was = false;
            const t = window.setInterval(() => {
                const pressed = Array.from(
                    navigator.getGamepads?.() ?? [],
                ).some((g) => g?.buttons?.[16]?.pressed);
                if (pressed && !was) this.toggle();
                was = pressed;
            }, 120);
            this.timers.push(t);
        }
        // Свайп від краю (телефони й планшети).
        if (this.o.swipe) {
            let sx = 0;
            let sy = 0;
            const start = (e: TouchEvent) => {
                sx = e.touches[0].clientX;
                sy = e.touches[0].clientY;
            };
            const end = (e: TouchEvent) => {
                const t = e.changedTouches[0];
                const w = window.innerWidth;
                const dx = t.clientX - sx;
                const dy = t.clientY - sy;
                const side = this.o.side;
                if (
                    (side === 'left' && sx < 24 && dx > 60) ||
                    (side === 'right' && sx > w - 24 && dx < -60) ||
                    (side === 'top' && sy < 24 && dy > 60)
                )
                    this.toggle(true);
            };
            window.addEventListener('touchstart', start, { passive: true });
            window.addEventListener('touchend', end, { passive: true });
            this.cleanup.push(() => {
                window.removeEventListener('touchstart', start);
                window.removeEventListener('touchend', end);
            });
        }
        // Міст для рушія гри (CEF / iframe): window.postMessage({ target: 'gamecon-sdk', cmd, args }).
        const onMsg = (e: MessageEvent) => {
            const d = e.data as {
                target?: string;
                cmd?: string;
                args?: unknown[];
            } | null;
            if (!d || d.target !== 'gamecon-sdk' || !d.cmd) return;
            const fn = (this as unknown as Record<string, unknown>)[d.cmd];
            if (
                typeof fn === 'function' &&
                [
                    'toggle',
                    'openChat',
                    'setBusy',
                    'setMode',
                    'toast',
                    'configure',
                    'login',
                    'logout',
                    'setPresence',
                ].includes(d.cmd)
            ) {
                (fn as (...a: unknown[]) => unknown).apply(this, d.args ?? []);
            }
        };
        window.addEventListener('message', onMsg);
        this.cleanup.push(() => window.removeEventListener('message', onMsg));
    }

    // ── Перетягування вікон між кутами ──
    private dragged = false;
    private enableDrag() {
        this.vp.querySelectorAll<HTMLElement>('[data-w]').forEach((w) => {
            const handle =
                w.querySelector<HTMLElement>('.gc-sdk-card-head') ?? w;
            handle.onpointerdown = (e) => {
                if (
                    (e.target as HTMLElement).closest(
                        '.gc-sdk-btn,.gc-sdk-icon-btn',
                    )
                )
                    return;
                const box = this.vp.getBoundingClientRect();
                const sx = e.clientX;
                const sy = e.clientY;
                let moved = false;
                w.classList.add('gc-sdk-dragging');
                const move = (ev: PointerEvent) => {
                    if (
                        !moved &&
                        Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6
                    )
                        return;
                    moved = true;
                    w.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
                    w.style.zIndex = '3';
                };
                const up = (ev: PointerEvent) => {
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', up);
                    w.classList.remove('gc-sdk-dragging');
                    if (!moved) return;
                    this.dragged = true;
                    setTimeout(() => (this.dragged = false), 0);
                    // Прилипає до найближчого кута — позиція переживає зміну розміру вікна.
                    const cx =
                        ev.clientX - box.left < box.width / 2
                            ? 'left'
                            : 'right';
                    const cy =
                        ev.clientY - box.top < box.height / 2
                            ? 'top'
                            : 'bottom';
                    const key = w.dataset.w ?? 'hud';
                    const corner = `${cy}-${cx}` as Corner;
                    this.o.position[key] = corner;
                    this.emit('move', { widget: key, corner });
                    this.savePrefs({
                        positions: {
                            ...((this.prefs.positions as Record<
                                string,
                                Corner
                            >) ?? {}),
                            [key]: corner,
                        },
                    });
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
            };
        });
    }

    setGiven(o: GameConOptions) {
        this.given = o;
    }
}

function b64url(bytes: Uint8Array): string {
    let s = '';
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const GameConSDK = {
    version: '1.0.0',
    instance: null as Sdk | null,
    async init(options: GameConOptions = {}): Promise<Sdk> {
        GameConSDK.instance?.destroy();
        const sdk = new Sdk(options);
        sdk.setGiven(options);
        GameConSDK.instance = sdk;
        return sdk.start();
    },
};

(window as unknown as { GameConSDK: typeof GameConSDK }).GameConSDK =
    GameConSDK;
export default GameConSDK;
