import { Link } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import { LegalShell } from '@/components/legal/legal-shell';
import type { LegalLabels } from '@/components/legal/legal-shell';

type Props = {
    document: 'terms' | 'privacy' | 'refund';
    title: string;
    html: string;
    locale: string;
    is_master: boolean;
    updated: string;
    labels: LegalLabels;
    translations: { code: string; name: string }[];
};

const PATHS = {
    terms: '/terms',
    privacy: '/privacy',
    refund: '/refund-policy',
} as const;

/**
 * Юридичний документ (Terms / Privacy / Refund). Текст — Blade-шаблон мовою документа
 * (resources/views/legal/{document}/{locale}.blade.php), а шапка — тут:
 * кнопка англійського оригіналу (?lang=en) і застереження, що англійська версія має перевагу.
 */
export default function LegalDocument({
    document,
    title,
    html,
    locale,
    is_master,
    updated,
    labels,
    translations,
}: Props) {
    return (
        <LegalShell
            title={title}
            locale={locale}
            labels={labels}
            languages={translations}
        >
            <article lang={locale} className="glass rounded-3xl p-5 sm:p-8">
                <header className="mb-6 space-y-3 border-b border-white/[0.06] pb-5">
                    <div className="flex flex-wrap items-start gap-3">
                        <h1 className="min-w-0 flex-1 font-display text-2xl font-bold text-white sm:text-3xl">
                            {title}
                        </h1>
                        {!is_master && (
                            <Link
                                href={`${PATHS[document]}?lang=en`}
                                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                <Languages className="size-4" />
                                {labels.view_original}
                            </Link>
                        )}
                    </div>
                    <p className="text-xs text-white/45">
                        {labels.last_updated}: {updated}
                    </p>
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100/90">
                        <p lang="en">{labels.prevail_en}</p>
                        {!is_master && (
                            <p className="mt-1.5 text-amber-100/70">
                                {labels.prevail}
                            </p>
                        )}
                    </div>
                </header>
                {/* Вміст — наш власний Blade-шаблон, без даних користувачів. */}
                <div
                    className="legal-doc"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </article>
        </LegalShell>
    );
}
