import { router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    History,
    Layers,
    Monitor,
    Plus,
    Rocket,
    Trash2,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Toggle } from '@/components/gc/admin';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type OverlayConfig = {
    enabled: boolean;
    accent: string;
    logo_url: string | null;
    title: string | null;
    side: 'left' | 'right' | 'top';
    offset: number;
    hotkey: string;
    chat_hotkey: string;
    gamepad: boolean;
    swipe: boolean;
    hide_when_busy: boolean;
    theme: 'dark' | 'light' | 'auto';
    radius: number;
    opacity: number;
    toasts: Corner | 'top' | 'off';
    tabs: string[];
    modules: string[];
    positions: Record<string, Corner>;
    layout: 'unified' | 'separate' | 'custom';
    windows: string[];
    contexts: Record<'menu' | 'lobby' | 'match', string[]>;
    platforms: Record<'pc' | 'console' | 'mobile' | 'deck', boolean>;
    player_can: string[];
    custom_items: {
        label: string;
        url: string | null;
        command: string | null;
    }[];
    onboarding: boolean;
    hotkey_hint: boolean;
    locale: string;
};

const SECTIONS: [string, string][] = [
    ['friends', tr('Друзі')],
    ['party', tr('Паті')],
    ['chat', tr('Чат')],
    ['voice', tr('Голос')],
    ['groups', tr('Сім’я й клан')],
    ['music', tr('Музика')],
    ['achievements', tr('Досягнення')],
    ['game', tr('Пункти гри')],
];
const CORNERS: [Corner, string][] = [
    ['top-left', tr('Згори ліворуч')],
    ['top-right', tr('Згори праворуч')],
    ['bottom-left', tr('Знизу ліворуч')],
    ['bottom-right', tr('Знизу праворуч')],
];
const ACCENTS = [
    '#4f7cff',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#a855f7',
    '#06b6d4',
];

type SdkInstance = {
    configure: (o: Record<string, unknown>) => void;
    destroy: () => void;
    toggle: (force?: boolean) => void;
};
type SdkGlobal = { init: (o: Record<string, unknown>) => Promise<SdkInstance> };

/** Портал → параметри SDK (ті самі, що SDK бере з /sdk/config). */
export function sdkOptions(cfg: OverlayConfig): Record<string, unknown> {
    return {
        accent: cfg.accent,
        logo: cfg.logo_url,
        title: cfg.title,
        side: cfg.side,
        offset: cfg.offset,
        theme: cfg.theme,
        radius: cfg.radius,
        density: cfg.opacity,
        toasts: cfg.toasts,
        tabs: cfg.tabs,
        modules: cfg.enabled ? cfg.modules : [],
        position: cfg.positions,
        layout: cfg.layout,
        windows: cfg.windows,
        contexts: cfg.contexts,
        customItems: cfg.custom_items,
        hotkeys: { toggle: cfg.hotkey, chat: cfg.chat_hotkey },
        gamepad: cfg.gamepad,
        swipe: cfg.swipe,
        hideWhenBusy: cfg.hide_when_busy,
    };
}

let loading: Promise<SdkGlobal> | null = null;
/** Справжній SDK (той самий файл, що й в іграх) — у демо-режимі без мережі. */
export function loadSdk(): Promise<SdkGlobal> {
    const w = window as unknown as { GameConSDK?: SdkGlobal };
    if (w.GameConSDK) return Promise.resolve(w.GameConSDK);
    loading ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/sdk/v1/gamecon-sdk.js';
        s.onload = () => resolve(w.GameConSDK as SdkGlobal);
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return loading;
}

