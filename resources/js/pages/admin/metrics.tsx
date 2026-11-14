import { Head } from '@inertiajs/react';
import {
    Activity,
    CalendarDays,
    Smartphone,
    UserPlus,
    Users,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Report = {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
    app_share: number;
    signups_week: number;
    daily: {
        day: string;
        total: number;
        web: number;
        app: number;
        signups: number;
    }[];
    retention: { week: string; size: number; weeks: (number | null)[] }[];
    sections: { key: string; label: string; users: number; share: number }[];
};

/** Відтінок клітинки утримання: чим більша частка, тим насиченіший індиго. */
function cell(v: number | null): string {
    if (v === null) return 'text-white/20';
    if (v >= 40) return 'bg-primary/70 text-white';
    if (v >= 25) return 'bg-primary/45 text-white';
    if (v >= 10) return 'bg-primary/25 text-white/90';

    return 'bg-primary/10 text-white/70';
}

/** Адмінка → Метрики: активність (DAU/WAU/MAU), реєстрації, утримання когорт і топ розділів. */
export default function Metrics({ report }: { report: Report }) {
    const max = Math.max(1, ...report.daily.map((d) => d.total));
    const maxSignups = Math.max(1, ...report.daily.map((d) => d.signups));

    return (
        <>
            <Head title={tr('Метрики — Адмін-панель')} />
            <PageHeader
                title={tr('Метрики')}
                description={tr(
                    'Унікальні активні люди за день, тиждень і місяць (сайт і застосунок), утримання за тижнями реєстрації й найпопулярніші розділи. Оновлюється раз на 10 хвилин.',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={tr('DAU — сьогодні')}
                    value={report.dau}
                    icon={Activity}
                />
                <StatCard
                    label={tr('WAU — 7 днів')}
                    value={report.wau}
                    icon={CalendarDays}
                    delay={60}
                />
                <StatCard
                    label={tr('MAU — 30 днів')}
                    value={report.mau}
                    icon={Users}
                    delay={120}
                />
                <StatCard
                    label={tr('Реєстрацій за тиждень')}
                    value={report.signups_week}
                    icon={UserPlus}
                    delay={180}
                />
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div className="gc-solid rounded-2xl p-4">
                    <p className="text-sm text-white/55">
                        {tr('Липкість (DAU / MAU)')}
                    </p>
                    <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
                        {report.stickiness}%
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                        {tr(
                            'Яка частка місячної аудиторії заходить щодня. 20% і більше — добре для соцмережі.',
                        )}
                    </p>
                </div>
                <div className="gc-solid rounded-2xl p-4">
                    <p className="flex items-center gap-2 text-sm text-white/55">
                        <Smartphone className="size-4" />
                        {tr('Заходили із застосунку (частка MAU)')}
                    </p>
                    <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
                        {report.app_share}%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${report.app_share}%` }}
                        />
                    </div>
                </div>
            </div>

            <section className="gc-solid mb-5 rounded-2xl p-4">
                <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
                    <h2 className="mr-auto font-semibold text-white">
                        {tr('Активні за 30 днів')}
                    </h2>
                    <span className="flex items-center gap-1.5 text-white/55">
                        <span className="size-2.5 rounded-sm bg-primary" />
                        {tr('Сайт')}
                    </span>
                    <span className="flex items-center gap-1.5 text-white/55">
                        <span className="size-2.5 rounded-sm bg-sky-400" />
                        {tr('Застосунок')}
                    </span>
                    <span className="flex items-center gap-1.5 text-white/55">
                        <span className="size-2.5 rounded-full bg-emerald-400" />
                        {tr('Реєстрації')}
                    </span>
                </div>
                <div className="flex h-44 items-end gap-1">
                    {report.daily.map((d) => (
                        <div
                            key={d.day}
                            className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                            title={`${formatDate(d.day)}: ${d.total} · ${tr('сайт')} ${d.web} · ${tr('застосунок')} ${d.app} · ${tr('реєстрацій')} ${d.signups}`}
                        >
                            <div
                                className="flex w-full flex-col justify-end overflow-hidden rounded-t-[4px]"
                                style={{ height: `${(d.total / max) * 100}%` }}
                            >
                                <div
                                    className="w-full bg-sky-400"
                                    style={{ flex: d.app }}
                                />
                                <div
                                    className="w-full bg-primary"
                                    style={{
                                        flex: Math.max(d.web, d.total - d.app),
                                    }}
                                />
                            </div>
                            {d.signups > 0 && (
                                <span
                                    className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-emerald-400"
                                    style={{
                                        bottom: `${(d.signups / maxSignups) * 100}%`,
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-white/40 tabular-nums">
                    <span>{formatDate(report.daily[0]?.day ?? '')}</span>
                    <span>{tr('сьогодні')}</span>
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                <section className="gc-solid overflow-x-auto rounded-2xl p-4">
                    <h2 className="mb-1 font-semibold text-white">
                        {tr('Утримання за тижнями реєстрації')}
                    </h2>
                    <p className="mb-3 text-xs text-white/45">
                        {tr(
                            'Яка частка тих, хто зареєструвався того тижня, повернулась через 1…7 тижнів.',
                        )}
                    </p>
                    <table className="w-full min-w-[520px] text-sm">
                        <thead>
                            <tr className="text-xs text-white/45">
                                <th className="pb-2 text-left font-medium">
                                    {tr('Тиждень')}
                                </th>
                                <th className="pb-2 text-right font-medium">
                                    {tr('Людей')}
                                </th>
                                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                    <th
                                        key={n}
                                        className="pb-2 text-center font-medium"
                                    >
                                        {tr('Т{n}', { n })}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {report.retention.map((row) => (
                                <tr key={row.week}>
                                    <td className="py-1 pr-2 text-white/75">
                                        {formatDate(row.week)}
                                    </td>
                                    <td className="py-1 pr-2 text-right text-white/60 tabular-nums">
                                        {row.size}
                                    </td>
                                    {row.weeks.map((v, i) => (
                                        <td key={i} className="p-0.5">
                                            <span
                                                className={cn(
                                                    'block rounded-md py-1.5 text-center text-xs font-semibold tabular-nums',
                                                    cell(v),
                                                )}
                                            >
                                                {v === null ? '·' : `${v}%`}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="gc-solid rounded-2xl p-4">
                    <h2 className="mb-1 font-semibold text-white">
                        {tr('Топ розділів за 7 днів')}
                    </h2>
                    <p className="mb-3 text-xs text-white/45">
                        {tr('Унікальні люди на сайті, що відкривали розділ.')}
                    </p>
                    {report.sections.length === 0 ? (
                        <p className="text-sm text-white/50">
                            {tr(
                                'Даних ще немає — з’являться після перших відвідин.',
                            )}
                        </p>
                    ) : (
                        <ul className="space-y-2.5">
                            {report.sections.map((s) => (
                                <li key={s.key}>
                                    <div className="flex items-baseline justify-between text-sm">
                                        <span className="text-white/85">
                                            {tr(s.label)}
                                        </span>
                                        <span className="text-white/50 tabular-nums">
                                            {s.users} · {s.share}%
                                        </span>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{ width: `${s.share}%` }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
