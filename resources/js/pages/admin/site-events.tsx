import { Head, router } from '@inertiajs/react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, selectClass } from '@/components/gc/admin';
import { RewardIcon } from '@/components/season/level-track';
import type { Reward } from '@/components/season/level-track';
import { metricNoun } from '@/components/season/site-event-theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';

type RawReward = { type: Reward['type']; value: string };

type Row = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    theme: string;
    starts_at: string;
    ends_at: string;
    tasks: { metric: string; target: number }[];
    goal_metric: string | null;
    goal_target: number | null;
    reward: RawReward[];
    active: boolean;
    claimers: number;
};

type Props = {
    events: Row[];
    metrics: string[];
    themes: string[];
    catalog: Partial<Record<Reward['type'], Reward[]>>;
};

type Draft = Omit<Row, 'id' | 'active' | 'claimers'> & { id?: number };

const themeLabel = (t: string): string =>
    ({
        none: tr('Без прикрас'),
        newyear: tr('Новий рік'),
        valentine: tr('День закоханих'),
        easter: tr('Великдень'),
        independence: tr('День Незалежності'),
        halloween: tr('Хелловін'),
    })[t] ?? t;

function blank(): Draft {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 86_400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 16);

    return {
        slug: '',
        title: '',
        description: '',
        theme: 'none',
        starts_at: fmt(now),
        ends_at: fmt(end),
        tasks: [{ metric: 'posts', target: 3 }],
        goal_metric: null,
        goal_target: null,
        reward: [],
    };
}

