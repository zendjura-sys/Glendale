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
    | 'chat'
    | 'voice'
    | 'groups'
    | 'music'
    | 'achievements';

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

const TAB_ICONS: Record<TabKey, string> = {
    friends: 'users',
    chat: 'chat',
    voice: 'mic',
    groups: 'shield',
    music: 'music',
    achievements: 'trophy',
};
const TAB_LABELS: Record<TabKey, string> = {
    friends: 'Друзі',
    chat: 'Чат',
    voice: 'Голос',
    groups: 'Сім’я й клан',
    music: 'Музика',
    achievements: 'Досягнення',
};

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
    private o: Required<
        Omit<
            GameConOptions,
            | 'clientId'
            | 'token'
            | 'root'
            | 'logo'
            | 'title'
            | 'redirectUri'
            | 'onReady'
            | 'onLogin'
            | 'onEvent'
            | 'position'
            | 'hotkeys'
        >
    > &
        GameConOptions & {
            position: Record<'hud' | 'party' | 'family', Corner>;
            hotkeys: { toggle: string; chat: string };
        };
    private vp!: HTMLDivElement;
    private token: string | null = null;
    private refresh: string | null = null;
    user: User | null = null;
    private tab: TabKey = 'friends';
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
        this.mount();
        this.bindKeys();
        if (this.o.demo) {
            this.user = DEMO.user;
        } else {
            this.restore();
            await this.finishRedirect();
            if (this.token) await this.loadUser();
        }
        this.render();
        if (this.user) this.poll();
        this.o.onReady?.(this);
        this.emit('ready');
        return this;
    }

    destroy(): void {
        this.timers.forEach((t) => clearInterval(t));
        this.cleanup.forEach((f) => f());
        this.vp?.remove();
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
            if (c.enabled === false && !this.given.modules)
                this.o.modules = this.o.modules.filter((m) => m !== 'drop');
        } catch {
            /* без мережі — типовий вигляд */
        }
    }
    private given: Partial<GameConOptions> = {};

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

    private render() {
        if (!this.vp) return;
        const m = new Set(this.o.modules);
        this.vp.dataset.panel = this.open && m.has('drop') ? '1' : '0';
        this.vp.dataset.hudCorner = m.has('hud') ? this.o.position.hud : '';
        const keep =
            this.vp.querySelector<HTMLInputElement>('.gc-sdk-input input')
                ?.value ?? '';
        const parts: string[] = [];
        if (m.has('hud')) parts.push(this.hud());
        if (m.has('party') && this.user) parts.push(this.partyCard());
        if (m.has('family') && this.user && this.family)
            parts.push(this.familyCard());
        if (m.has('drop')) parts.push(this.drop());
        if (m.has('chat') || m.has('drop')) parts.push(this.drawer());
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
        if (this.o.draggable) this.enableDrag();
        const list = this.vp.querySelector('.gc-sdk-messages');
        if (list) list.scrollTop = list.scrollHeight;
    }

    private avatar(name: string, url: string | null, online?: boolean) {
        return `<span class="gc-sdk-avatar" data-online="${online ? 1 : 0}" ${url ? `style="background-image:url('${esc(url)}')"` : ''}>${url ? '' : esc(initials(name))}</span>`;
    }

    private hud() {
        const online = this.friends.filter((f) => f.online).length;
        const logo = this.o.logo
            ? `<span class="gc-sdk-logo" style="background-image:url('${esc(this.o.logo)}')"></span>`
            : '<span class="gc-sdk-logo">G</span>';
        const voice = this.party.length
            ? `<span class="gc-sdk-row gc-sdk-live">${icon('mic')}<span>${this.party.length}</span></span><span class="gc-sdk-sep"></span>`
            : '';
        const who = this.user
            ? `<span class="gc-sdk-row">${icon('users')}<span>${tr('{n} онлайн', { n: online })}</span></span><span class="gc-sdk-sep"></span>${voice}`
            : `<span class="gc-sdk-row">${icon('login')}<span>${tr('Увійти')}</span></span><span class="gc-sdk-sep"></span>`;
        return `<button type="button" data-act="toggle" class="gc-sdk-pill gc-sdk-frosted-glass gc-sdk-interactive" data-w="hud" style="${this.corner(this.o.position.hud)}" aria-label="GameCon">${logo}${who}<span class="gc-sdk-kbd">${esc(this.o.hotkeys.toggle)}</span></button>`;
    }

    private partyCard() {
        const rows = this.party
            .map(
                (p) =>
                    `<div class="gc-sdk-slot">${this.avatar(p.name, p.avatar, p.online)}<span class="gc-sdk-grow gc-sdk-title">${esc(p.name)}</span><span class="${p.mic === 'speaking' ? 'gc-sdk-live' : 'gc-sdk-mute'}">${icon(p.mic === 'off' ? 'micOff' : 'mic')}</span></div>`,
            )
            .join('');
        return `<section class="gc-sdk-card gc-sdk-frosted-glass gc-sdk-interactive" data-w="party" style="${this.corner(this.o.position.party)}">
<div class="gc-sdk-card-head">${icon('users')}<span class="gc-sdk-grow gc-sdk-title">${tr('Моє паті')}</span><span class="gc-sdk-sub">${tr('{n} у голосі', { n: this.party.length })}</span></div>
<div class="gc-sdk-list">${rows || `<div class="gc-sdk-sub">${tr('Покличте друзів із вкладки «Друзі»')}</div>`}</div>
<button type="button" class="gc-sdk-btn" data-act="ready" aria-pressed="${this.ready ? 'true' : 'false'}">${icon('gamepad')}${tr('Готовий грати')}</button></section>`;
    }
    private ready = false;

    private familyCard() {
        const f = this.family!;
        const money = (n: number) => '$' + n.toLocaleString(this.o.locale);
        const rows = f.members
            .slice(0, 6)
            .map(
                (p) =>
                    `<div class="gc-sdk-slot">${this.avatar(p.name, p.avatar, p.online)}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${esc(p.name)}</span><span class="gc-sdk-sub">${esc(p.rank ?? '')}</span></span></div>`,
            )
            .join('');
        return `<section class="gc-sdk-card gc-sdk-frosted-glass gc-sdk-interactive" data-w="family" style="${this.corner(this.o.position.family)}">
<div class="gc-sdk-card-head">${icon('crown')}<span class="gc-sdk-grow gc-sdk-title">${esc(f.name)} <span class="gc-sdk-sub">[${esc(f.tag)}]</span></span><span class="gc-sdk-sub">${tr('{n} онлайн', { n: f.online })}</span></div>
<div class="gc-sdk-stats"><div class="gc-sdk-slot gc-sdk-stat"><span class="gc-sdk-sub">${tr('Казна штабу')}</span><b>${money(f.treasury)}</b></div><div class="gc-sdk-slot gc-sdk-stat"><span class="gc-sdk-sub">${tr('Мій баланс')}</span><b>${money(f.my_balance)}</b></div></div>
<div class="gc-sdk-list">${rows}</div></section>`;
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
        const panelPos =
            side === 'top'
                ? `left:${this.o.offset}%;`
                : `top:${this.o.offset}%;`;
        return `<button type="button" data-act="toggle" class="gc-sdk-drop gc-sdk-frosted-glass gc-sdk-interactive" data-side="${side}" style="${pos}" aria-expanded="${this.open}" aria-label="${tr('Відкрити GameCon')}">${icon(arrow)}</button>
<section class="gc-sdk-panel gc-sdk-frosted-glass" data-side="${side}" data-open="${this.open ? 1 : 0}" style="${panelPos}" role="dialog" aria-label="GameCon">${this.panelBody()}</section>`;
    }

    private panelBody() {
        const head = `<div class="gc-sdk-row">${this.o.logo ? `<span class="gc-sdk-logo" style="background-image:url('${esc(this.o.logo)}')"></span>` : '<span class="gc-sdk-logo">G</span>'}<span class="gc-sdk-grow gc-sdk-title">${esc(this.o.title || 'GameCon')}</span><button type="button" class="gc-sdk-icon-btn" data-act="close" aria-label="${tr('Закрити')}">${icon('x')}</button></div>`;
        if (!this.user) return head + this.loginBody();
        const tabs = this.o.tabs
            .map(
                (t) =>
                    `<button type="button" class="gc-sdk-tab" role="tab" data-tab="${t}" aria-selected="${this.tab === t}" title="${esc(tr(TAB_LABELS[t]))}">${icon(TAB_ICONS[t])}</button>`,
            )
            .join('');
        return `${head}<div class="gc-sdk-tabs" role="tablist">${tabs}</div><div class="gc-sdk-body">${this.tabBody()}</div>`;
    }

    private loginBody() {
        if (this.device) {
            return `<div class="gc-sdk-body" style="align-items:center;text-align:center;gap:10px">
<img alt="" width="132" height="132" style="border-radius:14px;background:#fff;padding:6px" src="${esc(this.o.base)}/link/qr.svg?code=${encodeURIComponent(this.device.user_code)}">
<div class="gc-sdk-sub">${tr('Скануйте QR у застосунку GameCon або відкрийте gamecon.online/link і введіть код')}</div>
<div style="font:600 22px ui-monospace,monospace;letter-spacing:.2em">${esc(this.device.user_code)}</div></div>`;
        }
        return `<div class="gc-sdk-body" style="gap:10px"><div class="gc-sdk-sub">${tr('Увійдіть через GameCon, щоб бачити друзів, чат, голос і свою сім’ю просто в грі.')}</div>
<button type="button" class="gc-sdk-btn" data-act="login">${icon('login')}${tr('Увійти через GameCon')}</button>
<div class="gc-sdk-sub">${tr('Немає акаунта? Його можна створити за хвилину під час входу.')}</div></div>`;
    }

    private tabBody(): string {
        switch (this.tab) {
            case 'friends':
                return (
                    this.friends
                        .map(
                            (f) =>
                                `<div class="gc-sdk-slot">${this.avatar(f.name, f.avatar_url, f.online)}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${esc(f.name)}</span><span class="gc-sdk-sub">${esc(f.presence?.status ?? (f.online ? tr('Онлайн') : tr('Не в мережі')))}</span></span>${f.online ? `<button type="button" class="gc-sdk-btn" style="height:26px;padding:0 9px;font-size:11px" data-act="invite" data-user="${esc(f.username)}">${tr('Покликати')}</button>` : ''}</div>`,
                        )
                        .join('') ||
                    `<div class="gc-sdk-sub">${tr('Друзів поки немає')}</div>`
                );
            case 'chat':
                return this.convs
                    .map(
                        (c) =>
                            `<button type="button" class="gc-sdk-slot" data-act="conv" data-id="${c.id}">${icon('chat')}<span class="gc-sdk-grow gc-sdk-title">${esc(c.title)}</span>${c.unread ? '<span class="gc-sdk-dot"></span>' : ''}</button>`,
                    )
                    .join('');
            case 'voice':
                return this.party.length
                    ? this.party
                          .map(
                              (p) =>
                                  `<div class="gc-sdk-slot">${this.avatar(p.name, p.avatar, p.online)}<span class="gc-sdk-grow gc-sdk-title">${esc(p.name)}</span><span class="${p.mic === 'speaking' ? 'gc-sdk-live' : 'gc-sdk-mute'}">${icon(p.mic === 'off' ? 'micOff' : 'mic')}</span></div>`,
                          )
                          .join('')
                    : `<div class="gc-sdk-sub">${tr('Голосовий канал порожній')}</div>`;
            case 'groups':
                return this.family
                    ? `<div class="gc-sdk-slot">${icon('crown')}<span class="gc-sdk-grow gc-sdk-title">${esc(this.family.name)}</span><span class="gc-sdk-sub">${tr('{n} онлайн', { n: this.family.online })}</span></div><div class="gc-sdk-slot">${icon('wallet')}<span class="gc-sdk-grow">${tr('Казна штабу')}</span><b>$${this.family.treasury.toLocaleString(this.o.locale)}</b></div>`
                    : `<div class="gc-sdk-sub">${tr('Ви ще не в сім’ї чи клані')}</div>`;
            case 'music':
                return this.track
                    ? `<div class="gc-sdk-slot">${icon('music')}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${esc(this.track.title)}</span><span class="gc-sdk-sub">${esc(this.track.artist)}</span></span><button type="button" class="gc-sdk-icon-btn" data-act="music" data-cmd="${this.track.playing ? 'pause' : 'play'}" aria-label="${this.track.playing ? tr('Пауза') : tr('Грати')}">${icon(this.track.playing ? 'pause' : 'play')}</button><button type="button" class="gc-sdk-icon-btn" data-act="music" data-cmd="next" aria-label="${tr('Далі')}">${icon('next')}</button></div>`
                    : `<div class="gc-sdk-sub">${tr('Зараз нічого не грає')}</div>`;
            case 'achievements':
                return `<div class="gc-sdk-slot">${icon('trophy')}<span class="gc-sdk-grow">${tr('Досягнення гри з’являться тут')}</span></div>`;
        }
        return '';
    }

    private drawer() {
        const chips = this.convs
            .map(
                (c) =>
                    `<button type="button" class="gc-sdk-chip" role="tab" data-act="conv" data-id="${c.id}" aria-selected="${c.id === this.conv}">${esc(c.title)}</button>`,
            )
            .join('');
        const msgs = this.msgs
            .map(
                (m) =>
                    `<div class="gc-sdk-bubble" data-mine="${m.mine ? 1 : 0}">${m.author && !m.mine ? `<div class="gc-sdk-sub">${esc(m.author)}</div>` : ''}${esc(m.body)}</div>`,
            )
            .join('');
        return `<aside class="gc-sdk-drawer gc-sdk-frosted-glass ${this.chatOpen ? 'gc-sdk-interactive' : ''}" data-open="${this.chatOpen ? 1 : 0}" aria-hidden="${!this.chatOpen}">
<div class="gc-sdk-row">${icon('chat')}<span class="gc-sdk-grow gc-sdk-title">${tr('Чат GameCon')}</span><span class="gc-sdk-kbd">${esc(this.o.hotkeys.chat)}</span><button type="button" class="gc-sdk-icon-btn" data-act="chat-close" aria-label="${tr('Закрити')}">${icon('x')}</button></div>
<div class="gc-sdk-convs" role="tablist">${chips}</div><div class="gc-sdk-messages">${msgs || `<div class="gc-sdk-sub">${this.user ? tr('Повідомлень поки немає') : tr('Увійдіть, щоб писати друзям')}</div>`}</div>
<form class="gc-sdk-input"><input placeholder="${tr('Повідомлення…')}" aria-label="${tr('Повідомлення…')}" ${this.user ? '' : 'disabled'}><button type="submit" class="gc-sdk-btn" aria-label="${tr('Надіслати')}" ${this.user ? '' : 'disabled'}>${icon('send')}</button></form></aside>`;
    }

    private onClick(e: MouseEvent) {
        const el = (e.target as HTMLElement).closest<HTMLElement>(
            '[data-act],[data-tab]',
        );
        if (!el || this.dragged) return;
        if (el.dataset.tab) {
            this.tab = el.dataset.tab as TabKey;
            if (this.tab === 'chat' && this.o.modules.includes('chat'))
                this.openChat(true);
            this.render();
            return;
        }
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
                this.openChat(true);
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

    // ── Перетягування віджетів ──
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
                const r = w.getBoundingClientRect();
                const ox = e.clientX - r.left;
                const oy = e.clientY - r.top;
                let moved = false;
                w.classList.add('gc-sdk-dragging');
                const move = (ev: PointerEvent) => {
                    moved = true;
                    const x = Math.max(
                        0,
                        Math.min(
                            box.width - r.width,
                            ev.clientX - box.left - ox,
                        ),
                    );
                    const y = Math.max(
                        0,
                        Math.min(
                            box.height - r.height,
                            ev.clientY - box.top - oy,
                        ),
                    );
                    w.style.cssText += `left:${x}px;top:${y}px;right:auto;bottom:auto;`;
                };
                const up = (ev: PointerEvent) => {
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', up);
                    w.classList.remove('gc-sdk-dragging');
                    if (!moved) return;
                    this.dragged = true;
                    setTimeout(() => (this.dragged = false), 0);
                    // Прилипає до найближчого кута — так позиція переживає зміну розміру вікна.
                    const cx =
                        ev.clientX - box.left < box.width / 2
                            ? 'left'
                            : 'right';
                    const cy =
                        ev.clientY - box.top < box.height / 2
                            ? 'top'
                            : 'bottom';
                    const key = w.dataset.w as 'hud' | 'party' | 'family';
                    this.o.position[key] = `${cy}-${cx}` as Corner;
                    this.emit('move', {
                        widget: key,
                        corner: this.o.position[key],
                    });
                    this.render();
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
