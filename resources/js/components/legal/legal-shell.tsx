import { Head, Link, router } from '@inertiajs/react';
import { Globe2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Aurora } from '@/components/gc/aurora';
import { Logo } from '@/components/gc/logo';
import { SiteFooter } from '@/components/gc/site-footer';

export type LegalLabels = {
    terms: string;
    privacy: string;
    refund: string;
    pricing: string;
    view_original: string;
    prevail: string;
    prevail_en: string;
    last_updated: string;
    language: string;
    rights: string;
};

/**
 * Оболонка юридичних сторінок і тарифів: відкрита без входу, з логотипом, перемикачем мови й футером.
 */
export function LegalShell({
    title,
    locale,
    labels,
    languages,
    children,
}: {
    title: string;
    locale: string;
    labels: LegalLabels;
    languages?: { code: string; name: string }[];
    children: ReactNode;
}) {
    return (
        <>
            <Head title={title}>
                <meta name="robots" content="index,follow" />
            </Head>
            <Aurora />
            <div className="relative mx-auto min-h-dvh max-w-3xl px-4 pt-6 pb-4 sm:pt-10">
                <header className="mb-6 flex items-center gap-3">
                    <Link href="/" aria-label="GameCon">
                        <Logo />
                    </Link>
                    {languages && languages.length > 1 && (
                        <label className="ml-auto flex items-center gap-2 text-xs text-white/50">
                            <Globe2 className="size-4" />
                            <span className="sr-only">{labels.language}</span>
                            <select
                                value={locale}
                                onChange={(event) =>
                                    router.get(
                                        window.location.pathname,
                                        { lang: event.target.value },
                                        { preserveScroll: false },
                                    )
                                }
                                className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-sm text-white"
                            >
                                {languages.map((l) => (
                                    <option key={l.code} value={l.code}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </header>
                <main id="main-content">{children}</main>
                <SiteFooter
                    lang={locale}
                    labels={{
                        terms: labels.terms,
                        privacy: labels.privacy,
                        refund: labels.refund,
                        pricing: labels.pricing,
                        rights: labels.rights,
                    }}
                />
            </div>
        </>
    );
}
