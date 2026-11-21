import { router } from '@inertiajs/react';
import { Check, ExternalLink, Sparkles } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { Panel } from '@/components/families/ui';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type OnboardingCardData = {
    steps: { id: string; title: string; url: string | null; done: boolean }[];
};

/** Огляд сім’ї → «Старт новачка»: кроки від лідера з відмітками й прогресом. */
export function OnboardingCard({
    base,
    data,
}: {
    base: string;
    data: OnboardingCardData;
}) {
    const reduce = useReducedMotion();
    const done = data.steps.filter((s) => s.done).length;
    const pct = Math.round((done / data.steps.length) * 100);

    return (
        <Panel
            title={tr('Старт новачка')}
            icon={Sparkles}
            tone="text-emerald-400"
            actions={
                <span className="text-xs font-semibold text-white/55 tabular-nums">
                    {done}/{data.steps.length}
                </span>
            }
        >
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <m.div
                    className="h-full rounded-full bg-emerald-500"
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={reduce ? { duration: 0 } : { duration: 0.35 }}
                />
            </div>
            <ul className="space-y-1.5">
                {data.steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={s.done}
                            onClick={() =>
                                router.post(
                                    `${base}/onboarding/${s.id}`,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                            className={cn(
                                'flex min-h-10 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left text-sm',
                                s.done
                                    ? 'text-white/45 line-through'
                                    : 'text-white hover:bg-white/[0.05]',
                            )}
                        >
                            <span
                                className={cn(
                                    'grid size-5 shrink-0 place-items-center rounded-md',
                                    s.done
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-white/[0.08]',
                                )}
                            >
                                {s.done && <Check className="size-3.5" />}
                            </span>
                            {s.title}
                        </button>
                        {s.url && (
                            <a
                                href={s.url}
                                target={
                                    s.url.startsWith('/') ? undefined : '_blank'
                                }
                                rel="noreferrer"
                                className="grid size-9 shrink-0 place-items-center rounded-lg text-sky-400 hover:bg-white/[0.06]"
                                aria-label={tr('Відкрити: {title}', {
                                    title: s.title,
                                })}
                            >
                                <ExternalLink className="size-4" />
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
