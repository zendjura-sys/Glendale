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
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import {
    AlertMap,
    regionColors,
    THREAT_COLOR,
    GLYPHS,
    threatLabel,
    threatTitle,
} from '@/components/alerts/alert-map';
import { AlertBadge } from '@/components/alerts/alert-badge';
import { AlertPlacePicker } from '@/components/alerts/alert-place';
import { Toggle } from '@/components/gc/admin';
import {
    AIR_RAID_SCALE_COLORS,
    ALERT_TYPE_ORDER,
    ALERT_TYPES,
} from '@/lib/alerts-config';
import type { AlertScaleCode, AlertTypeCode } from '@/lib/alerts-config';
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
    AlertPrefsPatch,
    AlertSourceGroup,
    AlertState,
} from '@/components/alerts/alert-utils';

function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

const GLYPH_LEGEND = [
    ['shahed', 'uav', () => tr('Shahed / Гербера')],
    ['jet', 'uav', () => tr('Реактивний Shahed')],
    ['fpv', 'uav', () => tr('FPV-дрон')],
    ['cruise', 'missile', () => tr('Крилата ракета')],
    ['banderol', 'uav', () => tr('Бандероль')],
    ['unknown', 'uav', () => tr('Ціль не визначена')],
    ['ballistic', 'ballistic', () => tr('Балістика')],
    ['kab', 'kab', () => tr('КАБ')],
    ['mig', 'mig', () => tr('МіГ-31К')],
    ['artillery', 'artillery', () => tr('Артилерія')],
] as const;

