import { Link, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';

/**
 * Наскрізний футер: документи, копірайт і рядок про Paddle (Merchant of Record).
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
            'terms' | 'privacy' | 'refund' | 'pricing' | 'rights' | 'paddle',
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
    ];

    return (
        <footer
            className={cn(
                'mt-8 border-t border-white/[0.06] px-4 py-6 text-center text-xs text-white/40',
                className,
            )}
        >
            <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                {links.map((link, i) => (
                    <span key={link.href} className="flex items-center gap-x-1">
                        {i > 0 && <span aria-hidden>|</span>}
                        <Link
                            href={link.href}
                            className="rounded px-1 transition hover:text-white"
                        >
                            {link.label}
                        </Link>
                    </span>
                ))}
            </nav>
            <p className="mt-2">
                © {footer.year} {name || 'GameCon'}. {t.rights}
            </p>
            <p className="mt-1">{t.paddle}</p>
        </footer>
    );
}
