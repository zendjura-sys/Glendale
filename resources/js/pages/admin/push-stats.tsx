import { Head } from '@inertiajs/react';
import { BellRing, CircleX, Smartphone, Unplug } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';

type Counts = { sent: number; failed: number; gone: number; expired: number };

type Props = {
    days: { day: string; app: Counts; web: Counts }[];
    kinds: Record<string, number>;
    totals: Counts;
    devices: { app: number; app_active: number; web: number };
    fcm: boolean;
};

/** Адмінка → Доставка пушів: стовпчики за днями (застосунок і браузери), помилки й види сповіщень. */
export default function PushStats({
    days,
    kinds,
    totals,
    devices,
    fcm,
}: Props) {
    const max = Math.max(
        1,
        ...days.map(
            (d) => d.app.sent + d.web.sent + d.app.failed + d.web.failed,
        ),
    );
    const rate =
        totals.sent + totals.failed > 0
            ? Math.round((totals.sent / (totals.sent + totals.failed)) * 100)
            : 100;

    return (
        <>
            <Head title={tr('Доставка пушів — Адмін-панель')} />
            <PageHeader
                title={tr('Доставка пушів')}
                description={tr(
                    'Скільки сповіщень дійшло в застосунок (FCM) і браузери за 14 днів, скільки впало і скільки пристроїв більше не існує.',
                )}
            />
            {!fcm && (
                <p className="gc-solid mb-4 rounded-2xl p-4 text-sm text-amber-200">
                    {tr(
                        'Firebase не налаштовано — пуші в застосунок не надсилаються (Інтеграції → Firebase).',
                    )}
                </p>
            )}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    label={tr('Доставлено')}
                    value={totals.sent}
                    hint={tr('{n}% успішних', { n: rate })}
                    icon={BellRing}
                />
                <StatCard
                    label={tr('Помилки')}
                    value={totals.failed}
                    hint={tr('прострочених тривог: {n}', {
                        n: totals.expired,
                    })}
                    icon={CircleX}
                    delay={60}
                />
                <StatCard
                    label={tr('Видалені пристрої')}
                    value={totals.gone}
                    hint={tr('токен більше не діє')}
                    icon={Unplug}
                    delay={120}
                />
                <StatCard
                    label={tr('Пристрої')}
                    value={devices.app}
                    hint={tr('активних 30 днів: {a} · браузерів: {w}', {
                        a: devices.app_active,
                        w: devices.web,
                    })}
                    icon={Smartphone}
                    delay={180}
                />
            </div>

            <section className="gc-solid mb-5 rounded-2xl p-4">
                <h2 className="mb-3 font-display text-lg font-bold text-white">
                    {tr('За днями')}
                </h2>
                <div className="flex h-44 items-end gap-1.5">
                    {days.map((d) => {
                        const app = d.app.sent;
                        const web = d.web.sent;
                        const failed = d.app.failed + d.web.failed;
                        return (
                            <div
                                key={d.day}
                                className="flex flex-1 flex-col items-center gap-1"
                                title={`${d.day}: ${tr('застосунок')} ${app}, ${tr('браузери')} ${web}, ${tr('помилки')} ${failed}`}
                            >
                                <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-md">
                                    <span
                                        className="block bg-rose-400/70"
                                        style={{
                                            height: `${(failed / max) * 100}%`,
                                        }}
                                    />
                                    <span
                                        className="block bg-sky-300/70"
                                        style={{
                                            height: `${(web / max) * 100}%`,
                                        }}
                                    />
                                    <span
                                        className="block bg-primary"
                                        style={{
                                            height: `${(app / max) * 100}%`,
                                        }}
                                    />
                                </div>
                                <span className="text-[10px] text-white/40">
                                    {d.day.slice(8)}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/60">
                    <Legend className="bg-primary" label={tr('Застосунок')} />
                    <Legend className="bg-sky-300/70" label={tr('Браузери')} />
                    <Legend className="bg-rose-400/70" label={tr('Помилки')} />
                </div>
            </section>

            <section className="gc-solid rounded-2xl p-4">
                <h2 className="mb-3 font-display text-lg font-bold text-white">
                    {tr('Які сповіщення')}
                </h2>
                {Object.keys(kinds).length === 0 ? (
                    <p className="text-sm text-white/50">
                        {tr('Ще немає даних.')}
                    </p>
                ) : (
                    <ul className="grid gap-1.5 text-sm">
                        {Object.entries(kinds).map(([kind, n]) => (
                            <li key={kind} className="flex items-center gap-3">
                                <code className="w-40 shrink-0 truncate font-mono text-xs text-white/60">
                                    {kind}
                                </code>
                                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                    <span
                                        className="block h-full rounded-full bg-primary"
                                        style={{
                                            width: `${(n / Math.max(...Object.values(kinds))) * 100}%`,
                                        }}
                                    />
                                </span>
                                <span className="w-12 text-right text-white/75 tabular-nums">
                                    {n}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

function Legend({ className, label }: { className: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${className}`} />
            {label}
        </span>
    );
}
