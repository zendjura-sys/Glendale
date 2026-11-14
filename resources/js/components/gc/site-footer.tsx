import { Link, usePage } from "@inertiajs/react";
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
    Smartphone,
    Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PaymentBadges } from "@/components/billing/payment-badges";
import { LogoMark } from "@/components/gc/logo";
import { reopenConsent } from "@/lib/consent";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** «Публічна оферта (договір про надання…)» → «Публічна оферта»: у футері — коротко, повна назва на сторінці. */
function short(label: string | undefined): string {
    return (label ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
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
            "terms" | "privacy" | "refund" | "pricing" | "contacts" | "rights",
            string
        >
    >;
    /** Мова документа: посилання ведуть на ту саму мову. */
    lang?: string;
}) {
    const { footer, name, site } = usePage().props;
    const t = { ...footer, ...labels };
    const q = lang ? `?lang=${lang}` : "";
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
            title: tr("Сервіс"),
            links: [
                { href: "/help", label: tr("Довідка"), icon: LifeBuoy },
                { href: `/pricing${q}`, label: short(t.pricing), icon: Tag },
                { href: `/contacts${q}`, label: short(t.contacts), icon: Mail },
                { href: "/developers", label: tr("Розробникам"), icon: Code2 },
                {
                    href: "/transparency",
                    label: tr("Прозорість"),
                    icon: BarChart3,
                },
            ],
        },
        {
            title: tr("Документи"),
            links: [
                { href: `/terms${q}`, label: tr("Оферта"), icon: FileText },
                {
                    href: `/privacy${q}`,
                    label: tr("Конфіденційність"),
                    icon: Lock,
                },
                {
                    href: `/refund-policy${q}`,
                    label: tr("Повернення коштів"),
                    icon: RotateCcw,
                },
                {
                    href: `/child-safety${q}`,
                    label: tr("Безпека дітей"),
                    icon: ShieldCheck,
                },
                { label: tr("Cookie"), icon: Cookie, onClick: reopenConsent },
            ],
        },
    ];
    const button =
        "flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 text-left text-[13px] font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98] [html[data-theme=light]_&]:bg-black/[0.04]";

    return (
        <footer
            className={cn(
                "mt-8 px-5 py-6 text-left text-xs text-white/40",
                className,
            )}
        >
            <div className="mx-auto max-w-3xl">
                {/* Бренд: знак без важкого світіння, назва й підпис одним блоком; праворуч — застосунок. */}
                <div className="flex items-center gap-3">
                    <LogoMark className="size-11 drop-shadow-[0_2px_8px_rgb(0_150_255/0.22)]" />
                    <div className="min-w-0 flex-1 leading-tight">
                        <p className="font-display text-[15px] font-bold tracking-tight text-white">
                            {name || "GameCon"}
                        </p>
                        <p className="mt-0.5 text-xs text-white/50">
                            {tr("Соцмережа для геймерів")}
                        </p>
                    </div>
                    <Link
                        href="/app"
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] hover:text-white [html[data-theme=light]_&]:bg-black/[0.04]"
                    >
                        <Smartphone className="size-3.5 text-primary" />
                        {tr("Застосунок")}
                    </Link>
                </div>

                {/* Дві колонки навіть на телефоні: ліве вирівнювання, рядки по 40 px — легко влучити пальцем. */}
                <nav
                    aria-label={tr("Посилання футера")}
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
                    <PaymentBadges className="justify-center gap-1.5 [&>li]:h-7 [&>li]:min-w-10 [&>li]:px-2" />
                    <p className="mt-3 text-center text-xs text-white/40">
                        © {footer.year} {name || "GameCon"}. {t.rights}
                    </p>
                    {site.release && (
                        <p className="mt-1 text-center text-[11px] text-white/30">
                            v{site.release.version} · {site.release.codename}
                        </p>
                    )}
                </div>
            </div>
        </footer>
    );
}
