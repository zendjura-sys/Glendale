import { Link, usePage } from '@inertiajs/react';
import { PaymentBadges } from '@/components/billing/payment-badges';
import { LogoMark } from '@/components/gc/logo';
import { reopenConsent } from '@/lib/consent';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** «Публічна оферта (договір про надання…)» → «Публічна оферта»: у футері — коротко, повна назва на сторінці. */
function short(label: string | undefined): string {
    return (label ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
}

/**
 * Наскрізний футер: бренд, дві колонки посилань за змістом («Сервіс» і «Документи»),
 * способи оплати й копірайт. Підписи документів приходять із сервера (lang/{locale}/ui.php).
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
    const groups: {
        title: string;
        links: { href: string; label: string }[];
    }[] = [
        {
            title: tr('Сервіс'),
            links: [
                { href: '/help', label: tr('Довідка') },
                { href: `/pricing${q}`, label: short(t.pricing) },
                { href: `/contacts${q}`, label: short(t.contacts) },
                { href: '/developers', label: tr('Розробникам') },
                { href: '/transparency', label: tr('Звіт прозорості') },
            ],
        },
        {
            title: tr('Документи'),
            links: [
                { href: `/terms${q}`, label: short(t.terms) },
                { href: `/privacy${q}`, label: short(t.privacy) },
                { href: `/refund-policy${q}`, label: short(t.refund) },
                {
                    href: `/child-safety${q}`,
                    label: short(t.child_safety),
                },
            ],
        },
    ];
    const link =
        'flex min-h-10 items-center py-1 text-[13px] leading-snug text-white/55 transition hover:text-white';

    return (
        <footer
            className={cn(
                'mt-8 px-5 py-6 text-left text-xs text-white/40',
                className,
            )}
        >
            <div className="mx-auto max-w-3xl">
                <div className="flex items-center gap-2.5">
                    <LogoMark className="size-8 rounded-lg" />
                    <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-white">
                            {name || 'GameCon'}
                        </p>
                        <p className="text-xs text-white/45">
                            {tr('Соцмережа для геймерів')}
                        </p>
                    </div>
                </div>

                {/* Дві колонки навіть на телефоні: ліве вирівнювання, рядки по 40 px — легко влучити пальцем. */}
                <nav
                    aria-label={tr('Посилання футера')}
                    className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-[repeat(2,minmax(0,14rem))]"
                >
                    {groups.map((group) => (
                        <div key={group.title}>
                            <p className="mb-1 text-[11px] font-semibold text-white/35">
                                {group.title}
                            </p>
                            <ul>
                                {group.links.map((item) => (
                                    <li key={item.href}>
                                        <Link href={item.href} className={link}>
                                            {item.label}
                                        </Link>
                                    </li>
                                ))}
                                {group.title === tr('Документи') && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={reopenConsent}
                                            className={link}
                                        >
                                            {tr('Налаштування cookie')}
                                        </button>
                                    </li>
                                )}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="mt-5 border-t border-white/[0.07] pt-4">
                    <PaymentBadges className="gap-1.5 [&>li]:h-7 [&>li]:min-w-10 [&>li]:px-2" />
                    <p className="mt-3 text-xs text-white/40">
                        © {footer.year} {name || 'GameCon'}. {t.rights}
                    </p>
                </div>
            </div>
        </footer>
    );
}
