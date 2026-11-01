import { Head, router } from '@inertiajs/react';
import { PageHeader } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Step = { key: string; label: string; count: number };

/** Воронка реєстрації: скільки нових акаунтів проходить кожен крок. */
export default function AdminFunnel({
    days,
    steps,
}: {
    days: number;
    steps: Step[];
}) {
    const top = Math.max(1, steps[0]?.count ?? 1);

    return (
        <>
            <Head title={tr('Воронка реєстрації — Адмін-панель')} />
            <PageHeader
                title={tr('Воронка реєстрації')}
                description={tr(
                    'Нові акаунти за період і де люди зупиняються.',
                )}
                actions={[7, 30, 90].map((d) => (
                    <button
                        key={d}
                        type="button"
                        onClick={() =>
                            router.get(
                                '/admin/funnel',
                                { days: d },
                                { preserveScroll: true },
                            )
                        }
                        className={cn(
                            'h-9 rounded-xl px-3 text-sm',
                            days === d
                                ? 'bg-primary text-white'
                                : 'bg-white/[0.06] text-white/70 hover:text-white',
                        )}
                    >
                        {tr('{d} днів', { d })}
                    </button>
                ))}
            />
            <section className="glass space-y-3 rounded-2xl p-5">
                {steps.map((step, i) => {
                    const share = Math.round((step.count / top) * 100);
                    const prev = i > 0 ? steps[i - 1].count : null;
                    const drop = prev
                        ? Math.round(
                              100 - (step.count / Math.max(1, prev)) * 100,
                          )
                        : null;

                    return (
                        <div key={step.key}>
                            <div className="mb-1 flex items-baseline gap-3 text-sm">
                                <span className="flex-1 text-white/85">
                                    {tr(step.label)}
                                </span>
                                <span className="font-semibold text-white tabular-nums">
                                    {step.count}
                                </span>
                                <span className="w-12 text-right text-xs text-white/45 tabular-nums">
                                    {share}%
                                </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                    className="h-full rounded-full bg-sky-400"
                                    style={{ width: `${share}%` }}
                                />
                            </div>
                            {drop !== null && drop > 0 && (
                                <p className="mt-1 text-xs text-white/40">
                                    {tr('−{drop}% від попереднього кроку', {
                                        drop,
                                    })}
                                </p>
                            )}
                        </div>
                    );
                })}
            </section>
        </>
    );
}
