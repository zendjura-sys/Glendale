import { Link, usePage } from '@inertiajs/react';
import { PaymentBadges } from '@/components/billing/payment-badges';
import { reopenConsent } from '@/lib/consent';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Наскрізний футер: документи й копірайт.
 * Підписи приходять із сервера (lang/{locale}/ui.php), тож підтримують будь-яку мову.
 */
export function SiteFooter({
    className,
    labels,
    lang,
}: {
    className?: string;
    /** На юридичних сторінках — підписи мовою документа. */
    labels?: Partial<
        Record<
            'terms' | 'privacy' | 'refund' | 'pricing' | 'contacts' | 'rights',
            string
        >
    >;
    /** Мова документа: посилання ведуть на ту саму мову. */
    lang?: string;
}) {
    const { footer, name } = usePage().props;
    const t = { ...footer, ...labels };
    const q = lang ? `?lang=${lang}` : '';
    const links = [
        { href: `/terms${q}`, label: t.terms },
        { href: `/privacy${q}`, label: t.privacy },
        { href: `/refund-policy${q}`, label: t.refund },
        { href: `/pricing${q}`, label: t.pricing },
        { href: `/contacts${q}`, label: t.contacts },
    ];

    return (
        <footer
            className={cn(
                'mt-8 border-t border-white/[0.06] px-4 py-6 text-center text-xs text-white/40',
                className,
            )}
        >
            {/* Посилання переносяться рядками без роздільників (жодних «|» на початку рядка); висота
                рядка 40 px і проміжки між ними — зручно влучити пальцем. */}
            <nav className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-5">
                {links.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex min-h-10 items-center transition hover:text-white"
                    >
                        {link.label}
                    </Link>
                ))}
                <button
                    type="button"
                    onClick={reopenConsent}
                    className="inline-flex min-h-10 items-center transition hover:text-white"
                >
                    {tr('Налаштування cookie')}
                </button>
            </nav>
            <PaymentBadges className="mt-3 justify-center" />
            <p className="mt-2">
                © {footer.year} {name || 'GameCon'}. {t.rights}
            </p>
        </footer>
    );
}
