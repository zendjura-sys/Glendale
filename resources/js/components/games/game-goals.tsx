import { Check, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RowSkeleton } from '@/components/gc/skeletons';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Goal = {
    id: number;
    title: string;
    target: number | null;
    progress: number;
    done: boolean;
};

/** «Мої цілі» в грі: ціль з числом (прогрес) або просто галочка. */
export function GameGoals({ slug }: { slug: string }) {
    const [goals, setGoals] = useState<Goal[] | null>(null);
    const [title, setTitle] = useState('');
    const [target, setTarget] = useState('');
    const base = `/games/${slug}/goals`;

    useEffect(() => {
        void api<{ goals: Goal[] }>('GET', base)
            .then((d) => setGoals(d.goals))
            .catch(() => setGoals([]));
    }, [base]);

    const run = (
        method: 'POST' | 'PATCH' | 'DELETE',
        url: string,
        data?: Record<string, unknown>,
    ) =>
        void api<{ goals: Goal[] }>(method, url, data)
            .then((d) => setGoals(d.goals))
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError ? e.message : tr('Не вдалося.'),
                ),
            );

    if (goals === null) return <RowSkeleton />;

    return (
        <div className="space-y-2">
            {goals.map((g) => (
                <div
                    key={g.id}
                    className={cn(
                        'flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5',
                        g.done && 'opacity-60',
                    )}
                >
                    <button
                        type="button"
                        onClick={() =>
                            run('PATCH', `${base}/${g.id}`, { done: !g.done })
                        }
                        aria-label={g.done ? tr('Повернути') : tr('Виконано')}
                        className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-lg transition',
                            g.done
                                ? 'bg-emerald-500/80 text-white'
                                : 'bg-white/[0.08] text-white/50 hover:text-white',
                        )}
                    >
                        <Check className="size-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p
                            className={cn(
                                'truncate text-sm text-white',
                                g.done && 'line-through',
                            )}
                        >
                            {g.title}
                        </p>
                        {g.target !== null && (
                            <div className="mt-1 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full rounded-full bg-gc-indigo"
                                        style={{
                                            width: `${Math.min(100, (g.progress / g.target) * 100)}%`,
                                        }}
                                    />
                                </div>
                                <input
                                    type="number"
                                    defaultValue={g.progress}
                                    min={0}
                                    max={g.target}
                                    onBlur={(e) =>
                                        Number(e.target.value) !== g.progress &&
                                        run('PATCH', `${base}/${g.id}`, {
                                            progress: Number(e.target.value),
                                        })
                                    }
                                    aria-label={tr('Прогрес')}
                                    className="input-glass h-7 w-16 rounded-lg px-1.5 text-center text-xs text-white"
                                />
                                <span className="text-xs text-white/45 tabular-nums">
                                    / {g.target}
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => run('DELETE', `${base}/${g.id}`)}
                        aria-label={tr('Видалити')}
                        className="text-white/30 hover:text-rose-300"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </div>
            ))}
            {goals.length === 0 && (
                <p className="text-sm text-white/50">
                    {tr(
                        'Поставте собі ціль: ранг, кількість перемог, пройти на максимальній складності.',
                    )}
                </p>
            )}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    run('POST', base, {
                        title,
                        target: target ? Number(target) : null,
                    });
                    setTitle('');
                    setTarget('');
                }}
                className="flex gap-2"
            >
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={tr('Нова ціль')}
                    maxLength={120}
                    className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30"
                />
                <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={tr('Скільки')}
                    min={1}
                    className="input-glass h-10 w-20 rounded-xl px-2 text-sm text-white placeholder:text-white/30"
                />
                <button
                    type="submit"
                    disabled={title.trim().length < 3}
                    aria-label={tr('Додати ціль')}
                    className="btn-glow flex size-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
                >
                    <Plus className="size-4" />
                </button>
            </form>
        </div>
    );
}
