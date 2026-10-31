import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    BookOpenText,
    History,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CommunityCard, UserCard } from '@/types';

type Page = {
    slug: string;
    title: string;
    body: string;
    editor: UserCard | null;
    updated_at: string;
    revisions: {
        id: number;
        title: string;
        author: string | null;
        created_at: string;
    }[];
};

/** Вікі спільноти: список сторінок, сторінка з розділами «# Заголовок», правка й історія версій. */
export default function CommunityWiki({
    community,
    pages,
    page,
    can_edit,
}: {
    community: CommunityCard;
    pages: { slug: string; title: string; updated_at?: string }[];
    page: Page | null;
    can_edit: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [history, setHistory] = useState(false);
    const form = useForm({
        slug: page?.slug ?? null,
        title: page?.title ?? '',
        body: page?.body ?? '',
    });
    const base = `/c/${community.slug}/wiki`;
    const startNew = () => {
        form.setData({ slug: null, title: '', body: '' });
        setEditing(true);
    };

    return (
        <>
            <Head title={`${page?.title ?? tr('Вікі')} — ${community.name}`} />
            <div className="mx-auto max-w-5xl space-y-4">
                <div className="flex items-center gap-3">
                    <Link
                        href={page ? base : `/c/${community.slug}`}
                        aria-label={tr('Назад')}
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <CommunityAvatar community={community} size="md" />
                    <div className="min-w-0 flex-1">
                        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                            <BookOpenText className="size-5 text-gc-lilac-300" />
                            {tr('Вікі')}
                        </h1>
                        <p className="truncate text-sm text-white/50">
                            {community.name}
                        </p>
                    </div>
                    {can_edit && (
                        <button
                            type="button"
                            onClick={startNew}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="size-4" />
                            <span className="hidden sm:inline">
                                {tr('Сторінка')}
                            </span>
                        </button>
                    )}
                </div>

                <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
                    <nav
                        className="glass h-fit rounded-2xl p-2"
                        aria-label={tr('Сторінки вікі')}
                    >
                        {pages.length === 0 && (
                            <p className="p-2 text-sm text-white/50">
                                {tr('Сторінок ще немає.')}
                            </p>
                        )}
                        {pages.map((p) => (
                            <Link
                                key={p.slug}
                                href={`${base}/${p.slug}`}
                                className={cn(
                                    'block truncate rounded-xl px-3 py-2 text-sm transition',
                                    page?.slug === p.slug
                                        ? 'bg-white/[0.08] text-white'
                                        : 'text-white/65 hover:bg-white/[0.05] hover:text-white',
                                )}
                            >
                                {p.title}
                            </Link>
                        ))}
                    </nav>

                    <div>
                        {editing ? (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    form.post(base, {
                                        onSuccess: () => setEditing(false),
                                    });
                                }}
                                className="glass space-y-3 rounded-2xl p-4"
                            >
                                <input
                                    value={form.data.title}
                                    onChange={(e) =>
                                        form.setData('title', e.target.value)
                                    }
                                    placeholder={tr('Назва сторінки')}
                                    maxLength={120}
                                    className="input-glass h-11 w-full rounded-xl px-3.5 font-display text-lg text-white placeholder:text-white/30"
                                />
                                <textarea
                                    value={form.data.body}
                                    onChange={(e) =>
                                        form.setData('body', e.target.value)
                                    }
                                    placeholder={tr(
                                        'Текст. Розділи — рядки, що починаються з «#».',
                                    )}
                                    rows={16}
                                    maxLength={50000}
                                    className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-white/30"
                                />
                                {Object.values(form.errors)[0] && (
                                    <p className="text-xs text-rose-300">
                                        {Object.values(form.errors)[0]}
                                    </p>
                                )}
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(false)}
                                        className="h-10 rounded-xl px-4 text-sm text-white/60 hover:text-white"
                                    >
                                        {tr('Скасувати')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            form.processing ||
                                            !form.data.title.trim() ||
                                            !form.data.body.trim()
                                        }
                                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                                    >
                                        {tr('Зберегти')}
                                    </button>
                                </div>
                            </form>
                        ) : page ? (
                            <article className="glass rounded-2xl p-5 sm:p-7">
                                <div className="flex flex-wrap items-start gap-3">
                                    <h2 className="min-w-0 flex-1 font-display text-2xl font-semibold text-white">
                                        {page.title}
                                    </h2>
                                    {can_edit && (
                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    form.setData({
                                                        slug: page.slug,
                                                        title: page.title,
                                                        body: page.body,
                                                    });
                                                    setEditing(true);
                                                }}
                                                aria-label={tr('Редагувати')}
                                                className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 hover:text-white"
                                            >
                                                <Pencil className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setHistory(!history)
                                                }
                                                aria-label={tr(
                                                    'Історія правок',
                                                )}
                                                className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 hover:text-white"
                                            >
                                                <History className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    window.confirm(
                                                        tr(
                                                            'Видалити сторінку разом з історією?',
                                                        ),
                                                    ) &&
                                                    router.delete(
                                                        `${base}/${page.slug}`,
                                                    )
                                                }
                                                aria-label={tr('Видалити')}
                                                className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 hover:text-rose-300"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-white/40">
                                    {page.editor?.name} ·{' '}
                                    {timeAgo(page.updated_at)}
                                </p>
                                {history && (
                                    <ul className="mt-3 space-y-1 rounded-xl bg-white/[0.04] p-3 text-sm">
                                        {page.revisions.length === 0 && (
                                            <li className="text-white/50">
                                                {tr(
                                                    'Попередніх версій ще немає.',
                                                )}
                                            </li>
                                        )}
                                        {page.revisions.map((r) => (
                                            <li
                                                key={r.id}
                                                className="flex items-center gap-2"
                                            >
                                                <span className="min-w-0 flex-1 truncate text-white/75">
                                                    {formatDate(r.created_at)} ·{' '}
                                                    {r.author ?? '—'} ·{' '}
                                                    {r.title}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        window.confirm(
                                                            tr(
                                                                'Повернути цю версію?',
                                                            ),
                                                        ) &&
                                                        router.post(
                                                            `${base}/${page.slug}/revert/${r.id}`,
                                                        )
                                                    }
                                                    className="text-xs text-gc-lilac-300 hover:text-white"
                                                >
                                                    {tr('Повернути')}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="mt-5 space-y-4">
                                    {page.body
                                        .split(/\r?\n(?=#{1,3}\s)/)
                                        .map((part, i) => {
                                            const heading =
                                                /^#{1,3}\s+(.+)\n?/.exec(part);
                                            return (
                                                <section key={i}>
                                                    {heading && (
                                                        <h3 className="mb-1.5 font-display text-lg font-semibold text-white">
                                                            {heading[1]}
                                                        </h3>
                                                    )}
                                                    <p className="text-[15px] leading-relaxed whitespace-pre-line text-white/80">
                                                        {heading
                                                            ? part.slice(
                                                                  heading[0]
                                                                      .length,
                                                              )
                                                            : part}
                                                    </p>
                                                </section>
                                            );
                                        })}
                                </div>
                            </article>
                        ) : (
                            <div className="glass rounded-2xl p-8 text-center">
                                <BookOpenText className="mx-auto size-8 text-white/30" />
                                <p className="mt-3 text-sm text-white/60">
                                    {pages.length
                                        ? tr('Оберіть сторінку ліворуч.')
                                        : can_edit
                                          ? tr(
                                                'Створіть першу сторінку: гайди, правила гри, корисні посилання.',
                                            )
                                          : tr('Тут поки нічого немає.')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
