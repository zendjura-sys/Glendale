import { Head } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { openFeedback } from '@/components/gc/site-extras';
import {
    HelpBadge,
    HelpContact,
    HelpRow,
    HelpShell,
    plainText,
} from '@/components/help/help-ui';
import type {
    HelpArticleBrief,
    HelpCategoryBrief,
    HelpLinkItem,
} from '@/components/help/help-ui';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { blurSwap } from '@/lib/motion';

type Props = {
    categories: (HelpCategoryBrief & { articles: HelpArticleBrief[] })[];
    popular: HelpLinkItem[];
};

const norm = (s: string) =>
    plainText(s)
        .toLocaleLowerCase()
        .replace(/[’'ʼ]/g, '’');

/** Головна довідки: пошук по статтях (у браузері), популярне й розділи. */
export default function HelpIndex({ categories, popular }: Props) {
    const [query, setQuery] = useState('');
    const reduce = useReducedMotion();
    const terms = norm(query).split(/\s+/).filter(Boolean);

    const results = useMemo(() => {
        if (terms.length === 0) return [];

        return categories.flatMap((category) =>
            category.articles
                .filter((article) => {
                    const hay = norm(
                        `${article.title} ${article.summary} ${category.title}`,
                    );

                    return terms.every((t) => hay.includes(t));
                })
                .map((article) => ({ category, article })),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories, terms.join(' ')]);

    return (
        <HelpShell>
            <Head title={tr('Довідка')} />
            <header className="mb-6">
                <h1 className="font-display text-[34px] leading-tight font-bold text-white">
                    {tr('Довідка')}
                </h1>
                <p className="mt-1 text-[15px] text-white/55">
                    {tr(
                        'Як користуватися GameCon: від першого входу до музики, кіно й кланів.',
                    )}
                </p>
            </header>

            <div className="relative mb-8">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-white/40" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tr('Пошук у довідці')}
                    aria-label={tr('Пошук у довідці')}
                    className="input-glass h-12 w-full rounded-xl pr-11 pl-10 text-[15px] text-white placeholder:text-white/40"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label={tr('Очистити')}
                        className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait" initial={false}>
                {terms.length > 0 ? (
                    <m.section key="results" {...blurSwap(reduce)}>
                        <h2 className="mb-2 px-1 text-[13px] font-medium text-white/50">
                            {results.length > 0
                                ? `${tr('Знайдено')}: ${results.length} ${plural(
                                      results.length,
                                      ['стаття', 'статті', 'статей'],
                                  )}`
                                : tr('Нічого не знайдено')}
                        </h2>
                        {results.length > 0 ? (
                            <div className="gc-group overflow-hidden">
                                {results.map(({ category, article }) => (
                                    <HelpRow
                                        key={`${category.slug}/${article.slug}`}
                                        href={`/help/${category.slug}/${article.slug}`}
                                        title={article.title}
                                        summary={article.summary}
                                        icon={
                                            <HelpBadge name={category.icon} />
                                        }
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="px-1 text-sm text-white/50">
                                {tr(
                                    'Спробуйте інше слово — або напишіть нам, і ми допоможемо.',
                                )}
                            </p>
                        )}
                    </m.section>
                ) : (
                    <m.div key="home" {...blurSwap(reduce)}>
                        {popular.length > 0 && (
                            <section className="mb-8">
                                <h2 className="mb-2 px-1 text-[22px] font-bold text-white">
                                    {tr('Популярне')}
                                </h2>
                                <div className="gc-group overflow-hidden">
                                    {popular.map((item) => (
                                        <HelpRow
                                            key={`${item.category}/${item.slug}`}
                                            href={`/help/${item.category}/${item.slug}`}
                                            title={item.title}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        <section>
                            <h2 className="mb-2 px-1 text-[22px] font-bold text-white">
                                {tr('Розділи')}
                            </h2>
                            <div className="gc-group overflow-hidden">
                                {categories.map((category) => (
                                    <HelpRow
                                        key={category.slug}
                                        href={`/help/${category.slug}`}
                                        title={category.title}
                                        summary={category.summary}
                                        meta={String(category.articles.length)}
                                        icon={
                                            <HelpBadge name={category.icon} />
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    </m.div>
                )}
            </AnimatePresence>

            <HelpContact onFeedback={openFeedback} />
        </HelpShell>
    );
}
