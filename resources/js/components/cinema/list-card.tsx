import { Link } from '@inertiajs/react';
import { Heart, Lock, Users } from 'lucide-react';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type MovieListCard = {
    id: number;
    title: string;
    description: string | null;
    is_public: boolean;
    items_count: number;
    likes_count: number;
    followers_count: number;
    user: UserCard | null;
    posters: string[];
};

/**
 * Картка добірки (колекції): перший постер — тло картки з затемненням, позаду — «стос»
 * наступної картки; угорі лічильники лайків і підписників, назва й автор — поверх унизу.
 */
export function ListCard({ list }: { list: MovieListCard }) {
    const cover = list.posters[0] ?? null;

    return (
        <Link
            href={`/cinema/lists/${list.id}`}
            className="group relative block pt-2.5"
        >
            <span
                aria-hidden
                className="absolute inset-x-6 top-0 h-6 rounded-t-2xl bg-white/[0.08]"
            />
            <span
                data-on-dark
                className="relative isolate flex aspect-[16/9] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-b from-[#5a5a5e] to-[#2b2b2e] p-4"
            >
                {cover && (
                    <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 -z-10 size-full object-cover transition duration-500 group-hover:scale-105"
                    />
                )}
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
                <span className="flex justify-end gap-2">
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-black/45 px-3 text-sm font-semibold text-white/80 tabular-nums backdrop-blur">
                        {list.followers_count}
                        <Users className="size-4" />
                    </span>
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-black/45 px-3 text-sm font-semibold text-amber-400 tabular-nums backdrop-blur">
                        {list.likes_count}
                        <Heart className="size-4 fill-current" />
                    </span>
                </span>
                <span>
                    <span className="flex items-center gap-1.5 text-lg leading-snug font-semibold text-white">
                        {!list.is_public && (
                            <Lock className="size-4 shrink-0 text-white/60" />
                        )}
                        <span className="line-clamp-2">{list.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/65">
                        {list.user?.name} ·{' '}
                        {tr('{n} тайтлів', { n: list.items_count })}
                    </span>
                </span>
            </span>
        </Link>
    );
}
