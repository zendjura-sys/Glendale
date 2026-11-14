import { Head, router } from '@inertiajs/react';
import {
    Gauge,
    MonitorSmartphone,
    MousePointerClick,
    Timer,
} from 'lucide-react';
import { PageHeader } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Metric = 'LCP' | 'INP' | 'CLS' | 'TTFB';
type Summary = {
    p75: number | null;
    count: number;
    rating: 'good' | 'needs' | 'poor' | null;
    good: number;
};
type PageRow = { page: string; samples: number } & Record<Metric, Summary>;

type Props = {
    days: 1 | 7 | 30;
    device: 'mobile' | 'tablet' | 'desktop' | null;
    report: {
        overall: Record<Metric, Summary>;
        pages: PageRow[];
        daily: { day: string; LCP: number | null; INP: number | null }[];
        thresholds: Record<Metric, [number, number]>;
    };
};

const METRICS: {
    key: Metric;
    label: string;
    hint: string;
    icon: typeof Gauge;
}[] = [
    { key: 'LCP', label: 'LCP', hint: 'Головний вміст з’явився', icon: Timer },
    {
        key: 'INP',
        label: 'INP',
        hint: 'Відгук на натискання',
        icon: MousePointerClick,
    },
    {
        key: 'CLS',
        label: 'CLS',
        hint: 'Стрибки макета',
        icon: MonitorSmartphone,
    },
    { key: 'TTFB', label: 'TTFB', hint: 'Відповідь сервера', icon: Gauge },
];

const TONE = {
    good: 'text-emerald-400',
    needs: 'text-amber-300',
    poor: 'text-rose-400',
} as const;

const BAR = {
    good: 'bg-emerald-400',
    needs: 'bg-amber-300',
    poor: 'bg-rose-400',
} as const;

function show(metric: Metric, v: number | null): string {
    if (v === null) return '—';
    if (metric === 'CLS') return v.toFixed(2);

    return v >= 1000
        ? `${(v / 1000).toFixed(2)} ${tr('с')}`
        : `${Math.round(v)} ${tr('мс')}`;
}

function rate(
    metric: Metric,
    v: number | null,
    t: Props['report']['thresholds'],
) {
    if (v === null) return null;

    return v <= t[metric][0] ? 'good' : v <= t[metric][1] ? 'needs' : 'poor';
}

/** Адмінка → Швидкість: p75 LCP / INP / CLS / TTFB з реальних відвідувань, за сторінками й днями. */
export default function Vitals({ days, device, report }: Props) {
    const visit = (next: Partial<{ days: number; device: string | null }>) =>
        router.get(
            '/admin/vitals',
            { days, device, ...next },
            { preserveScroll: true, preserveState: true },
        );
    const maxLcp = Math.max(
        1,
        ...report.daily.map((d) => d.LCP ?? 0),
        report.thresholds.LCP[1],
    );

    return (
        <>
            <Head title={tr('Швидкість — Адмін-панель')} />
            <PageHeader
                title={tr('Швидкість сторінок')}
                description={tr(
                    'Заміри з браузерів реальних людей (кожен четвертий візит). Показуємо 75-й перцентиль — як Google у Core Web Vitals.',
                )}
            />

            <div className="gc-solid mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                    {([1, 7, 30] as const).map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => visit({ days: d })}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-medium transition',
                                days === d
                                    ? 'bg-sky-500 text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {d === 1 ? tr('Доба') : tr('{n} днів', { n: d })}
                        </button>
                    ))}
                </div>
                <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                    {(
                        [
                            [null, 'Усі пристрої'],
                            ['mobile', 'Телефони'],
                            ['tablet', 'Планшети'],
                            ['desktop', 'ПК'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key ?? 'all'}
                            type="button"
                            onClick={() => visit({ device: key })}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-medium transition',
                                device === key
                                    ? 'bg-sky-500 text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {tr(label)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {METRICS.map((m) => {
                    const s = report.overall[m.key];

                    return (
                        <div key={m.key} className="gc-solid rounded-2xl p-4">
                            <p className="flex items-center gap-2 text-sm text-white/55">
                                <m.icon className="size-4" />
                                <span className="font-semibold text-white">
                                    {m.label}
                                </span>
                                <span className="truncate">{tr(m.hint)}</span>
                            </p>
                            <p
                                className={cn(
                                    'mt-2 font-display text-3xl font-bold tabular-nums',
                                    s.rating ? TONE[s.rating] : 'text-white/40',
                                )}
                            >
                                {show(m.key, s.p75)}
                            </p>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                    className="h-full rounded-full bg-emerald-400"
                                    style={{ width: `${s.good}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-white/45">
                                {tr('{p}% добрих · {n} замірів', {
                                    p: s.good,
                                    n: s.count,
                                })}
                            </p>
                        </div>
                    );
                })}
            </div>

            {report.daily.length > 1 && (
                <section className="gc-solid mb-5 rounded-2xl p-4">
                    <h2 className="mb-3 text-sm font-semibold text-white">
                        {tr('LCP по днях (p75)')}
                    </h2>
                    <div className="flex h-32 items-end gap-1.5">
                        {report.daily.map((d) => {
                            const r = rate('LCP', d.LCP, report.thresholds);

                            return (
                                <div
                                    key={d.day}
                                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                                    title={`${d.day}: ${show('LCP', d.LCP)}`}
                                >
                                    <div
                                        className={cn(
                                            'w-full max-w-8 rounded-t-md',
                                            r ? BAR[r] : 'bg-white/10',
                                        )}
                                        style={{
                                            height: `${Math.max(4, ((d.LCP ?? 0) / maxLcp) * 100)}%`,
                                        }}
                                    />
                                    <span className="text-[10px] text-white/40 tabular-nums">
                                        {d.day.slice(8)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {report.pages.length === 0 ? (
                <EmptyState
                    icon={Gauge}
                    title={tr('Замірів ще немає')}
                    text={tr('Вони з’являться, щойно люди відкриють сайт.')}
                />
            ) : (
                <div className="gc-solid overflow-x-auto rounded-2xl">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead>
                            <tr className="text-left text-xs text-white/45">
                                <th className="px-4 py-3 font-medium">
                                    {tr('Сторінка')}
                                </th>
                                {METRICS.map((m) => (
                                    <th
                                        key={m.key}
                                        className="px-3 py-3 text-right font-medium"
                                    >
                                        {m.label}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right font-medium">
                                    {tr('Заміри')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                            {report.pages.map((row) => (
                                <tr key={row.page}>
                                    <td className="px-4 py-2.5 font-mono text-[13px] text-white/85">
                                        {row.page}
                                    </td>
                                    {METRICS.map((m) => (
                                        <td
                                            key={m.key}
                                            className={cn(
                                                'px-3 py-2.5 text-right font-semibold tabular-nums',
                                                row[m.key].rating
                                                    ? TONE[row[m.key].rating!]
                                                    : 'text-white/30',
                                            )}
                                        >
                                            {show(m.key, row[m.key].p75)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-2.5 text-right text-white/45 tabular-nums">
                                        {row.samples}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