/** Компактна легенда: лише типи, масштаби й значки, які зараз є на мапі. */
function legendOf(state: AlertState, now: number) {
    const types = new Set<AlertTypeCode>();
    const scales = new Set<AlertScaleCode>();
    let long = false;
    const isLong = (at: string | null) =>
        at !== null && now - new Date(at).getTime() > 24 * 3600_000;
    for (const r of state.regions) {
        for (const code of r.alerts ?? (r.alert ? [r.alert] : [])) {
            types.add(code);
        }
        if (r.alert === 'AIR' && r.scale) scales.add(r.scale);
        for (const code of r.threat_levels ?? []) types.add(code);
        if (r.active && isLong(r.started_at)) long = true;
    }
    for (const u of state.units ?? []) {
        if (u.type) types.add(u.type);
        if (u.type === 'AIR' && u.scale) scales.add(u.scale);
        if (isLong(u.started_at)) long = true;
    }
    types.delete('CLEAR');
    types.delete('NO_DATA');
    const used = new Set(
        state.threats.map((t) =>
            t.variant === 'gerbera'
                ? 'shahed'
                : (t.variant ??
                  (
                      {
                          uav: 'shahed',
                          missile: 'cruise',
                          ballistic: 'ballistic',
                          kab: 'kab',
                          mig: 'mig',
                          artillery: 'artillery',
                      } as const
                  )[t.type]),
        ),
    );

    return {
        types: ALERT_TYPE_ORDER.filter((c) => types.has(c)).concat(
            types.size === 0 ? ['CLEAR'] : [],
        ),
        scales: (Object.keys(AIR_RAID_SCALE_COLORS) as AlertScaleCode[]).filter(
            (s) => scales.has(s) && scales.size > 1,
        ),
        long,
        glyphs: GLYPH_LEGEND.filter(([g]) => used.has(g)).map(
            ([g, type, label]) => [g, type, label()] as const,
        ),
    };
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
    const [legendOpen, setLegendOpen] = useState(false);
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
                .then((d) => {
                    setState(d);
                    // Статус обраного місця теж оновлюється.
                    setPrefs(d.prefs);
                })
                .catch(() => undefined);
        }, 15_000);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, []);

    const save = (patch: AlertPrefsPatch) =>
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
    // Для списку «Тривога зараз»: офіційні тривоги й рівні загроз з цілей, важливіші — вище.
    const alerting = state.regions
        .filter(
            (r) =>
                r.active ||
                (r.alert !== undefined &&
                    r.alert !== 'CLEAR' &&
                    r.alert !== 'NO_DATA'),
        )
        .sort(
            (a, b) =>
                ALERT_TYPES[b.alert ?? 'AIR'].priority -
                ALERT_TYPES[a.alert ?? 'AIR'].priority,
        );
    const mine = state.regions.find((r) => r.slug === prefs.region) ?? null;
    const legend = legendOf(state, now);

    return (
        <>
            <Head title={tr('Мапа тривог')} />
            <div className="space-y-4">
                <header className="gc-solid rounded-2xl p-5">
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
                                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                                        <Radar className="size-3.5" />
                                        {tr('Зліт МіГ-31К')}
                                    </span>
                                )}
                                {state.ballistic_threat && (
                                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
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
                        'gc-solid rounded-2xl p-5',
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
                                            ? 'text-red-400'
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
                                label={tr('Отримувати сповіщення про тривоги')}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={toggleSound}
                            aria-pressed={sound}
                            className={cn(
                                'inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm transition',
                                sound
                                    ? 'bg-red-500/15 text-red-400'
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
                    <AlertPlacePicker prefs={prefs} onSave={save} />
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section className="gc-solid rounded-2xl p-3 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Layers
                                className="size-4 text-white/50"
                                aria-label={tr('Шари')}
                            />
                            {LAYERS.map((layer) => {
                                const on = layers.includes(layer);
                                const color =
                                    layer === 'alerts'
                                        ? ALERT_TYPES.AIR.hex
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
                        {/* Легенда — лише те, що зараз є на мапі; на телефоні згорнута. */}
                        <button
                            type="button"
                            onClick={() => setLegendOpen((v) => !v)}
                            aria-expanded={legendOpen}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-white/70 sm:hidden"
                        >
                            <ListTree className="size-3.5" />
                            {tr('Легенда')}
                        </button>
                        <div className={cn(!legendOpen && 'hidden sm:block')}>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {legend.types.map((code) => (
                                    <AlertBadge key={code} type={code} full />
                                ))}
                            </div>
                            {(legend.scales.length > 0 || legend.long) && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/60">
                                    {legend.scales.map((scale) => (
                                        <span
                                            key={scale}
                                            className="inline-flex items-center gap-1.5"
                                        >
                                            <span
                                                className="size-2.5 rounded-sm"
                                                style={{
                                                    background:
                                                        AIR_RAID_SCALE_COLORS[
                                                            scale
                                                        ].fill,
                                                    borderColor:
                                                        AIR_RAID_SCALE_COLORS[
                                                            scale
                                                        ].border,
                                                }}
                                            />
                                            {AIR_RAID_SCALE_COLORS[
                                                scale
                                            ].label()}
                                        </span>
                                    ))}
                                    {legend.long && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                className="size-2.5 rounded-sm"
                                                style={{
                                                    background: `repeating-linear-gradient(45deg, ${ALERT_TYPES.AIR.hex} 0 3px, rgb(0 0 0 / 0.5) 3px 5px)`,
                                                }}
                                            />
                                            {tr('Штрих — тривога понад добу')}
                                        </span>
                                    )}
                                </div>
                            )}
                            {legend.glyphs.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/60">
                                    {legend.glyphs.map(
                                        ([glyph, type, label]) => (
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
                                                        fillRule={
                                                            glyph === 'unknown'
                                                                ? 'evenodd'
                                                                : undefined
                                                        }
                                                        fill={
                                                            THREAT_COLOR[type]
                                                        }
                                                    />
                                                </svg>
                                                {label}
                                            </span>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                        {state.attribution && (
                            <p className="mt-3 text-xs">
                                <a
                                    href={state.attribution.url}
                                    target="_blank"
                                    rel="noopener"
                                    className="text-sky-400 hover:underline"
                                >
                                    {state.attribution.text}
                                </a>
                            </p>
                        )}
                        <p className="mt-3 text-xs text-white/40">
                            {tr(
                                'Мапа — агрегатор відкритих джерел, а не офіційна система оповіщення. Мітки приблизні; прозоріша мітка — менше джерел її підтвердили. Рішення про укриття приймайте за офіційним сигналом тривоги.',
                            )}
                        </p>
                    </section>

                    <aside className="space-y-4">
                        <section className="gc-solid rounded-2xl p-4">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                <Siren className="size-4 text-red-400" />
                                {tr('Тривога зараз')}
                            </h2>
                            {alerting.length === 0 && (
                                <p className="text-sm text-white/45">
                                    {tr('Тривог немає.')}
                                </p>
                            )}
                            <ul className="space-y-1.5">
                                {alerting.map((r) => (
                                    <li
                                        key={r.slug}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        {/* Головна тривога (найвищий пріоритет), решта — вторинні бейджі. */}
                                        <AlertBadge
                                            type={r.alert ?? 'AIR'}
                                            scale={r.scale}
                                        />
                                        <span
                                            className="gc-alert-text min-w-0 flex-1 truncate"
                                            style={
                                                {
                                                    '--a-text':
                                                        regionColors(r).text,
                                                    '--a-hex':
                                                        regionColors(r).hex,
                                                } as CSSProperties
                                            }
                                        >
                                            {r.name}
                                        </span>
                                        {(r.alerts ?? [])
                                            .slice(1)
                                            .map((code) => (
                                                <AlertBadge
                                                    key={code}
                                                    type={code}
                                                    scale={r.scale}
                                                    iconOnly
                                                />
                                            ))}
                                        <span className="text-xs text-white/50 tabular-nums">
                                            {duration(r.started_at, now)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="gc-solid rounded-2xl p-4">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                <Radar className="size-4 text-sky-400" />
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
                            <section className="gc-solid rounded-2xl p-4">
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

                        <section className="gc-solid rounded-2xl p-4">
                            <button
                                type="button"
                                onClick={() => setShowSources((v) => !v)}
                                aria-expanded={showSources}
                                className="flex w-full items-center gap-2 text-left text-sm font-semibold text-white"
                            >
                                <ListTree className="size-4 text-sky-400" />
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
                                                            className="text-sky-400 hover:underline"
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

                        <section className="gc-solid rounded-2xl p-4">
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
