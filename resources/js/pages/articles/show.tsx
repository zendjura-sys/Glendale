import { Head, Link, router } from '@inertiajs/react';
import { Clock3, Eye, ListTree, PenLine, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ArticleCardView } from '@/components/articles/article-card';
import type { ArticleCard } from '@/components/articles/article-card';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    article: ArticleCard & {
        html: string;
        toc: { level: number; text: string; id: string }[];
    };
    can_edit: boolean;
    can_delete: boolean;
    more: ArticleCard[];
};

/** Читання статті: обкладинка, автор, зміст за заголовками (збоку на комп’ютері) і текст. */
export default function ArticleShow({
    article,
    can_edit,
    can_delete,
    more,
}: Props) {
    const share = async () => {
        const url = window.location.href;
        if (navigator.share) {
            await navigator
                .share({ title: article.title, url })
                .catch(() => undefined);
        } else {
            await navigator.clipboard.writeText(url);
            toast(tr('Посилання скопійовано'));
        }
    };

    return (
        <>
            <Head title={article.title} />
            <article className="glass overflow-hidden rounded-2xl">
                {article.cover && (
                    <img
                        src={article.cover}
                        alt=""
                        className="aspect-[21/9] w-full object-cover"
                    />
                )}
                <div className="p-5 sm:p-8">
                    {!article.is_published && (
                        <span className="mb-3 inline-block rounded-chip bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                            {tr('Чернетка — бачите лише ви')}
                        </span>
                    )}
                    {article.game && (
                        <Link
                            href={`/articles?game=${article.game.slug}`}
                            className="text-sm font-medium text-gc-lilac-200 hover:text-white"
                        >
                            {article.game.name}
                        </Link>
                    )}
                    <h1 className="mt-1 font-display text-3xl leading-tight font-bold break-words text-white sm:text-4xl">
                        {article.title}
                    </h1>
                    {article.excerpt && (
                        <p className="mt-3 text-lg text-white/65">
                            {article.excerpt}
                        </p>
                    )}
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-white/[0.07] pb-5 text-sm text-white/55">
                        <Link
                            href={`/${article.user.username}`}
                            className="flex items-center gap-2 text-white/85 hover:text-white"
                        >
                            <UserAvatar
                                user={article.user}
                                size="sm"
                                showOnline={false}
                            />
                            {article.user.name}
                        </Link>
                        {article.published_at && (
                            <span>{formatDate(article.published_at)}</span>
                        )}
                        <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-4" />
                            {tr('{n} хв читання', {
                                n: article.reading_minutes,
                            })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Eye className="size-4" />
                            {article.views_count}
                        </span>
                        <span className="ml-auto flex gap-1">
                            <button
                                type="button"
                                onClick={() => void share()}
                                className="rounded-lg p-2 hover:bg-white/10 hover:text-white"
                                aria-label={tr('Поділитися')}
                                title={tr('Поділитися')}
                            >
                                <Share2 className="size-4" />
                            </button>
                            {can_edit && (
                                <Link
                                    href={`/articles/${article.slug}/edit`}
                                    className="rounded-lg p-2 hover:bg-white/10 hover:text-white"
                                    aria-label={tr('Редагувати')}
                                    title={tr('Редагувати')}
                                >
                                    <PenLine className="size-4" />
                                </Link>
                            )}
                            {can_delete && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        confirm(
                                            tr('Видалити статтю назавжди?'),
                                        ) &&
                                        router.delete(
                                            `/articles/${article.slug}`,
                                        )
                                    }
                                    className="rounded-lg p-2 hover:bg-white/10 hover:text-rose-300"
                                    aria-label={tr('Видалити')}
                                    title={tr('Видалити')}
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            )}
                        </span>
                    </div>

                    <div
                        className={cn(
                            'mt-6 flex flex-col gap-6 lg:gap-8',
                            article.toc.length > 2 &&
                                'lg:grid lg:grid-cols-[1fr_220px]',
                        )}
                    >
                        <div
                            className="gc-article min-w-0"
                            dangerouslySetInnerHTML={{ __html: article.html }}
                        />
                        {article.toc.length > 2 && (
                            <nav
                                aria-label={tr('Зміст')}
                                className="order-first rounded-2xl bg-white/[0.03] p-4 lg:sticky lg:top-24 lg:order-last lg:self-start"
                            >
                                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/50">
                                    <ListTree className="size-4" />
                                    {tr('Зміст')}
                                </p>
                                <ol className="space-y-1.5 text-sm">
                                    {article.toc.map((item) => (
                                        <li
                                            key={item.id}
                                            className={
                                                item.level === 3 ? 'pl-3' : ''
                                            }
                                        >
                                            <a
                                                href={`#${item.id}`}
                                                className="block break-words text-white/65 hover:text-white"
                                            >
                                                {item.text}
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </nav>
                        )}
                    </div>
                </div>
            </article>

            {more.length > 0 && (
                <section className="mt-6">
                    <h2 className="mb-3 font-display text-lg font-semibold text-white">
                        {tr('Ще від автора')}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {more.map((a) => (
                            <ArticleCardView key={a.id} article={a} />
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
