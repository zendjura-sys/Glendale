import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate, shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type ServerAnalyticsData = {
    days: { date: string; views: number; clicks: number }[];
    totals: Record<
        | 'views'
        | 'connect'
        | 'discord'
        | 'website'
        | 'telegram'
        | 'votes'
        | 'playing'
        | 'families',
        number
    >;
    previous_views: number;
    sources?: Record<string, number>;
};

const SOURCE_LABELS: Record<string, string> = {
    catalog: tr('Каталог серверів'),
    search: tr('Пошуковики'),
    feed: tr('Стрічка й записи'),
    gamecon: tr('Інші сторінки GameCon'),
    external: tr('Інші сайти'),
    direct: tr('Напряму'),
};

/** Аналітика для власника: перегляди за 30 днів і переходи. */
export function ServerAnalytics({ data }: { data: ServerAnalyticsData }) {
    const peak = Math.max(1, ...data.days.map((d) => d.views));
    const sources = Object.entries(data.sources ?? {})
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1]);
    const sourceTotal = sources.reduce((sum, [, value]) => sum + value, 0);
    const delta =
        data.previous_views > 0
            ? Math.round(
                  ((data.totals.views - data.previous_views) /
                      data.previous_views) *
                      100,
              )
            : null;
    const tiles: [string, number][] = [
        [tr('Перегляди'), data.totals.views],
        [tr('Підключення'), data.totals.connect],
        ['Discord', data.totals.discord],
        [tr('Сайт'), data.totals.website],
        [tr('Голоси'), data.totals.votes],
        [tr('«Граю тут»'), data.totals.playing],
    ];

    return (
        <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <BarChart3 className="size-5 text-gc-lilac-300" />
                    {tr('Аналітика за 30 днів')}
                </h2>
                {delta !== null && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-chip px-2.5 py-1 text-xs font-semibold',
                            delta >= 0
                                ? 'bg-emerald-400/10 text-emerald-200'
                                : 'bg-rose-400/10 text-rose-200',
                        )}
                    >
                        {delta >= 0 ? (
                            <TrendingUp className="size-3.5" />
                        ) : (
                            <TrendingDown className="size-3.5" />
                        )}
                        {delta >= 0 ? '+' : ''}
                        {delta}% {tr('переглядів')}
                    </span>
                )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tiles.map(([label, value]) => (
                    <div
                        key={label}
                        className="min-w-0 rounded-2xl bg-white/[0.04] px-3 py-2.5"
                    >
                        <div className="font-display text-xl font-bold text-white tabular-nums">
                            {shortNumber(value)}
                        </div>
                        <div className="truncate text-xs text-white/45">
                            {label}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-white/45">
                    {tr('Перегляди сторінки по днях')}
                </div>
                <div
                    className="flex h-24 items-end gap-[3px]"
                    role="img"
                    aria-label={tr('Перегляди сторінки по днях')}
                >
                    {data.days.map((day) => (
                        <div
                            key={day.date}
                            title={`${formatDate(day.date, false)}: ${day.views} · ${tr('переходів')}: ${day.clicks}`}
                            className="min-w-0 flex-1 rounded-t-sm bg-gc-indigo/70"
                            style={{
                                height: `${Math.max(4, (day.views / peak) * 100)}%`,
                                opacity: day.views === 0 ? 0.25 : 1,
                            }}
                        />
                    ))}
                </div>
            </div>
            {sourceTotal > 0 && (
                <div className="mt-4">
                    <div className="mb-2 text-xs font-medium text-white/45">
                        {tr('Звідки приходять')}
                    </div>
                    <ul className="space-y-1.5">
                        {sources.map(([key, value]) => (
                            <li
                                key={key}
                                className="flex items-center gap-3 text-sm"
                            >
                                <span className="w-40 shrink-0 break-words text-white/70">
                                    {SOURCE_LABELS[key] ?? key}
                                </span>
                                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                    <span
                                        className="block h-full rounded-full bg-gc-indigo/70"
                                        style={{
                                            width: `${(value / sourceTotal) * 100}%`,
                                        }}
                                    />
                                </span>
                                <span className="w-10 text-right text-xs text-white/55 tabular-nums">
                                    {Math.round((value / sourceTotal) * 100)}%
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <p className="mt-3 text-xs text-white/40">
                {tr(
                    'Бачите лише ви як власник. Один перегляд від людини за годину; свої перегляди не враховуються.',
                )}
            </p>
        </section>
    );
}
