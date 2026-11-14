import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    Code2,
    Cookie,
    FileText,
    LifeBuoy,
    Lock,
    Mail,
    RotateCcw,
    ShieldCheck,
    Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
    // Кнопки з іконкою й коротким підписом (повні назви документів — на самих сторінках).
    const groups: {
        title: string;
        links: {
            href?: string;
            label: string;
            icon: LucideIcon;
            onClick?: () => void;
        }[];
    }[] = [
        {
            title: tr('Сервіс'),
            links: [
                { href: '/help', label: tr('Довідка'), icon: LifeBuoy },
                { href: `/pricing${q}`, label: short(t.pricing), icon: Tag },
                { href: `/contacts${q}`, label: short(t.contacts), icon: Mail },
                { href: '/developers', label: tr('Розробникам'), icon: Code2 },
                {
                    href: '/transparency',
                    label: tr('Прозорість'),
                    icon: BarChart3,
                },
            ],
        },
        {
            title: tr('Документи'),
            links: [
                { href: `/terms${q}`, label: tr('Оферта'), icon: FileText },
                {
                    href: `/privacy${q}`,
                    label: tr('Конфіденційність'),
                    icon: Lock,
                },
                {
                    href: `/refund-policy${q}`,
                    label: tr('Повернення коштів'),
                    icon: RotateCcw,
                },
                {
                    href: `/child-safety${q}`,
                    label: tr('Безпека дітей'),
                    icon: ShieldCheck,
                },
                { label: tr('Cookie'), icon: Cookie, onClick: reopenConsent },
            ],
        },
    ];
    const button =
        'flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 text-left text-[13px] font-medium text-white/80 ring-1 ring-white/[0.07] transition ring-inset hover:bg-white/[0.08] hover:text-white active:scale-[0.98] [html[data-theme=light]_&]:bg-black/[0.03] [html[data-theme=light]_&]:ring-black/[0.06]';

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
                    className="mt-5 grid grid-cols-2 gap-x-2 gap-y-4 sm:max-w-xl sm:gap-x-4"
                >
                    {groups.map((group) => (
                        <div key={group.title}>
                            <p className="mb-2 px-1 text-[11px] font-semibold text-white/40">
                                {group.title}
                            </p>
                            <ul className="grid gap-1.5">
                                {group.links.map((item) => {
                                    const Icon = item.icon;
                                    const inner = (
                                        <>
                                            <Icon className="size-4 shrink-0 text-primary/80" />
                                            <span className="min-w-0 truncate">
                                                {item.label}
                                            </span>
                                        </>
                                    );

                                    return (
                                        <li key={item.label}>
                                            {item.href ? (
                                                <Link
                                                    href={item.href}
                                                    className={button}
                                                >
                                                    {inner}
                                                </Link>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={item.onClick}
                                                    className={button}
                                                >
                                                    {inner}
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
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
