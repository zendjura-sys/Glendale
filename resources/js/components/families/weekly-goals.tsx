import { useForm } from '@inertiajs/react';
import { Check, Plus, Target, Trash2 } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { Empty, Panel, btnGhost, btnPrimary } from '@/components/families/ui';
import { inputClass } from '@/components/servers/server-form';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type WeeklyGoal = {
    id: string;
    type: string;
    label?: string;
    target: number;
    reward: string | null;
    progress?: number;
    done?: boolean;
};

/** Огляд сім’ї: завдання тижня зі смугами прогресу (рахуються самі зі звітів, балів і подій). */
export function WeeklyGoalsCard({
    goals,
    settingsHref,
}: {
    goals: WeeklyGoal[];
    settingsHref: string | null;
}) {
    const reduce = useReducedMotion();

    return (
        <Panel
            title={tr('Завдання тижня')}
            icon={Target}
            actions={
                settingsHref && (
                    <a
                        href={`${settingsHref}#goals`}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-400"
                    >
                        {tr('Змінити')}
                    </a>
                )
            }
        >
            {goals.length === 0 ? (
                <Empty
                    icon={Target}
                    text={tr('Лідер ще не поставив завдань на тиждень')}
                />
            ) : (
                <ul className="space-y-3" data-weekly-goals>
                    {goals.map((goal) => {
                        const pct = Math.min(
                            100,
                            Math.round(
                                ((goal.progress ?? 0) / goal.target) * 100,
                            ),
                        );

                        return (
                            <li key={goal.id} className="space-y-1.5">
                                <div className="flex items-baseline gap-2 text-sm">
                                    <span className="min-w-0 flex-1 text-white/85">
                                        {goal.label}
                                    </span>
                                    <span
                                        className={cn(
                                            'font-semibold tabular-nums',
                                            goal.done
                                                ? 'text-emerald-300'
                                                : 'text-white/60',
                                        )}
                                    >
                                        {goal.done && (
                                            <Check className="mr-1 inline size-3.5" />
                                        )}
                                        {goal.progress ?? 0} / {goal.target}
                                    </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                                    <m.div
                                        initial={reduce ? false : { width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.6 }}
                                        className={cn(
                                            'h-full rounded-full',
                                            goal.done
                                                ? 'bg-emerald-400'
                                                : 'bg-primary',
                                        )}
                                    />
                                </div>
                                {goal.reward && (
                                    <p className="text-xs text-white/45">
                                        {tr('Нагорода: {reward}', {
                                            reward: goal.reward,
                                        })}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/** Налаштування → тижневі завдання: тип, ціль і нагорода (до трьох). */
export function WeeklyGoalsSettings({
    action,
    initial,
}: {
    action: string;
    initial: {
        list: WeeklyGoal[];
        types: Record<string, string>;
        max: number;
    };
}) {
    const form = useForm<{ goals: WeeklyGoal[] }>({ goals: initial.list });
    const types = Object.entries(initial.types);
    const set = (i: number, patch: Partial<WeeklyGoal>) =>
        form.setData(
            'goals',
            form.data.goals.map((g, n) => (n === i ? { ...g, ...patch } : g)),
        );

    return (
        <Panel title={tr('Тижневі завдання')} icon={Target}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.put(action, { preserveScroll: true });
                }}
                className="space-y-3"
            >
                <p className="text-xs text-white/50">
                    {tr(
                        'До трьох цілей на тиждень. Прогрес рахується сам — зі схвалених звітів, балів рейтингу й проведених подій; нагороду ви виплачуєте через казну.',
                    )}
                </p>
                {form.data.goals.map((goal, i) => (
                    <div
                        key={goal.id || i}
                        className="gc-solid-2 grid gap-2 rounded-xl p-3 sm:grid-cols-[1fr_7rem_1fr_auto]"
                    >
                        <select
                            value={goal.type}
                            onChange={(e) => set(i, { type: e.target.value })}
                            className={inputClass}
                            aria-label={tr('Що рахувати')}
                        >
                            {types.map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min={1}
                            value={goal.target}
                            onChange={(e) =>
                                set(i, { target: Number(e.target.value) })
                            }
                            className={inputClass}
                            aria-label={tr('Ціль')}
                        />
                        <input
                            value={goal.reward ?? ''}
                            onChange={(e) => set(i, { reward: e.target.value })}
                            placeholder={tr(
                                'Нагорода, напр. «премія 50 000 ₴»',
                            )}
                            className={inputClass}
                            aria-label={tr('Нагорода')}
                            maxLength={120}
                        />
                        <button
                            type="button"
                            onClick={() =>
                                form.setData(
                                    'goals',
                                    form.data.goals.filter((_, n) => n !== i),
                                )
                            }
                            aria-label={tr('Прибрати')}
                            className={btnGhost}
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
                <div className="flex flex-wrap gap-2">
                    {form.data.goals.length < initial.max && (
                        <button
                            type="button"
                            onClick={() =>
                                form.setData('goals', [
                                    ...form.data.goals,
                                    {
                                        id: '',
                                        type: types[0]?.[0] ?? 'reports',
                                        target: 10,
                                        reward: null,
                                    },
                                ])
                            }
                            className={btnGhost}
                        >
                            <Plus className="size-4" /> {tr('Додати ціль')}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={form.processing}
                        className={cn(btnPrimary, 'ml-auto')}
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            </form>
        </Panel>
    );
}
