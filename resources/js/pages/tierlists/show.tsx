import { Head, Link, router } from '@inertiajs/react';
import { Eye, Lock, Pencil, Trash2 } from 'lucide-react';
import { TIER_COLORS } from '@/components/games/tier-colors';
import type { Tier } from '@/components/games/tier-colors';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type List = {
    id: number;
    title: string;
    author: UserCard | null;
    game: { slug: string; name: string } | null;
    is_public: boolean;
    views: number;
    tiers: Tier[];
    updated_at: string;
};

/** Тір-лист: рівні з пунктами; автор може змінити чи видалити. */
export default function TierListShow({
    list,
    own,
}: {
    list: List;
    own: boolean;
}) {
    return (
        <>
            <Head title={list.title} />
            <div className="mx-auto w-full max-w-4xl px-4 py-6">
                <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-2xl font-semibold text-white">
                            {list.title}
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-white/50">
                            {list.author && (
                                <Link
                                    href={`/${list.author.username}`}
                                    className="inline-flex items-center gap-1.5 hover:text-white"
                                >
                                    <UserAvatar user={list.author} size="xs" />
                                    {list.author.name}
                                </Link>
                            )}
                            {list.game && (
                                <Link
                                    href={`/games/${list.game.slug}`}
                                    className="hover:text-white"
                                >
                                    · {list.game.name}
                                </Link>
                            )}
                            <span>· {formatDate(list.updated_at)}</span>
                            <span className="inline-flex items-center gap-1">
                                · <Eye className="size-3.5" /> {list.views}
                            </span>
                            {!list.is_public && (
                                <span className="inline-flex items-center gap-1">
                                    · <Lock className="size-3.5" />{' '}
                                    {tr('Лише для вас')}
                                </span>
                            )}
                        </p>
                    </div>
                    {own && (
                        <div className="flex gap-2">
                            <Link
                                href={`/tierlists/${list.id}/edit`}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                            >
                                <Pencil className="size-4" />
                                {tr('Змінити')}
                            </Link>
                            <button
                                type="button"
                                onClick={() =>
                                    window.confirm(tr('Видалити тір-лист?')) &&
                                    router.delete(`/tierlists/${list.id}`)
                                }
                                aria-label={tr('Видалити')}
                                className="flex size-10 items-center justify-center rounded-xl bg-white/[0.07] text-white/60 transition hover:bg-rose-500/15 hover:text-rose-200"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        </div>
                    )}
                </div>
                <TierBoard tiers={list.tiers} />
            </div>
        </>
    );
}

export function TierBoard({ tiers }: { tiers: Tier[] }) {
    return (
        <div className="glass mt-5 overflow-hidden rounded-2xl">
            {tiers.map((tier, i) => (
                <div
                    key={i}
                    className="flex min-h-16 border-b border-white/[0.06] last:border-0"
                >
                    <div
                        className={cn(
                            'flex w-16 shrink-0 items-center justify-center font-display text-xl font-bold text-black/80 sm:w-20',
                            TIER_COLORS[tier.color],
                        )}
                    >
                        {tier.label}
                    </div>
                    <div className="flex flex-1 flex-wrap content-center gap-1.5 p-2">
                        {tier.items.map((item, j) => (
                            <span
                                key={j}
                                className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-sm text-white"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