/** Ігрова сцена власного малювання + живий оверлей SDK поверх неї. */
export function SdkStage({
    options,
    className,
    background,
    children,
}: {
    options: Record<string, unknown>;
    className?: string;
    background?: string | null;
    children?: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const sdk = useRef<SdkInstance | null>(null);
    const latest = useRef(options);
    latest.current = options;

    useEffect(() => {
        let alive = true;
        void loadSdk().then(async (g) => {
            if (!alive || !ref.current) return;
            sdk.current = await g.init({
                demo: true,
                root: ref.current,
                remoteConfig: false,
                draggable: true,
                ...latest.current,
            });
        });
        return () => {
            alive = false;
            sdk.current?.destroy();
        };
    }, []);

    useEffect(() => {
        sdk.current?.configure(options);
    }, [options]);

    const video = background && /\.(mp4|webm)(\?|$)/i.test(background);
    return (
        <div
            ref={ref}
            className={cn(
                'relative isolate overflow-hidden rounded-2xl bg-[#05070d] [clip-path:inset(0_round_1rem)]',
                className,
            )}
        >
            {background ? (
                video ? (
                    <video
                        src={background}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <img
                        src={background}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                    />
                )
            ) : (
                <GameScene />
            )}
            {children}
        </div>
    );
}

/** Умовна гра: небо, силуети, приціл і HUD — щоб було видно, як скло лягає на картинку. */
function GameScene() {
    const reduce = useReducedMotion();
    return (
        <div aria-hidden className="absolute inset-0">
            <m.div
                className="absolute inset-[-10%]"
                style={{
                    background:
                        'radial-gradient(40% 35% at 70% 30%, rgba(255,170,90,.55), transparent 70%), radial-gradient(45% 40% at 20% 75%, rgba(70,140,255,.4), transparent 70%), linear-gradient(180deg,#26334d 0%,#3a4658 48%,#1a212c 49%,#0f141b 100%)',
                }}
                animate={reduce ? undefined : { x: ['0%', '-3%', '0%'] }}
                transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            />
            {[
                [8, 9, 22],
                [19, 6, 30],
                [58, 11, 18],
                [83, 8, 26],
            ].map(([l, w, h]) => (
                <span
                    key={l}
                    className="absolute bottom-[51%] bg-[#0b1017]"
                    style={{ left: `${l}%`, width: `${w}%`, height: `${h}%` }}
                />
            ))}
            <span className="absolute top-1/2 left-1/2 size-4 -translate-1/2 rounded-full border-2 border-white/80" />
            <span className="absolute bottom-3 left-4 font-display text-lg font-bold text-white/90 [text-shadow:0_2px_6px_#000]">
                100 · 30/90
            </span>
        </div>
    );
}

/** Налаштування оверлею однієї гри: чернетка з живим переглядом, публікація, історія. */
export function OverlayEditor({
    appId,
    appName,
    initial,
    dirty,
    publishedAt,
    versions,
    onClose,
}: {
    appId: number;
    appName: string;
    initial: OverlayConfig;
    dirty: boolean;
    publishedAt: string | null;
    versions: { published_at: string | null }[];
    onClose: () => void;
}) {
    const { sdk_locales: locales = [] } = usePage<{
        sdk_locales?: { code: string; native: string }[];
    }>().props;
    const [cfg, setCfg] = useState<OverlayConfig>(initial);
    const [busy, setBusy] = useState(false);
    useEffect(() => setCfg(initial), [initial]);
    const set = <K extends keyof OverlayConfig>(k: K, v: OverlayConfig[K]) =>
        setCfg((c) => ({ ...c, [k]: v }));
    const flip = (list: string[], v: string) =>
        list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    const opts = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };
    const save = () =>
        router.put(`/developers/apps/${appId}/overlay`, cfg, opts);
    const publish = () =>
        router.post(`/developers/apps/${appId}/overlay/publish`, {}, opts);
    const discard = () =>
        router.delete(`/developers/apps/${appId}/overlay`, opts);

    return (
        <div className="space-y-4">
            <SdkStage
                options={sdkOptions(cfg)}
                className="aspect-video w-full"
            />
            <p className="text-xs text-white/45">
                {tr(
                    'Це справжній SDK у демо-режимі: віджети можна перетягувати, вкладки — перемикати.',
                )}
            </p>

            <Group title={tr('Вигляд')} open>
                <Row label={tr('Оверлей у грі')}>
                    <Toggle
                        checked={cfg.enabled}
                        onChange={(v) => set('enabled', v)}
                        label={tr('Оверлей у грі')}
                    />
                </Row>
                <Row label={tr('Тема')}>
                    <Seg
                        value={cfg.theme}
                        onChange={(v) => set('theme', v)}
                        options={[
                            ['dark', tr('Темна')],
                            ['light', tr('Світла')],
                            ['auto', tr('Як у системі')],
                        ]}
                    />
                </Row>
                <Row label={tr('Колір індикаторів гри')}>
                    <div className="flex items-center gap-1.5">
                        {ACCENTS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                aria-label={c}
                                onClick={() => set('accent', c)}
                                className={cn(
                                    'size-6 rounded-full transition',
                                    cfg.accent.toLowerCase() === c &&
                                        'ring-2 ring-white/80 ring-offset-2 ring-offset-transparent',
                                )}
                                style={{ background: c }}
                            />
                        ))}
                        <input
                            type="color"
                            value={cfg.accent}
                            onChange={(e) => set('accent', e.target.value)}
                            aria-label={tr('Свій колір')}
                            className="size-7 cursor-pointer rounded-md bg-transparent"
                        />
                    </div>
                </Row>
                <Row label={tr('Назва в панелі')}>
                    <Text
                        value={cfg.title ?? ''}
                        placeholder={appName}
                        onChange={(v) => set('title', v || null)}
                    />
                </Row>
                <Row label={tr('Логотип гри (https)')}>
                    <Text
                        value={cfg.logo_url ?? ''}
                        placeholder="https://…/logo.png"
                        onChange={(v) => set('logo_url', v || null)}
                    />
                </Row>
                <Row label={tr('Заокруглення: {n}px', { n: cfg.radius })}>
                    <Range
                        min={0}
                        max={32}
                        value={cfg.radius}
                        onChange={(v) => set('radius', v)}
                    />
                </Row>
                <Row label={tr('Щільність скла: {n}%', { n: cfg.opacity })}>
                    <Range
                        min={60}
                        max={100}
                        value={cfg.opacity}
                        onChange={(v) => set('opacity', v)}
                    />
                </Row>
            </Group>

            <Group title={tr('Розкладка')} open>
                <Row label={tr('Розділи')}>
                    <Seg
                        value={cfg.layout}
                        onChange={(v) => set('layout', v)}
                        options={[
                            ['unified', tr('Одним вікном')],
                            ['separate', tr('Окремими вікнами')],
                            ['custom', tr('На вибір')],
                        ]}
                    />
                </Row>
                {cfg.layout === 'custom' && (
                    <Chips
                        label={tr('Окремими вікнами (решта — вкладками)')}
                        items={SECTIONS}
                        value={cfg.windows}
                        onToggle={(k) => set('windows', flip(cfg.windows, k))}
                    />
                )}
                <Chips
                    label={tr('Вкладки, доступні в грі')}
                    items={SECTIONS.filter(([k]) => k !== 'game')}
                    value={cfg.tabs}
                    onToggle={(k) => set('tabs', flip(cfg.tabs, k))}
                />
                <Row label={tr('Капсула HUD')}>
                    <Toggle
                        checked={cfg.modules.includes('hud')}
                        onChange={() =>
                            set('modules', flip(cfg.modules, 'hud'))
                        }
                        label={tr('Капсула HUD')}
                    />
                </Row>
                <Row label={tr('«Крапля» зі стрілкою')}>
                    <Toggle
                        checked={cfg.modules.includes('drop')}
                        onChange={() =>
                            set('modules', flip(cfg.modules, 'drop'))
                        }
                        label={tr('«Крапля» зі стрілкою')}
                    />
                </Row>
                <Row label={tr('Де «крапля»')}>
                    <Seg
                        value={cfg.side}
                        onChange={(v) => set('side', v)}
                        options={[
                            ['left', tr('Ліворуч')],
                            ['top', tr('Згори')],
                            ['right', tr('Праворуч')],
                        ]}
                    />
                </Row>
                <Row label={tr('Положення на краю: {n}%', { n: cfg.offset })}>
                    <Range
                        min={5}
                        max={95}
                        value={cfg.offset}
                        onChange={(v) => set('offset', v)}
                    />
                </Row>
                <div className="space-y-2">
                    <p className="text-xs text-white/50">
                        {tr(
                            'Кути вікон (гравець може перетягнути, якщо дозволено)',
                        )}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {[
                            ['hud', tr('Капсула HUD')] as [string, string],
                            ...SECTIONS,
                        ].map(([k, l]) => (
                            <label
                                key={k}
                                className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5"
                            >
                                <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                                    {l}
                                </span>
                                <select
                                    value={cfg.positions[k] ?? ''}
                                    onChange={(e) =>
                                        set('positions', {
                                            ...cfg.positions,
                                            [k]: e.target.value as Corner,
                                        })
                                    }
                                    aria-label={l}
                                    className="h-7 rounded-md bg-transparent text-xs text-white outline-none"
                                >
                                    {k !== 'hud' && (
                                        <option value="">{tr('Типово')}</option>
                                    )}
                                    {CORNERS.map(([c, cl]) => (
                                        <option key={c} value={c}>
                                            {cl}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                </div>
                <Row label={tr('Сповіщення в грі')}>
                    <select
                        value={cfg.toasts}
                        onChange={(e) =>
                            set(
                                'toasts',
                                e.target.value as OverlayConfig['toasts'],
                            )
                        }
                        className="gc-solid-2 h-9 w-full rounded-lg px-2 text-sm text-white outline-none"
                    >
                        {CORNERS.map(([c, cl]) => (
                            <option key={c} value={c}>
                                {cl}
                            </option>
                        ))}
                        <option value="top">{tr('Згори по центру')}</option>
                        <option value="off">{tr('Не показувати')}</option>
                    </select>
                </Row>
            </Group>

            <Group title={tr('Профілі за контекстом гри')}>
                <p className="text-xs text-white/45">
                    {tr(
                        "Гра викликає setContext('menu' | 'lobby' | 'match') — і показується лише вибране.",
                    )}
                </p>
                {(
                    [
                        ['menu', tr('Меню')],
                        ['lobby', tr('Лобі')],
                        ['match', tr('Матч')],
                    ] as const
                ).map(([ctx, label]) => (
                    <Chips
                        key={ctx}
                        label={label}
                        items={[
                            ['hud', tr('Капсула HUD')],
                            ['drop', tr('«Крапля»')],
                            ...SECTIONS,
                        ]}
                        value={cfg.contexts[ctx]}
                        onToggle={(k) =>
                            set('contexts', {
                                ...cfg.contexts,
                                [ctx]: flip(cfg.contexts[ctx], k),
                            })
                        }
                    />
                ))}
            </Group>

            <Group title={tr('Керування й платформи')}>
                <Row label={tr('Відкрити GameCon')}>
                    <Text
                        mono
                        value={cfg.hotkey}
                        onChange={(v) => set('hotkey', v)}
                    />
                </Row>
                <Row label={tr('Чат')}>
                    <Text
                        mono
                        value={cfg.chat_hotkey}
                        onChange={(v) => set('chat_hotkey', v)}
                    />
                </Row>
                {(
                    [
                        ['gamepad', tr('Кнопка «Додому» на геймпаді')],
                        ['swipe', tr('Свайп від краю на телефонах')],
                        ['hide_when_busy', tr('Ховати в бою (setBusy)')],
                    ] as const
                ).map(([k, l]) => (
                    <Row key={k} label={l}>
                        <Toggle
                            checked={cfg[k]}
                            onChange={(v) => set(k, v)}
                            label={l}
                        />
                    </Row>
                ))}
                <Chips
                    label={tr('Оверлей увімкнено на платформах')}
                    items={[
                        ['pc', tr('ПК')],
                        ['console', tr('Консоль')],
                        ['mobile', tr('Телефон')],
                        ['deck', 'Steam Deck'],
                    ]}
                    value={Object.entries(cfg.platforms)
                        .filter(([, on]) => on)
                        .map(([k]) => k)}
                    onToggle={(k) =>
                        set('platforms', {
                            ...cfg.platforms,
                            [k]: !cfg.platforms[
                                k as keyof OverlayConfig['platforms']
                            ],
                        })
                    }
                />
            </Group>

            <Group title={tr('Що гравцю дозволено міняти')}>
                <Chips
                    label={tr('Решта — лише як задали ви')}
                    items={[
                        ['move', tr('Переміщувати вікна')],
                        ['modules', tr('Розкладка й набір віджетів')],
                        ['hotkeys', tr('Хоткеї й геймпад')],
                        ['density', tr('Щільність і розмір')],
                        ['disable', tr('Вимикати оверлей')],
                    ]}
                    value={cfg.player_can}
                    onToggle={(k) => set('player_can', flip(cfg.player_can, k))}
                />
            </Group>

            <Group title={tr('Свої пункти в панелі')}>
                {cfg.custom_items.map((it, i) => (
                    <div
                        key={i}
                        className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
                    >
                        <Text
                            value={it.label}
                            placeholder={tr('Назва')}
                            onChange={(v) =>
                                set(
                                    'custom_items',
                                    cfg.custom_items.map((x, j) =>
                                        j === i ? { ...x, label: v } : x,
                                    ),
                                )
                            }
                        />
                        <Text
                            value={it.url ?? it.command ?? ''}
                            placeholder={tr('https://… або команда гри')}
                            onChange={(v) =>
                                set(
                                    'custom_items',
                                    cfg.custom_items.map((x, j) =>
                                        j === i
                                            ? /^https:\/\//.test(v)
                                                ? {
                                                      ...x,
                                                      url: v,
                                                      command: null,
                                                  }
                                                : {
                                                      ...x,
                                                      url: null,
                                                      command: v,
                                                  }
                                            : x,
                                    ),
                                )
                            }
                        />
                        <button
                            type="button"
                            aria-label={tr('Прибрати')}
                            onClick={() =>
                                set(
                                    'custom_items',
                                    cfg.custom_items.filter((_, j) => j !== i),
                                )
                            }
                            className="grid size-9 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
                {cfg.custom_items.length < 6 && (
                    <button
                        type="button"
                        onClick={() =>
                            set('custom_items', [
                                ...cfg.custom_items,
                                { label: '', url: null, command: '' },
                            ])
                        }
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                        <Plus className="size-4" />
                        {tr('Додати пункт')}
                    </button>
                )}
            </Group>

            <Group title={tr('Перший запуск і мова')}>
                <Row label={tr('Привітання «Гра підтримує GameCon»')}>
                    <Toggle
                        checked={cfg.onboarding}
                        onChange={(v) => set('onboarding', v)}
                        label={tr('Привітання')}
                    />
                </Row>
                <Row label={tr('Підказка хоткея перші 3 запуски')}>
                    <Toggle
                        checked={cfg.hotkey_hint}
                        onChange={(v) => set('hotkey_hint', v)}
                        label={tr('Підказка хоткея')}
                    />
                </Row>
                <Row label={tr('Мова SDK')}>
                    {locales.length ? (
                        <select
                            value={cfg.locale}
                            onChange={(e) => set('locale', e.target.value)}
                            className="gc-solid-2 h-9 w-full rounded-lg px-2 text-sm text-white outline-none"
                        >
                            <option value="auto">{tr('Як у гравця')}</option>
                            {locales.map((l) => (
                                <option key={l.code} value={l.code}>
                                    {l.native}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-xs text-white/45">
                            {tr(
                                'Як у гравця (вибір мови недоступний у вашій країні)',
                            )}
                        </span>
                    )}
                </Row>
            </Group>

            {versions.length > 0 && (
                <Group title={tr('Історія публікацій')}>
                    {versions.map((v, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 text-sm text-white/70"
                        >
                            <History className="size-4 text-white/40" />
                            <span className="flex-1">
                                {v.published_at
                                    ? timeAgo(v.published_at)
                                    : tr('Перша версія')}
                            </span>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    router.post(
                                        `/developers/apps/${appId}/overlay/rollback`,
                                        { version: i },
                                        opts,
                                    )
                                }
                                className="rounded-lg px-3 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
                            >
                                {tr('Відкрити як чернетку')}
                            </button>
                        </div>
                    ))}
                </Group>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto flex items-center gap-1.5 text-xs text-white/45">
                    <Monitor className="size-3.5" />
                    {dirty
                        ? tr('Є неопублікована чернетка')
                        : publishedAt
                          ? tr('Опубліковано {time}', {
                                time: timeAgo(publishedAt),
                            })
                          : tr(
                                'Ще не опубліковано — гравці бачать типовий вигляд',
                            )}
                </span>
                {dirty && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={discard}
                        className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/[0.06]"
                    >
                        {tr('Скасувати чернетку')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]"
                >
                    {tr('Закрити')}
                </button>
                <button
                    type="button"
                    disabled={busy || cfg.tabs.length === 0}
                    onClick={save}
                    className="gc-solid-2 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                    <Layers className="size-4" />
                    {tr('Зберегти чернетку')}
                </button>
                <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={publish}
                    className="btn-glow flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
                >
                    <Rocket className="size-4" />
                    {tr('Опублікувати')}
                </button>
            </div>
        </div>
    );
}

function Group({
    title,
    open: initial = false,
    children,
}: {
    title: string;
    open?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(initial);
    const reduce = useReducedMotion();
    return (
        <section className="gc-solid-2 rounded-xl">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white"
            >
                {title}
                <ChevronDown
                    className={cn(
                        'size-4 text-white/50 transition',
                        open && 'rotate-180',
                    )}
                />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <m.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid gap-3 px-4 pb-4">{children}</div>
                    </m.div>
                )}
            </AnimatePresence>
        </section>
    );
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid min-w-0 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <span className="text-sm text-white/70">{label}</span>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function Text({
    value,
    onChange,
    placeholder,
    mono,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}) {
    return (
        <input
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                'gc-solid-2 h-9 w-full rounded-lg px-3 text-sm text-white outline-none placeholder:text-white/30',
                mono && 'font-mono',
            )}
        />
    );
}

function Range({
    min,
    max,
    value,
    onChange,
}: {
    min: number;
    max: number;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(+e.target.value)}
            className="w-full accent-primary"
        />
    );
}

function Seg<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: [T, string][];
}) {
    return (
        <div className="flex rounded-lg bg-white/[0.05] p-0.5">
            {options.map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    aria-pressed={value === key}
                    onClick={() => onChange(key)}
                    className={cn(
                        'flex-1 rounded-md px-2 py-1 text-xs transition',
                        value === key
                            ? 'bg-white/15 text-white'
                            : 'text-white/50 hover:text-white/80',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

/** Підписи передаються українською (ключі tr) — перекладаються тут. */
function Chips({
    label,
    items,
    value,
    onToggle,
}: {
    label: string;
    items: [string, string][];
    value: string[];
    onToggle: (k: string) => void;
}) {
    return (
        <div className="space-y-2">
            <p className="text-xs text-white/50">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {items.map(([k, l]) => {
                    const on = value.includes(k);
                    return (
                        <button
                            key={k}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onToggle(k)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs transition',
                                on
                                    ? 'bg-white/15 text-white'
                                    : 'bg-white/[0.04] text-white/45 hover:text-white/70',
                            )}
                        >
                            {l}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
