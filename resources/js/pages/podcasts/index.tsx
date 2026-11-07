import { Head, Link, router, useForm } from '@inertiajs/react';
import { Mic2, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type PodcastCard = {
    id: number;
    title: string;
    description: string | null;
    cover_url: string | null;
    category: string;
    author: UserCard | null;
    episodes: number;
    subscribers: number;
    subscribed: boolean;
};

const field =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

export function PodcastCover({
    podcast,
    className,
}: {
    podcast: Pick<PodcastCard, 'cover_url' | 'title'>;
    className?: string;
}) {
    return podcast.cover_url ? (
        <img
            src={podcast.cover_url}
            alt=""
            loading="lazy"
            className={cn('aspect-square rounded-xl object-cover', className)}
        />
    ) : (
        <span
            className={cn(
                'flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-gc-indigo/50 to-violet-500/30',
                className,
            )}
        >
            <Mic2 className="size-1/3 text-white/80" />
        </span>
    );
}

/** Подкасти: каталог за категоріями, мої шоу, створення нового. */
export default function Podcasts({
    podcasts,
    mine,
    categories,
    category,
}: {
    podcasts: PodcastCard[];
    mine: PodcastCard[];
    categories: Record<string, string>;
    category: string | null;
}) {
    const [creating, setCreating] = useState(false);
    const form = useForm<{
        title: string;
        description: string;
        category: string;
        cover: File | null;
    }>({ title: '', description: '', category: 'games', cover: null });

    return (
        <>
            <Head title={tr('Подкасти')} />
            <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                            <Mic2 className="size-6 text-gc-lilac-300" />
                            {tr('Подкасти')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Слухайте гравців і стрімерів — або запишіть свій.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCreating(!creating)}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <Plus className="size-4" />
                        {tr('Свій подкаст')}
                    </button>
                </div>

                {creating && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post('/podcasts', { forceFormData: true });
                        }}
                        className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2"
                    >
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Назва подкасту')}
                            maxLength={120}
                            className={field}
                        />
                        <select
                            value={form.data.category}
                            onChange={(e) =>
                                form.setData('category', e.target.value)
                            }
                            className={field}
                            aria-label={tr('Категорія')}
                        >
                            {Object.entries(categories).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {tr(label)}
                                </option>
                            ))}
                        </select>
                        <textarea
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder={tr('Про що подкаст')}
                            rows={3}
                            maxLength={2000}
                            className={cn(
                                field,
                                'h-auto resize-y py-2.5 sm:col-span-2',
                            )}
                        />
                        <label className="text-xs text-white/50 sm:col-span-2">
                            {tr('Обкладинка (квадратна, необовʼязково)')}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                    form.setData(
                                        'cover',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                                className="mt-1 block text-sm text-white/70"
                            />
                        </label>
                        {Object.values(form.errors)[0] && (
                            <p className="text-xs text-rose-300 sm:col-span-2">
                                {Object.values(form.errors)[0]}
                            </p>
                        )}
                        <div className="flex justify-end sm:col-span-2">
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    form.data.title.trim().length < 3
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Створити')}
                            </button>
                        </div>
                    </form>
                )}

                {mine.length > 0 && (
                    <section>
                        <h2 className="mb-2 text-sm font-semibold text-white/70">
                            {tr('Мої подкасти')}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {mine.map((p) => (
                                <Link
                                    key={p.id}
                                    href={`/podcasts/${p.id}`}
                                    className="glass flex items-center gap-2 rounded-xl p-2 pr-3 text-sm text-white hover:bg-white/[0.06]"
                                >
                                    <PodcastCover
                                        podcast={p}
                                        className="size-9 rounded-lg"
                                    />
                                    {p.title}
                                    <span className="text-xs text-white/45">
                                        {tr('випусків: {count}', {
                                            count: p.episodes,
                                        })}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <div className="flex flex-wrap gap-2">
                    {[
                        [null, tr('Усі')] as const,
                        ...Object.entries(categories).map(
                            ([k, v]) => [k, tr(v)] as const,
                        ),
                    ].map(([key, label]) => (
                        <button
                            key={key ?? 'all'}
                            type="button"
                            onClick={() =>
                                router.get(
                                    '/podcasts',
                                    key ? { category: key } : {},
                                    { preserveScroll: true },
                                )
                            }
                            className={cn(
                                'h-8 rounded-chip px-3 text-[13px] font-medium transition',
                                category === key
                                    ? 'bg-white/12 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {podcasts.length === 0 ? (
                    <EmptyState
                        icon={Mic2}
                        title={tr('Подкастів поки немає')}
                        text={tr('Створіть перший — і додайте випуск.')}
                    />
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {podcasts.map((p) => (
                            <Link
                                key={p.id}
                                href={`/podcasts/${p.id}`}
                                className="glass block rounded-2xl p-3 transition hover:bg-white/[0.06]"
                            >
                                <PodcastCover podcast={p} className="w-full" />
                                <p className="mt-2 truncate text-sm font-semibold text-white">
                                    {p.title}
                                </p>
                                <p className="truncate text-xs text-white/45">
                                    {p.author?.name} ·{' '}
                                    {tr('випусків: {count}', {
                                        count: p.episodes,
                                    })}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
