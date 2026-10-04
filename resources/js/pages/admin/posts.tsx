import { Head, Link, router } from '@inertiajs/react';
import {
    Globe,
    Heart,
    ImageIcon,
    Lock,
    MessageSquare,
    RotateCcw,
    Search,
    Trash2,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    PageHeader,
    Pagination,
    Pill,
    selectClass,
} from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Input } from '@/components/ui/input';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, UserCard, Visibility } from '@/types';
import { tr } from '@/lib/i18n';

type AdminPost = {
    id: number;
    body: string | null;
    visibility: Visibility;
    author: UserCard | null;
    likes_count: number;
    comments_count: number;
    attachments_count: number;
    created_at: string;
    deleted_at: string | null;
};

type Props = {
    posts: Paginated<AdminPost>;
    filters: { q: string; visibility: string; trashed: boolean };
};

const VISIBILITY = {
    public: { label: tr('Усім'), icon: Globe },
    friends: { label: tr('Друзям'), icon: UsersRound },
    private: { label: tr('Лише автор'), icon: Lock },
} as const;

export default function AdminPosts({ posts, filters }: Props) {
    const [q, setQ] = useState(filters.q);

    const apply = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/admin/posts',
            { ...next, trashed: next.trashed ? 1 : undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        apply({ q });
    };

    const remove = (post: AdminPost) => {
        if (
            post.deleted_at &&
            !confirm(tr('Видалити запис назавжди разом із фото?'))
        ) {
            return;
        }

        router.delete(`/admin/posts/${post.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Записи — Адмін-панель')} />
            <PageHeader
                title={tr('Записи')}
                description={
                    filters.trashed
                        ? tr('У кошику: {total}', { total: posts.total })
                        : tr('Усього: {total}', { total: posts.total })
                }
                actions={
                    <div className="glass flex rounded-xl p-1 text-sm">
                        {[
                            { label: tr('Опубліковані'), value: false },
                            { label: tr('Кошик'), value: true },
                        ].map((tab) => (
                            <button
                                key={tab.label}
                                type="button"
                                onClick={() => apply({ trashed: tab.value })}
                                className={cn(
                                    'rounded-lg px-3.5 py-1.5 font-medium transition',
                                    filters.trashed === tab.value
                                        ? 'bg-gradient-brand text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <form
                    onSubmit={submit}
                    className="relative min-w-[220px] flex-1"
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Текст запису або автор')}
                        className="h-10 pl-10"
                    />
                </form>
                <select
                    value={filters.visibility}
                    onChange={(e) => apply({ visibility: e.target.value })}
                    className={selectClass}
                >
                    <option value="">{tr('Будь-яка видимість')}</option>
                    {Object.entries(VISIBILITY).map(([key, v]) => (
                        <option key={key} value={key}>
                            {v.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid gap-3">
                {posts.data.map((p) => {
                    const V = VISIBILITY[p.visibility] ?? VISIBILITY.public;

                    return (
                        <article
                            key={p.id}
                            className={cn(
                                'glass flex gap-4 rounded-2xl p-4',
                                p.deleted_at && 'opacity-70',
                            )}
                        >
                            {p.author && (
                                <UserAvatar
                                    user={p.author}
                                    size="md"
                                    showOnline={false}
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                                    {p.author && (
                                        <Link
                                            href={`/${p.author.username}`}
                                            className="font-semibold text-white hover:underline"
                                        >
                                            {p.author.name}
                                        </Link>
                                    )}
                                    <span>{timeAgo(p.created_at)}</span>
                                    <span className="text-white/20">
                                        #{p.id}
                                    </span>
                                    <Pill>
                                        <V.icon className="size-3" /> {V.label}
                                    </Pill>
                                    {p.deleted_at && (
                                        <Pill tone="red">{tr('У кошику')}</Pill>
                                    )}
                                </div>
                                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-white/80">
                                    {p.body || (
                                        <span className="text-white/35 italic">
                                            {tr('Без тексту')}
                                        </span>
                                    )}
                                </p>
                                <div className="mt-2 flex gap-4 text-xs text-white/40">
                                    <span className="flex items-center gap-1">
                                        <Heart className="size-3.5" />{' '}
                                        {p.likes_count}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="size-3.5" />{' '}
                                        {p.comments_count}
                                    </span>
                                    {p.attachments_count > 0 && (
                                        <span className="flex items-center gap-1">
                                            <ImageIcon className="size-3.5" />{' '}
                                            {p.attachments_count}
                                        </span>
                                    )}
                                    {!p.deleted_at && (
                                        <Link
                                            href={`/posts/${p.id}`}
                                            className="ml-auto text-[#9aa8ff] hover:underline"
                                        >
                                            {tr('Відкрити')}
                                        </Link>
                                    )}
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-1.5">
                                {p.deleted_at && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post(
                                                `/admin/posts/${p.id}/restore`,
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                        className="flex size-9 items-center justify-center rounded-xl text-emerald-300 transition hover:bg-emerald-400/10"
                                        title={tr('Відновити')}
                                    >
                                        <RotateCcw className="size-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => remove(p)}
                                    className="flex size-9 items-center justify-center rounded-xl text-rose-300 transition hover:bg-rose-500/10"
                                    title={
                                        p.deleted_at
                                            ? tr('Видалити назавжди')
                                            : tr('У кошик')
                                    }
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        </article>
                    );
                })}
                {posts.data.length === 0 && (
                    <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                        {tr('Записів не знайдено')}
                    </div>
                )}
            </div>

            <Pagination data={posts} />
        </>
    );
}
