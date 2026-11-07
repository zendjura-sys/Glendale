import { Head, Link } from '@inertiajs/react';
import { openFeedback } from '@/components/gc/site-extras';
import {
    HelpBadge,
    HelpContact,
    HelpCrumbs,
    HelpRow,
    HelpShell,
} from '@/components/help/help-ui';
import type {
    HelpArticleBrief,
    HelpCategoryBrief,
} from '@/components/help/help-ui';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    category: HelpCategoryBrief & { articles: HelpArticleBrief[] };
    categories: HelpCategoryBrief[];
};

/** Розділ довідки: статті розділу й перемикач інших розділів. */
export default function HelpCategory({ category, categories }: Props) {
    return (
        <HelpShell>
            <Head title={`${category.title} · ${tr('Довідка')}`}>
                <meta name="description" content={category.summary} />
            </Head>
            <HelpCrumbs
                items={[
                    { href: '/help', label: tr('Довідка') },
                    { label: category.title },
                ]}
            />
            <header className="mb-6 flex items-start gap-3">
                <HelpBadge name={category.icon} className="mt-1.5 size-11" />
                <div className="min-w-0">
                    <h1 className="font-display text-[30px] leading-tight font-bold text-white sm:text-[34px]">
                        {category.title}
                    </h1>
                    <p className="mt-1 text-[15px] text-white/55">
                        {category.summary}
                    </p>
                </div>
            </header>

            <div className="gc-group overflow-hidden">
                {category.articles.map((article) => (
                    <HelpRow
                        key={article.slug}
                        href={`/help/${category.slug}/${article.slug}`}
                        title={article.title}
                        summary={article.summary}
                    />
                ))}
            </div>

            <section className="mt-10">
                <h2 className="mb-2 px-1 text-[13px] font-medium text-white/50">
                    {tr('Інші розділи')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                        <Link
                            key={c.slug}
                            href={`/help/${c.slug}`}
                            aria-current={
                                c.slug === category.slug ? 'page' : undefined
                            }
                            className={cn(
                                'inline-flex h-9 items-center rounded-lg px-3 text-sm transition',
                                c.slug === category.slug
                                    ? 'bg-primary/15 font-medium text-primary'
                                    : 'bg-white/[0.04] text-white/65 hover:text-white',
                            )}
                        >
                            {c.title}
                        </Link>
                    ))}
                </div>
            </section>

            <HelpContact onFeedback={openFeedback} />
        </HelpShell>
    );
}
