import { Head, Link, router } from '@inertiajs/react';
import { Flame, Gamepad2, Heart, Images, Sparkles } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { EmptyState } from '@/components/gc/widget';
import { PhotoViewer } from '@/components/photos/photo-viewer';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Shot = {
    id: number;
    url: string;
    width: number | null;
    height: number | null;
    likes_count: number;
    alt: string | null;
    user: UserCard | null;
    game: { slug: string; name: string } | null;
};

type Props = {
    photos: Shot[];
    more: boolean;
    filters: { game: string | null; sort: 'new' | 'top'; page: number };
    game: { slug: string; name: string; cover: string | null } | null;
    games: { slug: string; name: string; total: number }[];
};

/** Скриншоти за іграми: публічні фото з позначкою гри, перегляд у звичному переглядачі фото. */
export default function Screenshots({
    photos,
    more,
    filters,
    game,
    games,
}: Props) {
    const reduce = useReducedMotion();
    const [openId, setOpenId] = useState<number | null>(null);
    const open = photos.find((p) => p.id === openId);
    const visit = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, page: 1, ...patch };
        router.get(
            '/screenshots',
            {
                game: next.game || undefined,
                sort: next.sort === 'new' ? undefined : next.sort,
                page: next.page > 1 ? next.page : undefined,
            },
            {
                preserveState: true,
                preserveScroll: patch.page !== undefined,
                replace: true,
            },
        );
    };

    return (
        <>
            <Head
                title={
                    game
                        ? tr('Скриншоти · {game}', { game: game.name })
                        : tr('Скриншоти')
                }
            />
            <div className="space-y-4">
                <section className="gc-solid rounded-2xl p-5 sm:p-6">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <Images className="size-6 text-sky-400" />
                        {game
                            ? tr('Скриншоти · {game}', { game: game.name })
                            : tr('Скриншоти')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Кадри гравців з публічних альбомів. Щоб ваш скриншот з’явився тут — оберіть гру для альбому чи фото.',
                        )}{' '}
                        <Link
                            href="/photos"
                            className="font-semibold text-sky-400 hover:underline"
                        >
                            {tr('Мої фото')}
                        </Link>
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <div className="gc-solid-2 flex gap-1 rounded-xl p-1">
                            {(
                                [
                                    ['new', tr('Нові'), Sparkles],
                                    ['top', tr('Популярні'), Flame],
                                ] as const
                            ).map(([key, label, Icon]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={filters.sort === key}
                                    onClick={() => visit({ sort: key })}
                                    className={cn(
                                        'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium',
                                        filters.sort === key
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/55 hover:text-white',
                                    )}
                                >
                                    <Icon className="size-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {games.length > 0 && (
                        <div className="-mx-1 mt-3 scrollbar-none flex gap-1.5 overflow-x-auto px-1">
                            <button
                                type="button"
                                onClick={() => visit({ game: null })}
                                className={cn(
                                    'h-8 shrink-0 rounded-full px-3 text-xs font-semibold',
                                    !filters.game
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-white/[0.06] text-white/70',
                                )}
                            >
                                {tr('Усі ігри')}
                            </button>
                            {games.map((g) => (
                                <button
                                    key={g.slug}
                                    type="button"
                                    onClick={() => visit({ game: g.slug })}
                                    className={cn(
                                        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap',
                                        filters.game === g.slug
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-white/[0.06] text-white/70 hover:text-white',
                                    )}
                                >
                                    <Gamepad2 className="size-3.5" />
                                    {g.name}
                                    <span className="tabular-nums opacity-60">
                                        {g.total}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {photos.length === 0 ? (
                    <section className="gc-solid rounded-2xl p-5">
                        <EmptyState
                            icon={Images}
                            title={tr('Скриншотів ще немає')}
                            text={tr(
                                'Створіть альбом, оберіть для нього гру й завантажте кадри — вони з’являться тут.',
                            )}
                        />
                    </section>
                ) : (
                    <div className="columns-2 gap-3 md:columns-3 2xl:columns-4">
                        {photos.map((p, i) => (
                            <m.button
                                key={p.id}
                                type="button"
                                initial={reduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i, 12) * 0.02 }}
                                onClick={() => setOpenId(p.id)}
                                className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-black/30 text-left"
                            >
                                <img
                                    src={p.url}
                                    alt={p.alt ?? ''}
                                    loading="lazy"
                                    width={p.width ?? undefined}
                                    height={p.height ?? undefined}
                                    className="w-full object-cover transition group-hover:opacity-90"
                                />
                                <span
                                    data-on-dark
                                    className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-xs text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                                >
                                    <span className="min-w-0 flex-1 truncate">
                                        {p.game?.name}
                                        {p.user && ` · ${p.user.name}`}
                                    </span>
                                    <Heart className="size-3.5" />{' '}
                                    {p.likes_count}
                                </span>
                            </m.button>
                        ))}
                    </div>
                )}

                {(filters.page > 1 || more) && (
                    <div className="flex justify-center gap-2">
                        {filters.page > 1 && (
                            <button
                                type="button"
                                onClick={() =>
                                    visit({ page: filters.page - 1 })
                                }
                                className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm text-white/80"
                            >
                                {tr('Назад')}
                            </button>
                        )}
                        {more && (
                            <button
                                type="button"
                                onClick={() =>
                                    visit({ page: filters.page + 1 })
                                }
                                className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm text-white/80"
                            >
                                {tr('Далі')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <PhotoViewer
                photoId={openId}
                previewUrl={open?.url}
                onClose={() => setOpenId(null)}
                onNavigate={setOpenId}
            />
        </>
    );
}
