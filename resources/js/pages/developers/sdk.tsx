import { Head, Link } from '@inertiajs/react';
import {
    Check,
    Code2,
    Copy,
    Gamepad2,
    KeyRound,
    Layers,
    MessageCircle,
    Monitor,
    QrCode,
    Server,
    Swords,
    UserCog,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    Chips,
    Range,
    SdkStage,
    Seg,
    type SdkInstance,
} from '@/components/developers/overlay-editor';
import { Toggle } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    base: string;
    script: string;
    overlay: string;
    endpoints: Record<string, string>;
    scopes: { key: string; label: string }[];
};

const SECTIONS: [string, string][] = [
    ['friends', tr('Друзі')],
    ['party', tr('Паті')],
    ['chat', tr('Чат')],
    ['voice', tr('Голос')],
    ['groups', tr('Сім’я й клан')],
    ['music', tr('Музика')],
    ['achievements', tr('Досягнення')],
];

const PLATFORMS: [string, boolean][] = [
    ['Web / CEF / Electron', true],
    ['Unity (C#)', false],
    ['Unreal (C++)', false],
    ['Godot', false],
    ['Flutter', false],
    ['Android', false],
    ['iOS / macOS', false],
    ['Windows (.NET)', false],
];

/** /developers/sdk — оверлей GameCon для ігор: жива пісочниця, код ініціалізації, вхід і API. */
export default function DeveloperSdk({
    base,
    script,
    overlay,
    endpoints,
}: Props) {
    const reduce = useReducedMotion();
    const sdk = useRef<SdkInstance | null>(null);
    const [layout, setLayout] = useState<'unified' | 'separate' | 'custom'>(
        'custom',
    );
    const [windows, setWindows] = useState<string[]>(['party', 'groups']);
    const [side, setSide] = useState<'left' | 'right' | 'top'>('left');
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [density, setDensity] = useState(84);
    const [hud, setHud] = useState(true);
    const [drop, setDrop] = useState(true);
    const [busy, setBusy] = useState(false);
    const [bg, setBg] = useState('');
    const [tab, setTab] = useState<'web' | 'cef'>('web');
    const [copied, setCopied] = useState(false);

    const options = useMemo(
        () => ({
            layout,
            windows,
            side,
            theme,
            density,
            modules: [hud && 'hud', drop && 'drop', 'chat'].filter(Boolean),
        }),
        [layout, windows, side, theme, density, hud, drop],
    );

    const code =
        tab === 'web'
            ? `<script src="${script}"></script>
<script>
  GameConSDK.init({
    clientId: 'ВАШ_CLIENT_ID',
    // Вхід: redirectUri (PKCE) або без нього — код і QR (gamecon.online/link)
    layout: '${layout}',${layout === 'custom' ? `\n    windows: ${JSON.stringify(windows)},` : ''}
    side: '${side}',
    theme: '${theme}',
    density: ${density},
    modules: ${JSON.stringify(options.modules)},
  }).then((sdk) => {
    sdk.on('command', ({ command }) => game.run(command));
    // у бою: sdk.setBusy(true); контекст: sdk.setContext('match')
  });
</script>`
            : `${overlay}?client_id=ВАШ_CLIENT_ID&layout=${layout}&side=${side}&theme=${theme}&modules=${options.modules.join(',')}

// Керування з гри (CEF / iframe):
window.postMessage({ target: 'gamecon-sdk', cmd: 'toggle' }, '*');
window.postMessage({ target: 'gamecon-sdk', cmd: 'setBusy', args: [true] }, '*');`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(tr('Не вдалося скопіювати'));
        }
    };

    return (
        <>
            <Head title={tr('GameCon SDK для ігор')} />
            <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 py-4">
                <m.header
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                            <Layers className="size-6" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="font-display text-2xl font-bold text-white">
                                GameCon SDK
                            </h1>
                            <p className="text-sm text-white/55">
                                {tr(
                                    'Друзі, паті, чат, голос, сім’я й музика — прозорим оверлеєм просто у вашій грі.',
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {PLATFORMS.map(([name, ready]) => (
                            <span
                                key={name}
                                className={cn(
                                    'rounded-full px-3 py-1 text-xs',
                                    ready
                                        ? 'bg-white/15 text-white'
                                        : 'bg-white/[0.04] text-white/45',
                                )}
                            >
                                {name}
                                {!ready && ` · ${tr('готується')}`}
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/developers"
                            className="btn-glow inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Code2 className="size-4" />
                            {tr('Створити застосунок')}
                        </Link>
                        <Link
                            href="/developers/plugins"
                            className="gc-solid-2 inline-flex h-10 items-center rounded-xl px-4 text-sm text-white/80 hover:text-white"
                        >
                            {tr('Плагіни й SDK')}
                        </Link>
                    </div>
                </m.header>

                <section className="gc-solid min-w-0 space-y-4 rounded-2xl p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Пісочниця')}
                        </h2>
                        <p className="text-xs text-white/45">
                            {tr(
                                'Справжній SDK у демо-режимі: перетягуйте вікна, відкривайте «краплю».',
                            )}
                        </p>
                    </div>
                    <SdkStage
                        options={options}
                        background={bg || null}
                        onSdk={(s) => (sdk.current = s)}
                        className="aspect-[3/4] w-full sm:aspect-video"
                    />
                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        <Control label={tr('Розділи')}>
                            <Seg
                                value={layout}
                                onChange={setLayout}
                                options={[
                                    ['unified', tr('Одним вікном')],
                                    ['separate', tr('Окремими')],
                                    ['custom', tr('На вибір')],
                                ]}
                            />
                        </Control>
                        <Control label={tr('«Крапля»')}>
                            <Seg
                                value={side}
                                onChange={setSide}
                                options={[
                                    ['left', tr('Ліворуч')],
                                    ['top', tr('Згори')],
                                    ['right', tr('Праворуч')],
                                ]}
                            />
                        </Control>
                        <Control label={tr('Тема скла')}>
                            <Seg
                                value={theme}
                                onChange={setTheme}
                                options={[
                                    ['dark', tr('Темна')],
                                    ['light', tr('Світла')],
                                ]}
                            />
                        </Control>
                        <Control
                            label={tr('Щільність скла: {n}%', { n: density })}
                        >
                            <Range
                                min={60}
                                max={100}
                                value={density}
                                onChange={setDensity}
                            />
                        </Control>
                        {layout === 'custom' && (
                            <div className="md:col-span-2">
                                <Chips
                                    label={tr('Окремими вікнами')}
                                    items={SECTIONS}
                                    value={windows}
                                    onToggle={(k) =>
                                        setWindows((w) =>
                                            w.includes(k)
                                                ? w.filter((x) => x !== k)
                                                : [...w, k],
                                        )
                                    }
                                />
                            </div>
                        )}
                        <Control label={tr('Капсула HUD')}>
                            <Toggle
                                checked={hud}
                                onChange={setHud}
                                label={tr('Капсула HUD')}
                            />
                        </Control>
                        <Control label={tr('«Крапля» зі стрілкою')}>
                            <Toggle
                                checked={drop}
                                onChange={setDrop}
                                label={tr('«Крапля» зі стрілкою')}
                            />
                        </Control>
                        <Control label={tr('Фон: своє фото чи відео (URL)')}>
                            <input
                                value={bg}
                                onChange={(e) => setBg(e.target.value)}
                                placeholder="https://…/screenshot.jpg"
                                className="gc-solid-2 h-9 w-full min-w-0 rounded-lg px-3 text-sm text-white outline-none placeholder:text-white/30"
                            />
                        </Control>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Action
                                onClick={() => {
                                    sdk.current?.setBusy(!busy);
                                    setBusy(!busy);
                                }}
                                pressed={busy}
                                icon={Swords}
                            >
                                {tr('У бою')}
                            </Action>
                            <Action
                                onClick={() =>
                                    sdk.current?.toast(
                                        tr('Досягнення: «Перша перемога»'),
                                        undefined,
                                        'trophy',
                                    )
                                }
                                icon={Gamepad2}
                            >
                                {tr('Сповіщення')}
                            </Action>
                            <Action
                                onClick={() => sdk.current?.openChat()}
                                icon={MessageCircle}
                            >
                                {tr('Чат')}
                            </Action>
                        </div>
                    </div>
                </section>

                <section className="gc-solid min-w-0 space-y-3 rounded-2xl p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="mr-auto font-display text-lg font-bold text-white">
                            {tr('Код ініціалізації')}
                        </h2>
                        <Seg
                            value={tab}
                            onChange={setTab}
                            options={[
                                ['web', tr('Сторінка / Electron')],
                                ['cef', tr('CEF / iframe')],
                            ]}
                        />
                    </div>
                    <div className="relative min-w-0">
                        <pre className="gc-solid-2 max-h-80 overflow-auto rounded-xl p-4 pr-12 font-mono text-xs leading-relaxed text-white/85">
                            {code}
                        </pre>
                        <button
                            type="button"
                            onClick={copy}
                            aria-label={tr('Скопіювати')}
                            className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
                        >
                            {copied ? (
                                <Check className="size-4 text-emerald-300" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Вигляд, розкладку й дозволи гравцю зручніше задати в порталі (Розробникам → застосунок → Оверлей): SDK підхопить їх сам, а значення з коду мають перевагу.',
                        )}
                    </p>
                </section>

                <section className="grid min-w-0 gap-3 md:grid-cols-3">
                    <Feature
                        icon={QrCode}
                        title={tr('Вхід гравця')}
                        text={tr(
                            'OAuth 2.1: у браузері з PKCE (на ПК — повернення на 127.0.0.1, на телефоні — своя схема) або за кодом пристрою: гра показує код і QR, гравець підтверджує на {link}.',
                            {
                                link: endpoints.link.replace(
                                    /^https?:\/\//,
                                    '',
                                ),
                            },
                        )}
                    />
                    <Feature
                        icon={UserCog}
                        title={tr('Налаштування гравця')}
                        text={tr(
                            'Шестерня в оверлеї: одним вікном чи окремо, щільність, розмір, хоткеї, режим стрімера. Зберігається в акаунті GameCon — на всіх пристроях однаково.',
                        )}
                    />
                    <Feature
                        icon={Server}
                        title={tr('Сервер гри')}
                        text={tr(
                            'Досягнення, таблиці лідерів і сповіщення гравцям — з вашого сервера за client_id і client_secret, лише для тих, хто підключив гру.',
                        )}
                    />
                </section>

                <section className="gc-solid min-w-0 space-y-3 rounded-2xl p-4 sm:p-5">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <KeyRound className="size-5 text-primary" />
                        {tr('Адреси')}
                    </h2>
                    <dl className="grid min-w-0 gap-2">
                        {Object.entries({
                            [tr('Скрипт SDK')]: script,
                            [tr('Оверлей для CEF / iframe')]: overlay,
                            ...Object.fromEntries(
                                Object.entries(endpoints).map(([k, v]) => [
                                    k,
                                    v,
                                ]),
                            ),
                        }).map(([k, v]) => (
                            <div
                                key={k}
                                className="grid min-w-0 gap-1 sm:grid-cols-[12rem_minmax(0,1fr)]"
                            >
                                <dt className="text-xs text-white/50">{k}</dt>
                                <dd className="min-w-0 truncate font-mono text-xs text-white/80">
                                    {v}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <p className="flex items-center gap-1.5 text-xs text-white/40">
                        <Monitor className="size-3.5 shrink-0" />
                        {tr('Базова адреса API: {base}/api/developer/v1', {
                            base,
                        })}
                    </p>
                </section>
            </div>
        </>
    );
}

function Control({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid min-w-0 gap-1.5">
            <span className="text-xs text-white/50">{label}</span>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function Action({
    onClick,
    pressed,
    icon: Icon,
    children,
}: {
    onClick: () => void;
    pressed?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm transition',
                pressed
                    ? 'bg-white/15 text-white'
                    : 'gc-solid-2 text-white/75 hover:text-white',
            )}
        >
            <Icon className="size-4" />
            {children}
        </button>
    );
}

function Feature({
    icon: Icon,
    title,
    text,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    text: string;
}) {
    return (
        <div className="gc-solid min-w-0 space-y-2 rounded-2xl p-4">
            <Icon className="size-5 text-primary" />
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-white/60">{text}</p>
        </div>
    );
}
