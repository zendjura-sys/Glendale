import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { openFeedback } from '@/components/gc/site-extras';
import {
    HelpBlocks,
    HelpContact,
    HelpCrumbs,
    HelpRow,
    HelpShell,
    HelpText,
} from '@/components/help/help-ui';
import type {
    HelpBlock,
    HelpCategoryBrief,
    HelpLinkItem,
} from '@/components/help/help-ui';
import { LOCALE, tr } from '@/lib/i18n';
import { blurSwap } from '@/lib/motion';

type Sibling = { slug: string; title: string } | null;

type Props = {
    category: HelpCategoryBrief;
    article: {
        slug: string;
        title: string;
        summary: string;
        blocks: HelpBlock[];
    };
    related: HelpLinkItem[];
    prev: Sibling;
    next: Sibling;
    voted: 'up' | 'down' | null;
    updated: string;
};

/** Стаття довідки: крихти, кроки, поради, «Чи допомогла стаття?» і пов’язані статті. */
export default function HelpArticle({
    category,
    article,
    related,
    prev,
    next,
    voted,
    updated,
}: Props) {
    const reduce = useReducedMotion();
    const [busy, setBusy] = useState(false);
    const base = `/help/${category.slug}`;
    const headings = article.blocks.flatMap((block, i) =>
        block.type === 'h' ? [{ id: `s-${i}`, text: block.text }] : [],
    );

    const vote = (helpful: boolean) =>
        router.post(
            `${base}/${article.slug}/vote`,
            { helpful },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
            },
        );

    return (
        <HelpShell>
            <Head title={`${article.title} · ${tr('Довідка')}`}>
                <meta name="description" content={article.summary} />
            </Head>
            <HelpCrumbs
                items={[
                    { href: '/help', label: tr('Довідка') },
                    { href: base, label: category.title },
                    { label: article.title },
                ]}
            />

            <article>
                <header className="mb-6">
                    <h1 className="font-display text-[30px] leading-tight font-bold text-white sm:text-[34px]">
                        {article.title}
                    </h1>
                    <p className="mt-2 text-[16px] leading-relaxed text-white/60">
                        <HelpText text={article.summary} />
                    </p>
                </header>
                {headings.length > 1 && (
                    <nav
                        aria-label={tr('Зміст')}
                        className="mb-6 border-l-2 border-primary/40 pl-4"
                    >
                        <p className="mb-1 text-[13px] font-medium text-white/50">
                            {tr('Зміст')}
                        </p>
                        <ul className="space-y-1">
                            {headings.map((h) => (
                                <li key={h.id}>
                                    <a
                                        href={`#${h.id}`}
                                        className="text-[14px] text-white/75 transition hover:text-primary"
                                    >
                                        {h.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
                <HelpBlocks blocks={article.blocks} />
                <p className="mt-6 text-xs text-white/40">
                    {tr('Оновлено')}:{' '}
                    {new Date(updated).toLocaleDateString(LOCALE, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                </p>
            </article>

            <section
                aria-live="polite"
                className="gc-group mt-8 flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3"
            >
                <AnimatePresence mode="wait" initial={false}>
                    {voted ? (
                        <m.p
                            key="thanks"
                            {...blurSwap(reduce)}
                            className="text-[15px] text-white/75"
                        >
                            {voted === 'up'
                                ? tr('Дякуємо! Радіємо, що стаття допомогла.')
                                : tr(
                                      'Дякуємо за відповідь — ми покращимо цю статтю.',
                                  )}
                        </m.p>
                    ) : (
                        <m.div
                            key="ask"
                            {...blurSwap(reduce)}
                            className="flex flex-1 flex-wrap items-center gap-3"
                        >
                            <span className="flex-1 text-[15px] font-medium text-white">
                                {tr('Чи допомогла стаття?')}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => vote(true)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-sm text-white/80 transition hover:bg-primary/15 hover:text-primary disabled:opacity-50"
                                >
                                    <ThumbsUp className="size-4" />
                                    {tr('Так')}
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => vote(false)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-sm text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
                                >
                                    <ThumbsDown className="size-4" />
                                    {tr('Ні')}
                                </button>
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
            </section>

            {related.length > 0 && (
                <section className="mt-10">
                    <h2 className="mb-2 px-1 text-[22px] font-bold text-white">
                        {tr('Схожі статті')}
                    </h2>
                    <div className="gc-group overflow-hidden">
                        {related.map((item) => (
                            <HelpRow
                                key={`${item.category}/${item.slug}`}
                                href={`/help/${item.category}/${item.slug}`}
                                title={item.title}
                                summary={item.summary}
                            />
                        ))}
                    </div>
                </section>
            )}

            {(prev || next) && (
                <nav
                    aria-label={tr('Статті розділу')}
                    className="mt-6 grid gap-2 sm:grid-cols-2"
                >
                    {prev ? (
                        <Link
                            href={`${base}/${prev.slug}`}
                            className="gc-group flex items-center gap-2 px-4 py-3 text-sm text-white/75 transition hover:text-white"
                        >
                            <ChevronLeft className="size-4 shrink-0 text-white/40" />
                            <span className="min-w-0">
                                <span className="block text-xs text-white/40">
                                    {tr('Попередня')}
                                </span>
                                {prev.title}
                            </span>
                        </Link>
                    ) : (
                        <span className="hidden sm:block" />
                    )}
                    {next && (
                        <Link
                            href={`${base}/${next.slug}`}
                            className="gc-group flex items-center justify-end gap-2 px-4 py-3 text-right text-sm text-white/75 transition hover:text-white"
                        >
                            <span className="min-w-0">
                                <span className="block text-xs text-white/40">
                                    {tr('Наступна')}
                                </span>
                                {next.title}
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-white/40" />
                        </Link>
                    )}
                </nav>
            )}

            <HelpContact onFeedback={openFeedback} />
        </HelpShell>
    );
}
