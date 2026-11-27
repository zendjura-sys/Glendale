import {
    ArrowLeft,
    Eye,
    Heart,
    Lock,
    MessageSquare,
    Pin,
    Plus,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type DiscussionCard = {
    id: number;
    title: string;
    excerpt: string | null;
    category: string;
    category_label: string;
    subject_type: string | null;
    spoiler: boolean;
    is_pinned: boolean;
    is_locked: boolean;
    replies_count: number;
    likes_count: number;
    views_count: number;
    liked: boolean;
    user: UserCard | null;
    created_at: string;
    last_reply_at: string | null;
    can_edit: boolean;
    can_moderate: boolean;
};
type Reply = {
    id: number;
    body: string;
    spoiler: boolean;
    likes_count: number;
    liked: boolean;
    user: UserCard | null;
    parent: { id: number; author: string | null; body: string | null } | null;
    created_at: string;
    edited: boolean;
    can_delete: boolean;
};
type Thread = {
    discussion: DiscussionCard & { body: string | null };
    subject: { title: string; href: string; label: string } | null;
    replies: { data: Reply[]; current_page: number; last_page: number };
};
type List = {
    subject: { title: string } | null;
    categories: Record<string, string>;
    discussions: {
        data: DiscussionCard[];
        current_page: number;
        last_page: number;
        total: number;
    };
};

const GHOST = { name: '—', avatar_url: null };
const ago = (iso: string): string =>
    new Date(iso).toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

/**
 * «Обговорення» — теми й відповіді. Із subject — до конкретного фільму, гри, сервера, сім’ї, клану,
 * спільноти чи статті (вбудовується на їхні сторінки); без subject — загальний розділ з категоріями.
 */
export function Discussions({
    subject,
    category: initial,
    compact = false,
}: {
    subject?: { type: string; id: number };
    category?: string;
    compact?: boolean;
}) {
    const [list, setList] = useState<List | null>(null);
    const [category, setCategory] = useState(initial ?? '');
    const [sort, setSort] = useState<'active' | 'new' | 'top'>('active');
    const [open, setOpen] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [page, setPage] = useState(1);

    const query = subject
        ? `type=${subject.type}&id=${subject.id}`
        : `category=${category}`;
    const load = useCallback(() => {
        void api<List>(
            'GET',
            `/discussions/list?${query}&sort=${sort}&page=${page}`,
        )
            .then(setList)
            .catch(() => setList(null));
    }, [query, sort, page]);
    useEffect(load, [load]);

    if (open)
        return <ThreadView id={open} onBack={() => (setOpen(null), load())} />;

    return (
        <section
            className="glass rounded-2xl p-4"
            aria-label={tr('Обговорення')}
        >
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <MessageSquare className="size-5 text-white/60" />{' '}
                    {tr('Обговорення')}
                    {list && (
                        <span className="text-sm font-normal text-white/45">
                            {list.discussions.total}
                        </span>
                    )}
                </h2>
                <div className="ml-auto flex gap-1">
                    {(['active', 'new', 'top'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => (setSort(s), setPage(1))}
                            className={cn(
                                'rounded-full px-3 py-1 text-sm transition',
                                sort === s
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/55 hover:bg-white/10',
                            )}
                        >
                            {s === 'active'
                                ? tr('Активні')
                                : s === 'new'
                                  ? tr('Нові')
                                  : tr('Найкращі')}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setCreating((v) => !v)}
                        className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1 text-sm font-semibold text-primary-foreground"
                    >
                        <Plus className="size-4" /> {tr('Нова тема')}
                    </button>
                </div>
            </div>
            {!subject && list && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                    {[['', tr('Усе')], ...Object.entries(list.categories)].map(
                        ([k, v]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => (setCategory(k), setPage(1))}
                                className={cn(
                                    'rounded-full px-3 py-1 text-sm ring-1 transition',
                                    category === k
                                        ? 'bg-white/15 text-white ring-white/25'
                                        : 'text-white/60 ring-white/10 hover:bg-white/10',
                                )}
                            >
                                {v}
                            </button>
                        ),
                    )}
                </div>
            )}
            {creating && (
                <NewTopic
                    subject={subject}
                    categories={list?.categories ?? {}}
                    category={category}
                    onDone={(id) => {
                        setCreating(false);
                        setOpen(id);
                    }}
                />
            )}
            {list === null ? null : list.discussions.data.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/50">
                    {tr('Тем ще немає — почніть першу.')}
                </p>
            ) : (
                <ul className="divide-y divide-white/[0.06]">
                    {list.discussions.data
                        .slice(0, compact ? 5 : undefined)
                        .map((d) => (
                            <li key={d.id}>
                                <button
                                    type="button"
                                    onClick={() => setOpen(d.id)}
                                    className="flex w-full items-start gap-3 py-3 text-left transition hover:bg-white/[0.03]"
                                >
                                    <UserAvatar
                                        user={d.user ?? GHOST}
                                        size="sm"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5 font-medium text-white">
                                            {d.is_pinned && (
                                                <Pin className="size-3.5 text-amber-300" />
                                            )}
                                            {d.is_locked && (
                                                <Lock className="size-3.5 text-white/45" />
                                            )}
                                            <span className="truncate">
                                                {d.title}
                                            </span>
                                            {d.spoiler && (
                                                <span className="rounded bg-rose-500/20 px-1.5 text-[11px] text-rose-200">
                                                    {tr('спойлер')}
                                                </span>
                                            )}
                                        </span>
                                        {d.excerpt && !d.spoiler && (
                                            <span className="line-clamp-1 text-sm text-white/55">
                                                {d.excerpt}
                                            </span>
                                        )}
                                        <span className="text-xs text-white/40">
                                            {d.user?.name} ·{' '}
                                            {!subject &&
                                                `${d.category_label} · `}
                                            {ago(
                                                d.last_reply_at ?? d.created_at,
                                            )}
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-3 text-xs text-white/50 tabular-nums">
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="size-3.5" />
                                            {d.replies_count}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Heart className="size-3.5" />
                                            {d.likes_count}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                </ul>
            )}
            {list && list.discussions.last_page > 1 && !compact && (
                <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white/60">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="disabled:opacity-30"
                    >
                        ←
                    </button>
                    {page} / {list.discussions.last_page}
                    <button
                        type="button"
                        disabled={page >= list.discussions.last_page}
                        onClick={() => setPage(page + 1)}
                        className="disabled:opacity-30"
                    >
                        →
                    </button>
                </div>
            )}
        </section>
    );
}

function NewTopic({
    subject,
    categories,
    category,
    onDone,
}: {
    subject?: { type: string; id: number };
    categories: Record<string, string>;
    category: string;
    onDone: (id: number) => void;
}) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [cat, setCat] = useState(category || (subject ? '' : 'general'));
    const [spoiler, setSpoiler] = useState(false);
    const [busy, setBusy] = useState(false);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        api<{ discussion: { id: number } }>('POST', '/discussions', {
            ...(subject ? { type: subject.type, id: subject.id } : {}),
            category: cat || null,
            title,
            body: body || null,
            spoiler,
        })
            .then((r) => onDone(r.discussion.id))
            .catch((err: { message?: string }) =>
                toast.error(err.message ?? tr('Не вдалося.')),
            )
            .finally(() => setBusy(false));
    };
    return (
        <form
            onSubmit={submit}
            className="mb-4 space-y-2 rounded-xl bg-white/[0.04] p-3"
        >
            <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder={tr('Тема (від 4 символів)')}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
            />
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={10000}
                placeholder={tr('Що хочете обговорити?')}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-white/65">
                    {tr('Розділ')}
                    <select
                        value={cat}
                        onChange={(e) => setCat(e.target.value)}
                        className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-sm text-white"
                    >
                        {subject && (
                            <option value="">{tr('Автоматично')}</option>
                        )}
                        {Object.entries(categories).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-sm text-white/65">
                    <input
                        type="checkbox"
                        checked={spoiler}
                        onChange={(e) => setSpoiler(e.target.checked)}
                    />{' '}
                    {tr('Спойлер')}
                </label>
                <button
                    type="submit"
                    disabled={busy || title.trim().length < 4}
                    className="ml-auto rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                    {tr('Створити')}
                </button>
            </div>
        </form>
    );
}

function ThreadView({ id, onBack }: { id: number; onBack: () => void }) {
    const [t, setT] = useState<Thread | null>(null);
    const [body, setBody] = useState('');
    const [reply, setReply] = useState<Reply | null>(null);
    const [shown, setShown] = useState<Record<number, boolean>>({});
    const load = useCallback(
        () =>
            void api<Thread>('GET', `/discussions/${id}`)
                .then(setT)
                .catch(() => onBack()),
        [id, onBack],
    );
    useEffect(load, [load]);
    if (!t) return null;
    const d = t.discussion;
    const act = (
        method: string,
        url: string,
        data?: Record<string, unknown>,
        after?: () => void,
    ) =>
        api<{ message?: string }>(method as 'POST', url, data)
            .then((r) => {
                if (r?.message) toast.success(r.message);
                after?.();
                load();
            })
            .catch((err: { message?: string }) =>
                toast.error(err.message ?? tr('Не вдалося.')),
            );
    const send = (e: FormEvent) => {
        e.preventDefault();
        if (body.trim())
            void act(
                'POST',
                `/discussions/${id}/replies`,
                { body, parent_id: reply?.id ?? null },
                () => (setBody(''), setReply(null)),
            );
    };
    return (
        <section className="glass rounded-2xl p-4">
            <button
                type="button"
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
            >
                <ArrowLeft className="size-4" /> {tr('До тем')}
            </button>
            <div className="flex items-start gap-3">
                <UserAvatar user={d.user ?? GHOST} />
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-semibold text-white">
                        {d.title}
                    </h3>
                    <p className="text-xs text-white/45">
                        {d.user?.name} · {ago(d.created_at)} ·{' '}
                        {t.subject
                            ? `${t.subject.label}: ${t.subject.title}`
                            : d.category_label}
                        <span className="ml-2 inline-flex items-center gap-1">
                            <Eye className="size-3" />
                            {d.views_count}
                        </span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void act('POST', `/discussions/${id}/like`)}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1',
                        d.liked
                            ? 'text-rose-300 ring-rose-300/40'
                            : 'text-white/60 ring-white/15',
                    )}
                >
                    <Heart
                        className={cn('size-4', d.liked && 'fill-current')}
                    />{' '}
                    {d.likes_count}
                </button>
                {d.can_moderate && (
                    <>
                        <button
                            type="button"
                            title={tr('Закріпити')}
                            onClick={() =>
                                void act(
                                    'POST',
                                    `/discussions/${id}/moderate`,
                                    { pinned: !d.is_pinned },
                                )
                            }
                            className="rounded-full p-1.5 text-white/55 hover:bg-white/10"
                        >
                            <Pin className="size-4" />
                        </button>
                        <button
                            type="button"
                            title={tr('Закрити тему')}
                            onClick={() =>
                                void act(
                                    'POST',
                                    `/discussions/${id}/moderate`,
                                    { locked: !d.is_locked },
                                )
                            }
                            className="rounded-full p-1.5 text-white/55 hover:bg-white/10"
                        >
                            <Lock className="size-4" />
                        </button>
                    </>
                )}
                {d.can_edit && (
                    <button
                        type="button"
                        title={tr('Видалити')}
                        onClick={() =>
                            window.confirm(tr('Видалити тему?')) &&
                            void act(
                                'DELETE',
                                `/discussions/${id}`,
                                undefined,
                                onBack,
                            )
                        }
                        className="rounded-full p-1.5 text-white/55 hover:bg-white/10 hover:text-rose-300"
                    >
                        <Trash2 className="size-4" />
                    </button>
                )}
            </div>
            {d.body && (
                <p
                    className={cn(
                        'mt-3 whitespace-pre-wrap text-white/85',
                        d.spoiler && !shown[0] && 'cursor-pointer blur-sm',
                    )}
                    onClick={() => setShown({ ...shown, 0: true })}
                >
                    {d.body}
                </p>
            )}
            <ul className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                {t.replies.data.map((r) => (
                    <li key={r.id} className="flex gap-3">
                        <UserAvatar user={r.user ?? GHOST} size="sm" />
                        <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                            <p className="text-sm">
                                <span className="font-semibold text-white">
                                    {r.user?.name}
                                </span>{' '}
                                <span className="text-xs text-white/40">
                                    {ago(r.created_at)}
                                </span>
                            </p>
                            {r.parent && (
                                <p className="my-1 border-l-2 border-white/20 pl-2 text-xs text-white/50">
                                    <b>{r.parent.author}</b>{' '}
                                    {r.parent.body ?? tr('видалена відповідь')}
                                </p>
                            )}
                            <p
                                className={cn(
                                    'text-sm whitespace-pre-wrap text-white/80',
                                    r.spoiler &&
                                        !shown[r.id] &&
                                        'cursor-pointer blur-sm',
                                )}
                                onClick={() =>
                                    setShown({ ...shown, [r.id]: true })
                                }
                            >
                                {r.body}
                            </p>
                            <div className="mt-1 flex gap-3 text-xs text-white/45">
                                <button
                                    type="button"
                                    onClick={() =>
                                        void act(
                                            'POST',
                                            `/discussions/${id}/replies/${r.id}/like`,
                                        )
                                    }
                                    className={cn(
                                        'inline-flex items-center gap-1',
                                        r.liked && 'text-rose-300',
                                    )}
                                >
                                    <Heart
                                        className={cn(
                                            'size-3',
                                            r.liked && 'fill-current',
                                        )}
                                    />
                                    {r.likes_count}
                                </button>
                                {!d.is_locked && (
                                    <button
                                        type="button"
                                        onClick={() => setReply(r)}
                                    >
                                        {tr('Відповісти')}
                                    </button>
                                )}
                                {r.can_delete && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void act(
                                                'DELETE',
                                                `/discussions/${id}/replies/${r.id}`,
                                            )
                                        }
                                    >
                                        {tr('Видалити')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            {d.is_locked ? (
                <p className="mt-4 text-center text-sm text-white/45">
                    {tr('Тему закрито.')}
                </p>
            ) : (
                <form onSubmit={send} className="mt-4">
                    {reply && (
                        <p className="mb-1 text-xs text-white/50">
                            {tr('Відповідь для {name}', {
                                name: reply.user?.name ?? '',
                            })}{' '}
                            <button
                                type="button"
                                onClick={() => setReply(null)}
                            >
                                ✕
                            </button>
                        </p>
                    )}
                    <div className="flex gap-2">
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={2}
                            maxLength={5000}
                            placeholder={tr('Ваша відповідь…')}
                            className="min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
                        />
                        <button
                            type="submit"
                            disabled={!body.trim()}
                            className="self-end rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                        >
                            {tr('Надіслати')}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}
