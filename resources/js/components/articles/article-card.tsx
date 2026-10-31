import { Link } from '@inertiajs/react';
import { Clock3, Eye } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { GameCard, UserCard } from '@/types';

export type ArticleCard = {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    cover: string | null;
    reading_minutes: number;
    views_count: number;
    is_published: boolean;
    published_at: string | null;
    user: UserCard;
    game: GameCard | null;
};

/** Картка статті у стрічці статей і «Ще від автора». */
export function ArticleCardView({ article }: { article: ArticleCard }) {
    return (
        <Link
            href={`/articles/${article.slug}`}
            className="glass group flex flex-col overflow-hidden rounded-2xl transition hover:bg-white/[0.06]"
        >
            {article.cover ? (
                <img
                    src={article.cover}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/9] w-full object-cover"
                />
            ) : (
                <div className="aspect-[16/9] w-full bg-[radial-gradient(circle_at_25%_30%,rgba(99,102,241,.45),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,.25),transparent_55%)]" />
            )}
            <div className="flex flex-1 flex-col gap-2 p-4">
                {article.game && (
                    <span className="text-xs font-medium text-gc-lilac-200">
                        {article.game.name}
                    </span>
                )}
                <h2 className="font-display text-lg leading-snug font-semibold break-words text-white">
                    {article.title}
                </h2>
                {article.excerpt && (
                    <p className="line-clamp-3 text-sm text-white/55">
                        {article.excerpt}
                    </p>
                )}
                <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-white/45">
                    <UserAvatar
                        user={article.user}
                        size="xs"
                        showOnline={false}
                    />
                    <span className="min-w-0 flex-1 break-words">
                        {article.user.name}
                        {article.published_at &&
                            ` · ${formatDate(article.published_at, false)}`}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        {tr('{n} хв', { n: article.reading_minutes })}
                    </span>
                    {article.views_count > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <Eye className="size-3.5" />
                            {article.views_count}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
