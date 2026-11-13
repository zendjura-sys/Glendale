import { Head, router } from '@inertiajs/react';
import {
    BellRing,
    MapPin,
    RotateCw,
    Siren,
    UsersRound,
    Webhook,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Stamp = { at: string; reason: string | null } | null;

type Props = {
    enabled: boolean;
    health: {
        tick_at: string | null;
        tick_fresh: boolean;
        index: number | null;
        webhook_url: string;
        webhook_ok: Stamp;
        webhook_rejected: Stamp;
        regions: number;
    };
    now: {
        id: string;
        name: string;
        type_label: string | null;
        path: string | null;
        alerts: {
            type: string;
            name: string;
            since: string | null;
            level: 'red' | 'yellow' | null;
            accent: string;
        }[];
    }[];
    now_total: number;
    by_type: { type: string; name: string; count: number; accent: string }[];
    subscribers: {
        total: number;
        push: number;
        places: number;
        top: { id: string; name: string; path: string | null; count: number }[];
    };
    sent: { day: number; week: number; ended_day: number };
    recent: {
        kind: string;
        text: string;
        region: string | null;
        accent: string | null;
        at: string;
        users: number;
    }[];
};

const REASONS: Record<string, string> = {
    missing: 'немає підпису',
    stale: 'застарілий підпис',
    replay: 'повтор',
    bad_alg: 'невідомий алгоритм',
    invalid: 'підпис не збігся',
};

/** Адмінка → Тривоги: здоров’я опитувача й вебхука UkraineAlarm, що триває зараз, підписники й розсилки. */
export default function Alerts({
    enabled,
    health,
    now,
    now_total,
    by_type,
    subscribers,
    sent,
    recent,
}: Props) {
    const post = (url: string, data: Record<string, string> = {}) =>
        router.post(url, data, { preserveScroll: true });

    return (
        <>
            <Head title={tr('Тривоги — Адмін-панель')} />
            <PageHeader
                title={tr('Тривоги')}
                description={tr(
                    'Опитувач UkraineAlarm кожні 10 с і вебхук: що триває зараз, хто підписаний і скільки сповіщень розіслано.',
                )}
                actions={
                    <button
                        type="button"
                        disabled={!enabled}
                        onClick={() => post('/admin/alerts/check')}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
                    >
                        <RotateCw className="size-4" />
                        {tr('Перевірити зараз')}
                    </button>
                }
            />

            {!enabled && (
                <div className="gc-solid mb-5 rounded-2xl p-4 text-sm text-amber-200">
                    {tr(
                        'Ключ UkraineAlarm не задано — додайте його в «Інтеграціях».',
                    )}
                </div>
            )}

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    label={tr('Місць з тривогою')}
                    value={now_total}
                    icon={Siren}
                />
                <StatCard
                    label={tr('Підписані')}
                    value={subscribers.total}
                    hint={tr('пуші ввімкнено: {n}', { n: subscribers.push })}
                    icon={UsersRound}
                    delay={60}
                />
                <StatCard
                    label={tr('Сповіщень за добу')}
                    value={sent.day}
                    hint={tr('відбоїв: {n} · за тиждень: {w}', {
                        n: sent.ended_day,
                        w: sent.week,
                    })}
                    icon={BellRing}
                    delay={120}
                />
                <StatCard
                    label={tr('Додаткових місць')}
                    value={subscribers.places}
                    icon={MapPin}
                    delay={180}
                />
            </div>

            <div className="mb-5 grid gap-4 lg:grid-cols-2">
                <section className="gc-solid rounded-2xl p-4">
                    <h2 className="mb-3 font-display text-lg font-bold text-white">
                        {tr('Стан')}
                    </h2>
                    <dl className="space-y-2 text-sm">
                        <Row
                            label={tr('Опитувач')}
                            ok={health.tick_fresh}
                            value={
                                health.tick_at
                                    ? tr('остання перевірка {t}', {
                                          t: timeAgo(health.tick_at),
                                      })
                                    : tr('ще не запускався')
                            }
                        />
                        <Row
                            label="lastActionIndex"
                            value={health.index ?? '—'}
                        />
                        <Row
                            label={tr('Дерево місць')}
                            ok={health.regions > 0}
                            value={tr('{n} місць', { n: health.regions })}
                        />
                        <Row
                            label={tr('Вебхук')}
                            ok={health.webhook_ok !== null}
                            value={
                                health.webhook_ok
                                    ? tr('останній {t}', {
                                          t: timeAgo(health.webhook_ok.at),
                                      })
                                    : tr('ще не приходив')
                            }
                        />
                        {health.webhook_rejected && (
                            <Row
                                label={tr('Відхилено')}
                                ok={false}
                                value={`${timeAgo(health.webhook_rejected.at)} · ${tr(REASONS[health.webhook_rejected.reason ?? ''] ?? health.webhook_rejected.reason ?? '')}`}
                            />
                        )}
                    </dl>
                    <p className="mt-3 truncate font-mono text-xs text-white/45">
                        {health.webhook_url}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {(
                            [
                                ['register', 'Зареєструвати вебхук'],
                                ['update', 'Оновити адресу'],
                                ['delete', 'Вимкнути вебхук'],
                            ] as const
                        ).map(([action, label]) => (
                            <button
                                key={action}
                                type="button"
                                disabled={!enabled}
                                onClick={() => {
                                    if (
                                        action !== 'delete' ||
                                        confirm(
                                            tr(
                                                'Вимкнути вебхук? Лишиться тільки опитування кожні 10 с.',
                                            ),
                                        )
                                    )
                                        post('/admin/alerts/webhook', {
                                            action,
                                        });
                                }}
                                className={cn(
                                    'gc-solid-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                                    action === 'delete'
                                        ? 'text-rose-300 hover:text-rose-200'
                                        : 'text-white/70 hover:text-white',
                                )}
                            >
                                <Webhook className="size-3.5" />
                                {tr(label)}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="gc-solid rounded-2xl p-4">
                    <h2 className="mb-3 font-display text-lg font-bold text-white">
                        {tr('Де стежать найбільше')}
                    </h2>
                    {subscribers.top.length === 0 ? (
                        <p className="text-sm text-white/50">
                            {tr('Ще ніхто не обрав місце.')}
                        </p>
                    ) : (
                        <ul className="space-y-1.5 text-sm">
                            {subscribers.top.map((place) => (
                                <li
                                    key={place.id}
                                    className="flex items-center gap-3"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-white">
                                            {place.name}
                                        </span>
                                        {place.path && (
                                            <span className="block truncate text-xs text-white/40">
                                                {place.path}
                                            </span>
                                        )}
                                    </span>
                                    <span className="font-semibold text-white/80 tabular-nums">
                                        {place.count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="mb-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="mr-2 font-display text-lg font-bold text-white">
                        {tr('Триває зараз')}
                    </h2>
                    {by_type.map((t) => (
                        <span
                            key={t.type}
                            className="gc-solid-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white/75"
                        >
                            <span
                                className="size-2 rounded-full"
                                style={{ background: t.accent }}
                            />
                            {tr(t.name)} · {t.count}
                        </span>
                    ))}
                </div>
                {now.length === 0 ? (
                    <EmptyState
                        icon={Siren}
                        title={tr('Тривог немає')}
                        text={tr('Зараз по всій Україні тихо.')}
                    />
                ) : (
                    <ul className="gc-solid divide-y divide-white/[0.06] rounded-2xl">
                        {now.map((place) => (
                            <li
                                key={place.id}
                                className="flex flex-wrap items-center gap-3 p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-white">
                                        {place.name}
                                        {place.type_label && (
                                            <span className="ml-2 text-xs font-medium text-white/40">
                                                {tr(place.type_label)}
                                            </span>
                                        )}
                                    </p>
                                    {place.path && (
                                        <p className="truncate text-xs text-white/40">
                                            {place.path}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {place.alerts.map((a) => (
                                        <span
                                            key={a.type}
                                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                                            style={{
                                                background: `${a.accent}26`,
                                                boxShadow: `inset 0 0 0 1px ${a.accent}55`,
                                            }}
                                        >
                                            <span
                                                className="size-2 rounded-full"
                                                style={{
                                                    background: a.accent,
                                                }}
                                            />
                                            {tr(a.name)}
                                            {a.level === 'yellow' &&
                                                ` · ${tr('жовтий')}`}
                                            {a.since && (
                                                <span className="text-white/50">
                                                    {timeAgo(a.since)}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h2 className="mb-3 font-display text-lg font-bold text-white">
                    {tr('Останні розсилки')}
                </h2>
                {recent.length === 0 ? (
                    <EmptyState
                        icon={BellRing}
                        title={tr('За дві доби розсилок не було')}
                    />
                ) : (
                    <ul className="gc-solid divide-y divide-white/[0.06] rounded-2xl">
                        {recent.map((r, i) => (
                            <li key={i} className="flex items-center gap-3 p-3">
                                <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{
                                        background:
                                            r.kind === 'air_alert_end'
                                                ? '#10B981'
                                                : (r.accent ?? '#EF4444'),
                                    }}
                                />
                                <p className="min-w-0 flex-1 truncate text-sm text-white">
                                    {r.text}
                                </p>
                                <span className="shrink-0 text-xs text-white/50">
                                    {tr('{n} отримувачів', { n: r.users })} ·{' '}
                                    {timeAgo(r.at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

function Row({
    label,
    value,
    ok,
}: {
    label: string;
    value: string | number;
    ok?: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            <dt className="w-36 shrink-0 text-white/50">{label}</dt>
            <dd className="flex min-w-0 items-center gap-2 text-white">
                {ok !== undefined && (
                    <span
                        className={cn(
                            'size-2 shrink-0 rounded-full',
                            ok ? 'bg-emerald-400' : 'bg-rose-400',
                        )}
                    />
                )}
                <span className="truncate">{value}</span>
            </dd>
        </div>
    );
}
