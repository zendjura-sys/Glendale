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

/** Картка добірки: колаж із чотирьох постерів, назва, автор і лічильники. */
export function ListCard({ list }: { list: MovieListCard }) {
    const posters = [...list.posters, null, null, null, null].slice(0, 4);

    return (
        <Link
            href={`/cinema/lists/${list.id}`}
            className="glass group block overflow-hidden rounded-2xl"
        >
            <div className="grid aspect-[3/1] grid-cols-4 gap-0.5 bg-white/[0.03]">
                {posters.map((poster, i) =>
                    poster ? (
                        <img
                            key={i}
                            src={poster}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover opacity-90 transition group-hover:opacity-100"
                        />
                    ) : (
                        <span key={i} className="bg-white/[0.04]" />
                    ),
                )}
            </div>
            <div className="p-3.5">
                <p className="flex items-center gap-1.5 truncate font-semibold text-white">
                    {!list.is_public && (
                        <Lock className="size-3.5 shrink-0 text-white/45" />
                    )}
                    <span className="truncate">{list.title}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-white/50">
                    {list.user?.name} ·{' '}
                    {tr('{n} тайтлів', { n: list.items_count })}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1">
                        <Heart className="size-3.5" />
                        {list.likes_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {list.followers_count}
                    </span>
                </div>
            </div>
        </Link>
    );
}
