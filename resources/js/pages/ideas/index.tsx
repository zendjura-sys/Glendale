import { Head, InfiniteScroll, Link, router, useForm } from '@inertiajs/react';
import { ChevronUp, Lightbulb, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ListSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ScrollData, UserCard } from '@/types';

type Status = 'new' | 'planned' | 'progress' | 'done' | 'declined';

type IdeaItem = {
    id: number;
    title: string;
    body: string | null;
    status: Status;
    answer: string | null;
    votes: number;
    voted: boolean;
    author: UserCard | null;
    created_at: string;
};

const STATUS: Record<Status, { label: () => string; tone: string }> = {
    new: { label: () => tr('Нова'), tone: 'bg-white/[0.07] text-white/60' },
    planned: {
        label: () => tr('У планах'),
        tone: 'bg-sky-500/15 text-sky-200',
    },
    progress: {
        label: () => tr('Робимо'),
        tone: 'bg-amber-500/15 text-amber-200',
    },
    done: {
        label: () => tr('Зроблено'),
        tone: 'bg-emerald-500/15 text-emerald-200',
    },
    declined: {
        label: () => tr('Не цього разу'),
        tone: 'bg-rose-500/15 text-rose-200',
    },
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Дошка ідей: пропонуйте, голосуйте; команда відповідає статусом. */
export default function IdeasIndex({
    ideas,
    sort,
    status,
    canManage,
}: {
    ideas: ScrollData<IdeaItem>;
    sort: 'top' | 'new';
    status: Status | null;
    canManage: boolean;
}) {
    const [adding, setAdding] = useState(false);
    const form = useForm({ title: '', body: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/ideas', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setAdding(false);
            },
        });
    };
    const filter = (next: { sort?: string; status?: string | null }) =>
        router.get(
            '/ideas',
            {
                sort: next.sort ?? sort,
                status: next.status === undefined ? status : next.status,
            },
            { preserveScroll: true, preserveState: true },
        );

    return (
        <>
            <Head title={tr('Дошка ідей')} />
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                            <Lightbulb className="size-6 text-gc-lilac-300" />
                            {tr('Дошка ідей')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Що додати в GameCon? Найпопулярніше беремо в роботу.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAdding(!adding)}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <Plus className="size-4" />
                        {tr('Запропонувати')}
                    </button>
                </div>

                {adding && (
                    <form
                        onSubmit={submit}
                        className="glass mt-4 space-y-3 rounded-2xl p-4"
                    >
                        <input
                            autoFocus
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Коротко: що зробити')}
                            maxLength={120}
                            className={cn(field, 'h-11')}
                        />
                        <textarea
                            value={form.data.body}
                            onChange={(e) =>
                                form.setData('body', e.target.value)
                            }
                            placeholder={tr(
                                'Навіщо це й як має працювати (необовʼязково)',
                            )}
                            rows={3}
                            maxLength={2000}
                            className={cn(field, 'resize-y py-2.5')}
                        />
                        {form.errors.title && (
                            <p className="text-xs text-rose-300">
                                {form.errors.title}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    form.data.title.trim().length < 5
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Додати')}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                    {(['top', 'new'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => filter({ sort: value })}
                            className={cn(
                                'h-8 rounded-chip px-3 text-[13px] font-medium transition',
                                sort === value
                                    ? 'bg-white/12 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            {value === 'top' ? tr('Популярні') : tr('Нові')}
                        </button>
                    ))}
                    <span className="mx-1 w-px bg-white/10" />
                    {(
                        [
                            null,
                            'planned',
                            'progress',
                            'done',
                            'declined',
                        ] as const
                    ).map((value) => (
                        <button
                            key={value ?? 'all'}
                            type="button"
                            onClick={() => filter({ status: value })}
                            className={cn(
                                'h-8 rounded-chip px-3 text-[13px] font-medium transition',
                                status === value
                                    ? 'bg-white/12 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            {value === null ? tr('Усі') : STATUS[value].label()}
                        </button>
                    ))}
                </div>

                {ideas.data.length === 0 ? (
                    <div className="mt-6">
                        <EmptyState
                            icon={Lightbulb}
                            title={tr('Тут поки порожньо')}
                            text={tr('Запропонуйте першу ідею.')}
                        />
                    </div>
                ) : (
                    <InfiniteScroll
                        data="ideas"
                        loading={<ListSkeleton rows={3} />}
                        preserveUrl
                    >
                        <ul className="mt-4 space-y-2">
                            {ideas.data.map((idea) => (
                                <IdeaRow
                                    key={idea.id}
                                    idea={idea}
                                    canManage={canManage}
                                />
                            ))}
                        </ul>
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}

function IdeaRow({ idea, canManage }: { idea: IdeaItem; canManage: boolean }) {
    const status = STATUS[idea.status];

    return (
        <li className="glass flex gap-3 rounded-2xl p-4">
            <button
                type="button"
                onClick={() =>
                    router.post(
                        `/ideas/${idea.id}/vote`,
                        {},
                        { preserveScroll: true, preserveState: true },
                    )
                }
                aria-pressed={idea.voted}
                aria-label={tr('Голосувати')}
                className={cn(
                    'flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 text-sm font-semibold tabular-nums transition',
                    idea.voted
                        ? 'bg-gc-indigo text-white'
                        : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.1]',
                )}
            >
                <ChevronUp className="size-4" />
                {idea.votes}
            </button>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-white">
                        {idea.title}
                    </h2>
                    <span
                        className={cn(
                            'rounded-chip px-2 py-0.5 text-[11px] font-medium',
                            status.tone,
                        )}
                    >
                        {status.label()}
                    </span>
                </div>
                {idea.body && (
                    <p className="mt-1 text-sm whitespace-pre-line text-white/65">
                        {idea.body}
                    </p>
                )}
                {idea.answer && (
                    <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/80">
                        <span className="text-white/45">{tr('Команда:')}</span>{' '}
                        {idea.answer}
                    </p>
                )}
                <p className="mt-2 text-xs text-white/40">
                    {idea.author && (
                        <Link
                            href={`/${idea.author.username}`}
                            className="hover:text-white"
                        >
                            {idea.author.name}
                        </Link>
                    )}
                    {' · '}
                    {formatDate(idea.created_at)}
                </p>
                {canManage && (
                    <select
                        value={idea.status}
                        onChange={(e) => {
                            const answer = window.prompt(
                                tr(
                                    'Коротка відповідь команди (можна порожньо)',
                                ),
                                idea.answer ?? '',
                            );
                            router.patch(
                                `/ideas/${idea.id}`,
                                {
                                    status: e.target.value,
                                    answer: answer ?? idea.answer,
                                },
                                { preserveScroll: true, preserveState: true },
                            );
                        }}
                        className="input-glass mt-2 h-8 rounded-lg px-2 text-xs text-white"
                    >
                        {(Object.keys(STATUS) as Status[]).map((value) => (
                            <option key={value} value={value}>
                                {STATUS[value].label()}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        </li>
    );
}
