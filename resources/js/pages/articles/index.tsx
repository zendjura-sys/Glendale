import { Head, Link } from '@inertiajs/react';
import { Newspaper, PenLine } from 'lucide-react';
import { Pagination } from '@/components/gc/admin';
import { ArticleCardView } from '@/components/articles/article-card';
import type { ArticleCard } from '@/components/articles/article-card';
import { tr } from '@/lib/i18n';
import type { GameCard, Paginated } from '@/types';

type Props = {
    articles: Paginated<ArticleCard>;
    drafts: ArticleCard[];
    game: GameCard | null;
};

/** Стрічка статей: огляди, історії й гайди гравців. */
export default function ArticlesIndex({ articles, drafts, game }: Props) {
    return (
        <>
            <Head title={tr('Статті')} />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                        <Newspaper className="size-6 shrink-0 text-gc-lilac-200" />
                        {game
                            ? tr('Статті про {game}', { game: game.name })
                            : tr('Статті')}
                    </h1>
                    <p className="text-sm text-white/50">
                        {tr('Огляди, історії й гайди від гравців GameCon.')}
                    </p>
                </div>
                <Link
                    href="/articles/create"
                    className="btn-glow inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
                >
                    <PenLine className="size-4" />
                    {tr('Написати статтю')}
                </Link>
            </div>

            {drafts.length > 0 && (
                <section className="glass mb-5 rounded-2xl p-4">
                    <h2 className="mb-2 text-sm font-semibold text-white/70">
                        {tr('Мої чернетки')}
                    </h2>
                    <ul className="divide-y divide-white/[0.06]">
                        {drafts.map((d) => (
                            <li
                                key={d.id}
                                className="flex items-center gap-3 py-2"
                            >
                                <span className="min-w-0 flex-1 text-sm break-words text-white/85">
                                    {d.title}
                                </span>
                                <Link
                                    href={`/articles/${d.slug}/edit`}
                                    className="text-sm text-gc-lilac-200 hover:text-white"
                                >
                                    {tr('Продовжити')}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {articles.data.length === 0 ? (
                <p className="glass rounded-2xl p-6 text-center text-sm text-white/50">
                    {tr('Статей ще немає — напишіть першу.')}
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {articles.data.map((article) => (
                        <ArticleCardView key={article.id} article={article} />
                    ))}
                </div>
            )}
            <Pagination data={articles} />
        </>
    );
}
