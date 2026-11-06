import { Head } from '@inertiajs/react';
import {
    Bell,
    BellOff,
    Layers,
    ListTree,
    Phone,
    Radar,
    Rocket,
    Shield,
    ShieldCheck,
    Siren,
    TriangleAlert,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    ALERT_COLOR,
    AlertMap,
    KIND_COLOR,
    kindLabel,
    NEARBY_COLOR,
    THREAT_COLOR,
    GLYPHS,
    threatLabel,
    threatTitle,
} from '@/components/alerts/alert-map';
import { Toggle } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    duration,
    LAYERS,
    loadLayers,
    loadSound,
    playSiren,
    saveLayers,
    saveSound,
    sourceGroupLabel,
} from '@/components/alerts/alert-utils';
import type {
    AlertLayer,
    AlertPrefs,
    AlertSourceGroup,
    AlertState,
} from '@/components/alerts/alert-utils';

function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Мапа тривог і радар цілей — лише для людей з України. */
export default function Alerts(props: {
    state: AlertState;
    prefs: AlertPrefs;
    regions: { slug: string; name: string }[];
    sources: AlertSourceGroup[];
}) {
    const [state, setState] = useState(props.state);
    const [prefs, setPrefs] = useState(props.prefs);
    const [now, setNow] = useState(() => Date.now());
    const [layers, setLayers] = useState<AlertLayer[]>(() => loadLayers());
    const [sound, setSound] = useState(() => loadSound());
    const [showSources, setShowSources] = useState(false);
    const seen = useRef<{ active: boolean; threats: Set<number> } | null>(null);

    // Звук: тривога щойно почалась у моїй області або нова ціль у ній.
    useEffect(() => {
        const mineActive =
            state.regions.find((r) => r.slug === prefs.region)?.active ?? false;
        const ids = new Set(
            state.threats
                .filter((t) => t.region === prefs.region)
                .map((t) => t.id),
        );
        const before = seen.current;
        seen.current = { active: mineActive, threats: ids };
        if (!before || !sound || !prefs.region) return;
        const fresh = [...ids].some((id) => !before.threats.has(id));
        if ((mineActive && !before.active) || fresh) playSiren();
    }, [state, prefs.region, sound]);

    const toggleLayer = (layer: AlertLayer) =>
        setLayers((cur) => {
            const next = cur.includes(layer)
                ? cur.filter((l) => l !== layer)
                : [...cur, layer];
            saveLayers(next);
            return next;
        });
    const toggleSound = () => {
        const next = !sound;
        setSound(next);
        saveSound(next);
        if (next) playSiren();
    };
    const visibleThreats = state.threats.filter((t) =>
        layers.includes(t.type as AlertLayer),
    );
    const counts = state.threats.reduce<Record<string, number>>((acc, t) => {
        acc[t.type] = (acc[t.type] ?? 0) + 1;
        return acc;
    }, {});

    // Живе оновлення: стан — раз на 15 с, таймери — щосекунди.
    useEffect(() => {
        const poll = window.setInterval(() => {
            api<AlertState & { prefs: AlertPrefs }>('GET', '/alerts/state')
                .then((d) => setState(d))
                .catch(() => undefined);
        }, 15_000);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, []);

    const save = (patch: Partial<AlertPrefs>) =>
        api<{ prefs: AlertPrefs }>('PUT', '/alerts/preferences', patch)
            .then((d) => {
                setPrefs(d.prefs);
                if ('shelter' in patch) {
                    toast.success(
                        patch.shelter
                            ? tr('Статус «В укритті» видно друзям і родині.')
                            : tr('Статус «В укритті» знято.'),
                    );
                }
            })
            .catch((e: Error) => toast.error(e.message));

    const active = state.regions.filter((r) => r.active);
    const mine = state.regions.find((r) => r.slug === prefs.region) ?? null;

    return (
        <>
            <Head title={tr('Мапа тривог')} />
            <div className="space-y-4">
                <header className="glass rounded-2xl p-5">
                    <div className="flex flex-wrap items-start gap-4">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15">
                            <Siren className="size-6 text-red-400" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-display text-2xl font-bold text-white">
                                {tr('Мапа тривог')}
                            </h1>
                            <p className="mt-1 text-sm text-white/60">
                                {active.length > 0
                                    ? tr('Зараз тривога в {n} регіонах', {
                                          n: active.length,
                                      })
                                    : tr('Зараз тривог немає')}
                                {' · '}
                                {tr('оновлено о {t}', {
                                    t: clock(state.updated_at),
                                })}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {(['uav', 'missile', 'kab'] as const)
                                    .filter((k) => counts[k])
                                    .map((k) => (
                                        <span
                                            key={k}
                                            className="inline-flex items-center gap-1.5 rounded-chip bg-white/8 px-3 py-1 text-xs font-semibold text-white/85"
                                        >
                                            <span
                                                className="size-2 rounded-full"
                                                style={{
                                                    background: THREAT_COLOR[k],
                                                }}
                                            />
                                            {threatLabel(k)} · {counts[k]}
                                        </span>
                                    ))}
                                {state.mig_active && (
                                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                                        <Radar className="size-3.5" />
                                        {tr('Зліт МіГ-31К')}
                                    </span>
                                )}
                                {state.ballistic_threat && (
                                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200">
                                        <Rocket className="size-3.5" />
                                        {tr('Загроза балістики')}
                                    </span>
                                )}
                                {state.stale && (
                                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
                                        <TriangleAlert className="size-3.5" />
                                        {tr('Дані можуть бути неактуальні')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <section
                    className={cn(
                        'glass rounded-2xl p-5',
                        mine?.active && 'bg-red-500/10',
                    )}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                            <p className="text-xs text-white/50">
                                {tr('Мій регіон')}
                            </p>
                            <select
                                value={prefs.region ?? ''}
                                onChange={(e) =>
                                    save({ region: e.target.value || null })
                                }
                                className="input-glass mt-1 h-10 w-full max-w-xs rounded-xl px-3 text-sm text-white"
                            >
                                <option value="">
                                    {tr('Оберіть область')}
                                </option>
                                {props.regions.map((r) => (
                                    <option key={r.slug} value={r.slug}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                            {mine && (
                                <p
                                    className={cn(
                                        'mt-2 text-sm font-semibold',
                                        mine.active
                                            ? 'text-red-300'
                                            : 'text-emerald-300',
                                    )}
                                >
                                    {mine.active
                                        ? tr('Тривога · {d}', {
                                              d: duration(mine.started_at, now),
                                          })
                                        : tr('Тривоги немає')}
                                </p>
                            )}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-white/75">
                            {prefs.push ? (
                                <Bell className="size-4" />
                            ) : (
                                <BellOff className="size-4" />
                            )}
                            {tr('Сповіщення')}
                            <Toggle
                                checked={prefs.push}
                                onChange={(v) => save({ push: v })}
                                label={tr('Сповіщення про тривогу')}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={toggleSound}
                            aria-pressed={sound}
                            className={cn(
                                'inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm transition',
                                sound
                                    ? 'bg-red-500/15 text-red-100'
                                    : 'bg-white/6 text-white/70 hover:bg-white/10',
                            )}
                            title={tr(
                                'Звук на сторінці, коли в моїй області починається тривога чи з’являється ціль',
                            )}
                        >
                            {sound ? (
                                <Volume2 className="size-4" />
                            ) : (
                                <VolumeX className="size-4" />
                            )}
                            {tr('Звук')}
                        </button>
                        <button
                            type="button"
                            onClick={() => save({ shelter: !prefs.shelter })}
                            className={cn(
                                'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition',
                                prefs.shelter
                                    ? 'bg-emerald-500/20 text-emerald-100'
                                    : 'btn-glow',
                            )}
                        >
                            {prefs.shelter ? (
                                <ShieldCheck className="size-4" />
                            ) : (
                                <Shield className="size-4" />
                            )}
                            {prefs.shelter
                                ? tr('Я вже не в укритті')
                                : tr('Я в укритті')}
                        </button>
                    </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section className="glass rounded-2xl p-3 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Layers
                                className="size-4 text-white/50"
                                aria-label={tr('Шари')}
                            />
                            {LAYERS.map((layer) => {
                                const on = layers.includes(layer);
                                const color =
                                    layer === 'alerts'
                                        ? ALERT_COLOR.air_raid
                                        : THREAT_COLOR[layer];
                                return (
                                    <button
                                        key={layer}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleLayer(layer)}
                                        className={cn(
                                            'inline-flex h-8 items-center gap-1.5 rounded-chip px-3 text-xs font-medium transition',
                                            on
                                                ? 'bg-white/12 text-white'
                                                : 'bg-white/4 text-white/40',
                                        )}
                                    >
                                        <span
                                            className="size-2 rounded-full"
                                            style={{
                                                background: on
                                                    ? color
                                                    : 'rgb(255 255 255 / 0.25)',
                                            }}
                                        />
                                        {layer === 'alerts'
                                            ? tr('Тривоги')
                                            : threatLabel(layer)}
                                    </button>
                                );
                            })}
                        </div>
                        <AlertMap
                            regions={state.regions}
                            units={state.units ?? []}
                            threats={visibleThreats}
                            mine={prefs.region}
                            showAlerts={layers.includes('alerts')}
                            now={now}
                            onSelect={(slug) => save({ region: slug })}
                        />
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/60">
                            {(
                                [
                                    'air_raid',
                                    'artillery',
                                    'urban_fights',
                                    'chemical',
                                    'nuclear',
                                ] as const
                            ).map((key) => (
                                <span
                                    key={key}
                                    className="inline-flex items-center gap-1.5"
                                >
                                    <span
                                        className="size-2.5 rounded-sm"
                                        style={{ background: KIND_COLOR[key] }}
                                    />
                                    {kindLabel(key)}
                                </span>
                            ))}
                            <span className="inline-flex items-center gap-1.5">
                                <span
                                    className="size-2.5 rounded-sm"
                                    style={{
                                        background: `repeating-linear-gradient(-45deg, ${NEARBY_COLOR} 0 1.5px, transparent 1.5px 4px)`,
                                    }}
                                />
                                {tr('Жовтий рівень — тривога в області поруч')}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span
                                    className="size-2.5 rounded-sm"
                                    style={{
                                        background: `repeating-linear-gradient(45deg, ${KIND_COLOR.air_raid} 0 3px, rgb(0 0 0 / 0.5) 3px 5px)`,
                                    }}
                                />
                                {tr('Штрих — тривога понад добу')}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/60">
                            {(
                                [
                                    ['shahed', 'uav', tr('Shahed / Гербера')],
                                    ['jet', 'uav', tr('Реактивний Shahed')],
                                    ['fpv', 'uav', tr('FPV-дрон')],
                                    ['cruise', 'missile', tr('Крилата ракета')],
                                    ['ballistic', 'ballistic', tr('Балістика')],
                                    ['kab', 'kab', tr('КАБ')],
                                    ['mig', 'mig', tr('МіГ-31К')],
                                ] as const
                            ).map(([glyph, type, label]) => (
                                <span
                                    key={glyph}
                                    className="inline-flex items-center gap-1.5"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="size-4"
                                        aria-hidden
                                    >
                                        <path
                                            d={GLYPHS[glyph]}
                                            fill={THREAT_COLOR[type]}
                                        />
                                    </svg>
                                    {label}
                                </span>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-white/40">
                            {tr(
                                'Мапа — агрегатор відкритих джерел, а не офіційна система оповіщення. Мітки приблизні; прозоріша мітка — менше джерел її підтвердили. Рішення про укриття приймайте за офіційним сигналом тривоги.',
                            )}
                        </p>
                    </section>

                    <aside className="space-y-4">
                        <section className="glass rounded-2xl p-4">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                <Siren className="size-4 text-red-400" />
                                {tr('Тривога зараз')}
                            </h2>
                            {active.length === 0 && (
                                <p className="text-sm text-white/45">
                                    {tr('Тривог немає.')}
                                </p>
                            )}
                            <ul className="space-y-1.5">
                                {active.map((r) => (
                                    <li
                                        key={r.slug}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span
                                            className="size-2 shrink-0 rounded-full"
                                            style={{
                                                background:
                                                    ALERT_COLOR[
                                                        r.type ?? 'air_raid'
                                                    ],
                                            }}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-white/85">
                                            {r.name}
                                        </span>
                                        <span className="text-xs text-white/50 tabular-nums">
                                            {duration(r.started_at, now)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="glass rounded-2xl p-4">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                <Radar className="size-4 text-sky-300" />
                                {tr('Цілі в повітрі')}
                            </h2>
                            {state.threats.length === 0 && (
                                <p className="text-sm text-white/45">
                                    {tr('Цілей не зафіксовано.')}
                                </p>
                            )}
                            <ul className="space-y-2">
                                {visibleThreats.slice(0, 12).map((t) => (
                                    <li key={t.id} className="text-sm">
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="rounded-chip px-2 py-0.5 text-[11px] font-semibold text-black"
                                                style={{
                                                    background:
                                                        THREAT_COLOR[t.type],
                                                }}
                                            >
                                                {threatTitle(t)}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-white/80">
                                                {t.place ?? tr('Україна')}
                                            </span>
                                            <span
                                                className="text-xs text-white/45 tabular-nums"
                                                title={t.sources
                                                    .map((c) => '@' + c)
                                                    .join(', ')}
                                            >
                                                {t.confidence}% ·{' '}
                                                {clock(t.detected_at)}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {state.feed.length > 0 && (
                            <section className="glass rounded-2xl p-4">
                                <h2 className="mb-3 text-sm font-semibold text-white">
                                    {tr('Зведення')}
                                </h2>
                                <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
                                    {state.feed.map((item) => (
                                        <li key={item.ref} className="text-sm">
                                            <span className="text-xs text-white/45">
                                                {clock(item.at)}
                                                {item.channel &&
                                                    ` · @${item.channel} · ${sourceGroupLabel(item.group)}`}
                                            </span>
                                            <p className="whitespace-pre-line text-white/80">
                                                {item.text}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section className="glass rounded-2xl p-4">
                            <button
                                type="button"
                                onClick={() => setShowSources((v) => !v)}
                                aria-expanded={showSources}
                                className="flex w-full items-center gap-2 text-left text-sm font-semibold text-white"
                            >
                                <ListTree className="size-4 text-sky-300" />
                                <span className="flex-1">{tr('Джерела')}</span>
                                <span className="text-xs font-normal text-white/45">
                                    {props.sources.reduce(
                                        (n, g) => n + g.channels.length,
                                        0,
                                    )}
                                </span>
                            </button>
                            {showSources && (
                                <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
                                    {props.sources.map((g) => (
                                        <div
                                            key={g.group}
                                            className={cn(
                                                !g.enabled && 'opacity-50',
                                            )}
                                        >
                                            <p className="text-sm font-semibold text-white/90">
                                                {g.title}{' '}
                                                <span className="text-xs font-normal text-white/45">
                                                    {g.channels.length}
                                                    {!g.enabled &&
                                                        ` · ${tr('вимкнено')}`}
                                                </span>
                                            </p>
                                            <p className="mt-0.5 text-xs text-white/50">
                                                {g.about}
                                            </p>
                                            <ul className="mt-2 space-y-1">
                                                {g.channels.map((c) => (
                                                    <li
                                                        key={c.name}
                                                        className="flex items-baseline gap-2 text-xs"
                                                    >
                                                        <a
                                                            href={`https://t.me/${c.name}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sky-300 hover:underline"
                                                        >
                                                            @{c.name}
                                                        </a>
                                                        <span className="min-w-0 truncate text-white/45">
                                                            {c.regions.length
                                                                ? c.regions.join(
                                                                      ' / ',
                                                                  )
                                                                : tr(
                                                                      'Вся Україна',
                                                                  )}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="glass rounded-2xl p-4">
                            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                                <Phone className="size-4 text-emerald-300" />
                                {tr('Інформація для гостей України')}
                            </h2>
                            <ul className="space-y-1 text-sm text-white/75">
                                <li>
                                    {tr(
                                        'Почули сирену чи сповіщення — пройдіть в найближче укриття або метро.',
                                    )}
                                </li>
                                <li>
                                    {tr(
                                        'Тримайтесь подалі від вікон, не знімайте й не публікуйте роботу ППО та місця влучань.',
                                    )}
                                </li>
                                <li>
                                    <b className="text-white">112</b>{' '}
                                    {tr('— єдиний номер екстрених служб')}
                                </li>
                                <li>
                                    <b className="text-white">101</b>{' '}
                                    {tr('— ДСНС (пожежа, порятунок)')}
                                </li>
                                <li>
                                    <b className="text-white">102</b>{' '}
                                    {tr('— поліція')}
                                </li>
                                <li>
                                    <b className="text-white">103</b>{' '}
                                    {tr('— швидка допомога')}
                                </li>
                            </ul>
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}
