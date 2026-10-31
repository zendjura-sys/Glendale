import { Link, router } from '@inertiajs/react';
import { Check, PartyPopper, X } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type NewcomerData = {
    day: number;
    days: number;
    done: number;
    total: number;
    steps: { key: string; done: boolean; href: string }[];
};

const LABELS: Record<string, () => string> = {
    avatar: () => tr('Поставте аватар'),
    about: () => tr('Напишіть статус чи пару слів про себе'),
    games: () => tr('Додайте свої ігри'),
    friend: () => tr('Знайдіть першого друга'),
    community: () => tr('Вступіть у спільноту'),
    post: () => tr('Опублікуйте перший запис'),
    party: () => tr('Зберіть або знайдіть паті'),
};

/** «Тиждень новачка» в стрічці: кроки з позначками, прогрес і «День N з 7». */
export function NewcomerWeek({ data }: { data: NewcomerData }) {
    const complete = data.done === data.total;
    const hide = () =>
        router.post('/newcomer/hide', {}, { preserveScroll: true });

    return (
        <section className="glass mb-4 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                        {complete && (
                            <PartyPopper className="size-5 text-amber-300" />
                        )}
                        {complete
                            ? tr('Тиждень новачка пройдено!')
                            : tr('Тиждень новачка')}
                    </h2>
                    <p className="mt-0.5 text-sm text-white/50">
                        {complete
                            ? tr('Ви вже свій на GameCon. Гарних ігор!')
                            : tr(
                                  'День {day} з {days} · виконано {done} з {total}',
                                  {
                                      day: data.day,
                                      days: data.days,
                                      done: data.done,
                                      total: data.total,
                                  },
                              )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={hide}
                    aria-label={tr('Сховати')}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                >
                    <X className="size-4" />
                </button>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${(data.done / data.total) * 100}%` }}
                />
            </div>
            {!complete && (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {data.steps.map((step) => (
                        <li key={step.key}>
                            <Link
                                href={step.href}
                                className={cn(
                                    'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition',
                                    step.done
                                        ? 'text-white/40'
                                        : 'text-white/85 hover:bg-white/[0.05]',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-5 shrink-0 items-center justify-center rounded-full',
                                        step.done
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-white/[0.06]',
                                    )}
                                >
                                    {step.done && (
                                        <Check className="size-3.5" />
                                    )}
                                </span>
                                <span
                                    className={cn(step.done && 'line-through')}
                                >
                                    {LABELS[step.key]?.() ?? step.key}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