export default function AdminSiteEvents({
    events,
    metrics,
    themes,
    catalog,
}: Props) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const all = Object.values(catalog).flat();
    const find = (r: RawReward) =>
        all.find((c) => c.type === r.type && c.value === r.value);

    const save = (e: FormEvent) => {
        e.preventDefault();
        if (!draft) return;
        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                setDraft(null);
                setErrors({});
            },
            onError: (errs: Record<string, string>) => setErrors(errs),
        };
        if (draft.id) {
            router.put(`/admin/site-events/${draft.id}`, draft, opts);
        } else {
            router.post('/admin/site-events', draft, opts);
        }
    };

    const remove = (row: Row) => {
        if (!window.confirm(tr('Видалити подію «{t}»?', { t: row.title })))
            return;
        router.delete(`/admin/site-events/${row.id}`, { preserveScroll: true });
    };

    const set = (patch: Partial<Draft>) =>
        setDraft((d) => (d ? { ...d, ...patch } : d));

    return (
        <>
            <Head title={tr('Сезонні події')} />
            <PageHeader
                title={tr('Сезонні події')}
                description={tr(
                    'Завдання на час події, спільна мета й косметика в нагороду. Прогрес рахується з реальної активності.',
                )}
                actions={
                    <Button onClick={() => setDraft(blank())}>
                        <Plus className="size-4" />
                        {tr('Нова подія')}
                    </Button>
                }
            />

            {draft && (
                <form
                    onSubmit={save}
                    className="gc-solid mb-5 space-y-4 rounded-xl p-4"
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm text-white/70">
                            {tr('Назва')}
                            <Input
                                value={draft.title}
                                onChange={(e) => set({ title: e.target.value })}
                                maxLength={80}
                            />
                            {errors.title && (
                                <span className="text-xs text-red-400">
                                    {errors.title}
                                </span>
                            )}
                        </label>
                        <label className="space-y-1 text-sm text-white/70">
                            {tr('Адреса (латиницею, необов’язково)')}
                            <Input
                                value={draft.slug}
                                onChange={(e) => set({ slug: e.target.value })}
                                maxLength={60}
                            />
                        </label>
                        <label className="space-y-1 text-sm text-white/70 sm:col-span-2">
                            {tr('Опис')}
                            <Input
                                value={draft.description ?? ''}
                                onChange={(e) =>
                                    set({ description: e.target.value })
                                }
                                maxLength={500}
                            />
                        </label>
                        <label className="space-y-1 text-sm text-white/70">
                            {tr('Початок')}
                            <Input
                                type="datetime-local"
                                value={draft.starts_at}
                                onChange={(e) =>
                                    set({ starts_at: e.target.value })
                                }
                            />
                        </label>
                        <label className="space-y-1 text-sm text-white/70">
                            {tr('Кінець')}
                            <Input
                                type="datetime-local"
                                value={draft.ends_at}
                                onChange={(e) =>
                                    set({ ends_at: e.target.value })
                                }
                            />
                            {errors.ends_at && (
                                <span className="text-xs text-red-400">
                                    {errors.ends_at}
                                </span>
                            )}
                        </label>
                        <label className="space-y-1 text-sm text-white/70">
                            {tr('Оформлення')}
                            <select
                                className={`${selectClass} w-full`}
                                value={draft.theme}
                                onChange={(e) => set({ theme: e.target.value })}
                            >
                                {themes.map((t) => (
                                    <option key={t} value={t}>
                                        {themeLabel(t)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="space-y-1 text-sm text-white/70">
                            {tr('Спільна мета (необов’язково)')}
                            <div className="flex gap-2">
                                <select
                                    className={`${selectClass} flex-1`}
                                    value={draft.goal_metric ?? ''}
                                    onChange={(e) =>
                                        set({
                                            goal_metric: e.target.value || null,
                                        })
                                    }
                                >
                                    <option value="">{tr('Без мети')}</option>
                                    {metrics.map((m) => (
                                        <option key={m} value={m}>
                                            {metricNoun(m)}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    type="number"
                                    min={1}
                                    className="w-28"
                                    disabled={!draft.goal_metric}
                                    value={draft.goal_target ?? ''}
                                    onChange={(e) =>
                                        set({
                                            goal_target:
                                                Number(e.target.value) || null,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-white">
                            {tr('Завдання')}
                        </div>
                        {draft.tasks.map((t, i) => (
                            <div key={i} className="flex gap-2">
                                <select
                                    className={`${selectClass} flex-1`}
                                    value={t.metric}
                                    onChange={(e) =>
                                        set({
                                            tasks: draft.tasks.map((x, j) =>
                                                j === i
                                                    ? {
                                                          ...x,
                                                          metric: e.target
                                                              .value,
                                                      }
                                                    : x,
                                            ),
                                        })
                                    }
                                >
                                    {metrics.map((m) => (
                                        <option key={m} value={m}>
                                            {metricNoun(m)}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    className="w-24"
                                    value={t.target}
                                    onChange={(e) =>
                                        set({
                                            tasks: draft.tasks.map((x, j) =>
                                                j === i
                                                    ? {
                                                          ...x,
                                                          target:
                                                              Number(
                                                                  e.target
                                                                      .value,
                                                              ) || 1,
                                                      }
                                                    : x,
                                            ),
                                        })
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={tr('Прибрати')}
                                    disabled={draft.tasks.length < 2}
                                    onClick={() =>
                                        set({
                                            tasks: draft.tasks.filter(
                                                (_, j) => j !== i,
                                            ),
                                        })
                                    }
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                        ))}
                        {draft.tasks.length < 5 && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                    set({
                                        tasks: [
                                            ...draft.tasks,
                                            { metric: 'comments', target: 5 },
                                        ],
                                    })
                                }
                            >
                                <Plus className="size-4" />
                                {tr('Завдання')}
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-white">
                            {tr('Нагорода (до 3)')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {all.map((c) => {
                                const on = draft.reward.some(
                                    (r) =>
                                        r.type === c.type &&
                                        r.value === c.value,
                                );

                                return (
                                    <button
                                        key={`${c.type}:${c.value}`}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            set({
                                                reward: on
                                                    ? draft.reward.filter(
                                                          (r) =>
                                                              !(
                                                                  r.type ===
                                                                      c.type &&
                                                                  r.value ===
                                                                      c.value
                                                              ),
                                                      )
                                                    : [
                                                          ...draft.reward,
                                                          {
                                                              type: c.type,
                                                              value: c.value,
                                                          },
                                                      ].slice(-3),
                                            })
                                        }
                                        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs ${on ? 'bg-primary/20 text-white ring-1 ring-primary' : 'bg-white/5 text-white/70'}`}
                                    >
                                        <RewardIcon
                                            reward={c}
                                            className="size-7"
                                        />
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                        {errors.reward && (
                            <span className="text-xs text-red-400">
                                {errors.reward}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit">
                            <Save className="size-4" />
                            {tr('Зберегти')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setDraft(null)}
                        >
                            {tr('Скасувати')}
                        </Button>
                    </div>
                </form>
            )}

            {events.length === 0 ? (
                <p className="text-sm text-white/55">
                    {tr('Подій ще не було.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {events.map((row) => (
                        <li
                            key={row.id}
                            className="gc-solid flex flex-wrap items-center gap-3 rounded-xl p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate font-semibold text-white">
                                        {row.title}
                                    </span>
                                    {row.active && (
                                        <Pill tone="green">
                                            {tr('Іде зараз')}
                                        </Pill>
                                    )}
                                </div>
                                <div className="text-xs text-white/50">
                                    {row.starts_at.replace('T', ' ')} —{' '}
                                    {row.ends_at.replace('T', ' ')} ·{' '}
                                    {tr('забрали: {n}', { n: row.claimers })}
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {row.reward.map((r) => {
                                    const c = find(r);

                                    return c ? (
                                        <RewardIcon
                                            key={`${r.type}:${r.value}`}
                                            reward={c}
                                            className="size-8"
                                        />
                                    ) : null;
                                })}
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                    setDraft({
                                        ...row,
                                        description: row.description ?? '',
                                    })
                                }
                            >
                                {tr('Змінити')}
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label={tr('Видалити')}
                                onClick={() => remove(row)}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
