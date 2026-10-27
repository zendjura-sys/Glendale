import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { SettingsCard } from '@/layouts/settings/layout';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

export type CommunityExtras = {
    rules: string;
    handbook: string;
    welcome: string;
    banned_words: string;
    post_tags: string;
    join_questions?: string;
    slow_mode: number;
    premoderation: boolean;
    weekly_digest?: boolean;
};

export type CommunityStats = {
    joined: number;
    authors: number;
    posts: number;
    comments: number;
    active_share: number;
    weeks: { week: string; joined: number; posts: number }[];
};

const field =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

function slowLabel(seconds: number): string {
    if (seconds === 0) return tr('Вимкнено');
    if (seconds < 3600) return tr('{count} хв', { count: seconds / 60 });
    if (seconds < 86400) return tr('{count} год', { count: seconds / 3600 });

    return tr('1 доба');
}

/** Правила, довідник, привітання, заборонені слова, мітки, повільний режим і премодерація. */
export function RulesForm({
    slug,
    extras,
    slowModes,
}: {
    slug: string;
    extras: CommunityExtras;
    slowModes: number[];
}) {
    const form = useForm(extras);
    const joinForms = usePlugin('join_forms');
    const { data, setData, errors } = form;
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.patch(`/c/${slug}/settings/rules`, { preserveScroll: true });
    };
    const area = (
        name:
            | 'rules'
            | 'handbook'
            | 'welcome'
            | 'banned_words'
            | 'post_tags'
            | 'join_questions',
        label: string,
        hint: string,
        rows: number,
        max: number,
    ) => (
        <label className="block text-sm font-medium text-white/80">
            {label}
            <span className="mt-0.5 block text-xs font-normal text-white/45">
                {hint}
            </span>
            <textarea
                value={data[name] ?? ''}
                onChange={(event) => setData(name, event.target.value)}
                rows={rows}
                maxLength={max}
                className={cn(field, 'mt-1.5 resize-y')}
            />
            {errors[name] && (
                <p className="mt-1 text-xs text-rose-300">{errors[name]}</p>
            )}
        </label>
    );

    return (
        <form onSubmit={submit}>
            <SettingsCard
                title={tr('Правила і модерація')}
                description={tr(
                    'Сторінки для учасників і те, як стіна приймає записи',
                )}
            >
                <div className="grid grid-cols-1 gap-4">
                    {area(
                        'rules',
                        tr('Правила'),
                        tr(
                            'Окрема сторінка «Правила». Заголовки розділів — рядки, що починаються з «#».',
                        ),
                        5,
                        10000,
                    )}
                    {area(
                        'handbook',
                        tr('Довідник'),
                        tr(
                            'Корисне для новачків: гайди, посилання, відповіді на часті питання.',
                        ),
                        6,
                        50000,
                    )}
                    {area(
                        'welcome',
                        tr('Привітання нового учасника'),
                        tr('Приходить сповіщенням, щойно людина вступає.'),
                        3,
                        1000,
                    )}
                    {joinForms &&
                        area(
                            'join_questions',
                            tr('Анкета вступу'),
                            tr(
                                'Для закритої спільноти: до 5 питань, по одному в рядку. Відповіді — у заявці.',
                            ),
                            3,
                            1500,
                        )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        {area(
                            'banned_words',
                            tr('Заборонені слова'),
                            tr(
                                'По одному в рядку. Запис чи коментар із ними не пройде.',
                            ),
                            4,
                            5000,
                        )}
                        {area(
                            'post_tags',
                            tr('Мітки записів'),
                            tr(
                                'По одній у рядку, до 12. Учасники обирають мітку до запису.',
                            ),
                            4,
                            1000,
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-white/80">
                            {tr('Повільний режим')}
                            <span className="mt-0.5 block text-xs font-normal text-white/45">
                                {tr(
                                    'Як часто учасник може публікувати на стіні.',
                                )}
                            </span>
                            <select
                                value={data.slow_mode}
                                onChange={(event) =>
                                    setData(
                                        'slow_mode',
                                        Number(event.target.value),
                                    )
                                }
                                className={cn(field, 'mt-1.5 h-11 py-0')}
                            >
                                {slowModes.map((seconds) => (
                                    <option key={seconds} value={seconds}>
                                        {slowLabel(seconds)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-start gap-3 rounded-2xl border border-white/[0.07] p-3.5 text-sm text-white/80">
                            <input
                                type="checkbox"
                                checked={data.premoderation}
                                onChange={(event) =>
                                    setData(
                                        'premoderation',
                                        event.target.checked,
                                    )
                                }
                                className="mt-0.5 size-4 accent-gc-indigo"
                            />
                            <span>
                                <span className="block font-medium text-white">
                                    {tr('Черга постів на перевірку')}
                                </span>
                                <span className="block text-xs text-white/45">
                                    {tr(
                                        'Записи учасників з’являються після схвалення редактором.',
                                    )}
                                </span>
                            </span>
                        </label>
                        <label className="flex items-start gap-3 rounded-2xl border border-white/[0.07] p-3.5 text-sm text-white/80">
                            <input
                                type="checkbox"
                                checked={data.weekly_digest ?? false}
                                onChange={(event) =>
                                    setData(
                                        'weekly_digest',
                                        event.target.checked,
                                    )
                                }
                                className="mt-0.5 size-4 accent-gc-indigo"
                            />
                            <span>
                                <span className="block font-medium text-white">
                                    {tr('Тижневий дайджест')}
                                </span>
                                <span className="block text-xs text-white/45">
                                    {tr(
                                        'Щопонеділка — запис від спільноти з п’ятьма найкращими записами тижня.',
                                    )}
                                </span>
                            </span>
                        </label>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={form.processing || !form.isDirty}
                            className="btn-glow rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Зберегти правила')}
                        </button>
                    </div>
                </div>
            </SettingsCard>
        </form>
    );
}

/** Для адмінів: скільки людей прийшло і скільки пише. */
export function StatsCard({ stats }: { stats?: CommunityStats }) {
    const peak = Math.max(1, ...(stats?.weeks.map((w) => w.joined) ?? [1]));
    const tiles = stats
        ? [
              { label: tr('Прийшло'), value: stats.joined },
              { label: tr('Пишуть'), value: stats.authors },
              { label: tr('Записів'), value: stats.posts },
              { label: tr('Коментарів'), value: stats.comments },
          ]
        : [];

    return (
        <SettingsCard
            title={tr('Статистика')}
            description={tr('За останні 30 днів')}
        >
            {!stats ? (
                <div className="skeleton h-40 rounded-2xl" />
            ) : (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {tiles.map((tile) => (
                            <div
                                key={tile.label}
                                className="rounded-2xl bg-white/[0.04] p-3"
                            >
                                <p className="font-display text-2xl font-bold text-white tabular-nums">
                                    {tile.value}
                                </p>
                                <p className="text-xs text-white/50">
                                    {tile.label}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-white/60">
                        {tr('Пишуть {percent}% учасників', {
                            percent: stats.active_share,
                        })}
                    </p>
                    <div>
                        <p className="mb-2 text-xs font-medium text-white/45">
                            {tr('Нові учасники по тижнях')}
                        </p>
                        <div className="flex h-28 items-end gap-2">
                            {stats.weeks.map((week) => (
                                <div
                                    key={week.week}
                                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                                    title={tr(
                                        'Тиждень з {date}: {joined} нових, {posts} записів',
                                        {
                                            date: formatDate(week.week),
                                            joined: week.joined,
                                            posts: week.posts,
                                        },
                                    )}
                                >
                                    <span className="text-[11px] text-white/50 tabular-nums">
                                        {week.joined}
                                    </span>
                                    <div
                                        className="w-full rounded-t-md bg-gc-indigo/70"
                                        style={{
                                            height: `${Math.max(4, (week.joined / peak) * 80)}%`,
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </SettingsCard>
    );
}
