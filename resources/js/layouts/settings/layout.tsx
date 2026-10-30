import { Link } from '@inertiajs/react';
import {
    LifeBuoy,
    MonitorSmartphone,
    Palette,
    PanelBottom,
    ShieldCheck,
    UserRound,
    BadgeCheck,
    Link2,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editNavigation } from '@/routes/navigation';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { PageTransition } from '@/components/gc/page-transition';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';
import { usePlugin } from '@/lib/plugins';

const items = [
    {
        title: tr('Профіль'),
        description: tr("Ім'я, адреса сторінки, про себе"),
        href: edit(),
        icon: UserRound,
    },
    {
        title: tr('Вигляд'),
        description: tr('Палітра, тиша і сповіщення'),
        href: editAppearance(),
        icon: Palette,
    },
    {
        title: tr('Безпека'),
        description: tr('Пароль, 2FA, ключі доступу'),
        href: editSecurity(),
        icon: ShieldCheck,
    },
    {
        title: tr('Акаунт'),
        description: tr('Пристрої, входи, свої дані'),
        href: '/settings/account',
        icon: MonitorSmartphone,
    },
    {
        title: tr('Посилання'),
        description: tr('Своя сторінка /l/нік'),
        href: '/settings/links',
        icon: Link2,
    },
    {
        title: tr('Тип акаунта'),
        description: tr('Спецакаунт, склад, верифікація'),
        href: '/settings/account-type',
        icon: BadgeCheck,
    },
    {
        title: tr('Панель'),
        description: tr('Розділи панелі на телефоні'),
        href: editNavigation(),
        icon: PanelBottom,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const reduce = useReducedMotion();
    const typesPlugin = usePlugin('account_types');
    const verifyPlugin = usePlugin('verification_v2');
    const accountTypesOn = typesPlugin || verifyPlugin;
    const linksOn = usePlugin('bio_links');

    return (
        <div className="mx-auto max-w-[980px]">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold text-white">
                    {tr('Налаштування')}
                </h1>
                <p className="mt-1 text-sm text-white/45">
                    {tr('Керуйте сторінкою, приватністю та безпекою акаунта')}
                    {' · '}
                    <Link
                        href="/help"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                        <LifeBuoy className="size-3.5" />
                        {tr('Довідка')}
                    </Link>
                </p>
            </div>

            <div className="flex flex-col gap-5 md:flex-row">
                <aside className="md:w-[250px] md:shrink-0">
                    <nav
                        className="gc-group scrollbar-none flex gap-1 overflow-x-auto p-1.5 md:sticky md:top-[76px] md:flex-col md:overflow-visible"
                        aria-label={tr('Налаштування')}
                    >
                        {items
                            .filter(
                                (item) =>
                                    (item.href !== '/settings/account-type' ||
                                        accountTypesOn) &&
                                    (item.href !== '/settings/links' ||
                                        linksOn),
                            )
                            .map(({ title, description, href, icon: Icon }) => {
                                const active = isCurrentOrParentUrl(href);

                                return (
                                    <Link
                                        key={toUrl(href)}
                                        href={href}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={cn(
                                            'relative flex flex-1 shrink-0 items-center gap-3 rounded-lg px-2.5 py-2 whitespace-nowrap transition-colors',
                                            active
                                                ? 'text-white'
                                                : 'text-white/60 hover:bg-white/[0.045] hover:text-white',
                                        )}
                                    >
                                        {/* Підсвітка активного розділу «перетікає» між пунктами. */}
                                        {active && (
                                            <m.span
                                                layoutId="settings-nav-active"
                                                transition={motionOr(
                                                    reduce,
                                                    SNAP,
                                                )}
                                                className="absolute inset-0 rounded-lg bg-white/[0.07]"
                                            />
                                        )}
                                        <span
                                            className={cn(
                                                'relative flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                                                active
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-white/[0.05] text-white/50',
                                            )}
                                        >
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="relative min-w-0">
                                            <span className="block text-sm font-medium">
                                                {title}
                                            </span>
                                            <span className="hidden text-xs break-words text-white/35 md:block">
                                                {description}
                                            </span>
                                        </span>
                                    </Link>
                                );
                            })}
                    </nav>
                </aside>

                <PageTransition nested className="min-w-0 flex-1 space-y-7">
                    {children}
                </PageTransition>
            </div>
        </div>
    );
}

/**
 * Група налаштувань у стилі iOS: заголовок і пояснення над нею, під ними — плоска підкладка з
 * радіусом 12px. Усередині — рядки (SettingsRow / SettingsSwitch), розділені тонкими лініями, або
 * довільний вміст (сітки тем, фонів тощо). `list` — група лише з рядків, без внутрішніх відступів.
 */
export function SettingsCard({
    title,
    description,
    children,
    tone = 'default',
    list = false,
}: PropsWithChildren<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    list?: boolean;
}>) {
    return (
        <section>
            <div className="mb-2 px-1">
                <h2
                    className={cn(
                        'text-[15px] font-semibold',
                        tone === 'danger' ? 'text-rose-300' : 'text-white',
                    )}
                >
                    {title}
                </h2>
                {description && (
                    <p className="mt-0.5 text-[13px] leading-snug text-white/50">
                        {description}
                    </p>
                )}
            </div>
            <div
                className={cn(
                    'gc-group',
                    list ? 'px-4 sm:px-5' : 'p-4 sm:p-5',
                    tone === 'danger' && 'gc-group--danger',
                )}
            >
                {children}
            </div>
        </section>
    );
}

/** Список рядків усередині групи з довільним вмістом: тонка лінія зверху, рядки на всю ширину групи. */
export function SettingsRows({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={cn(
                'gc-rows -mx-4 mt-4 border-t px-4 sm:-mx-5 sm:px-5',
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * Рядок налаштування: назва (і підказка) ліворуч, елемент керування праворуч. `stack` — на телефоні
 * поле переноситься під назву (довгі поля вводу), на ширших екранах стоїть праворуч.
 */
export function SettingsRow({
    label,
    hint,
    icon,
    htmlFor,
    stack = false,
    children,
    className,
}: PropsWithChildren<{
    label: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    htmlFor?: string;
    stack?: boolean;
    className?: string;
}>) {
    return (
        <div
            className={cn(
                'gc-row flex min-h-12 gap-x-4 gap-y-2 py-3',
                stack ? 'flex-col sm:flex-row sm:items-center' : 'items-center',
                className,
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[45%]">
                {icon && (
                    <span className="flex shrink-0 text-white/50 [&_svg]:size-[18px]">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <label
                        htmlFor={htmlFor}
                        className="block text-[15px] text-white"
                    >
                        {label}
                    </label>
                    {hint && (
                        <p className="mt-0.5 text-[13px] leading-snug text-white/50">
                            {hint}
                        </p>
                    )}
                </div>
            </div>
            <div
                className={cn(
                    'flex min-w-0 shrink-0 items-center justify-end gap-2',
                    stack && 'w-full sm:w-auto sm:flex-1',
                )}
            >
                {children}
            </div>
        </div>
    );
}

/** Рядок-перемикач: увесь рядок — мітка, перемикач праворуч. */
export function SettingsSwitch({
    label,
    hint,
    icon,
    checked,
    onChange,
    disabled,
}: {
    label: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className="gc-row flex min-h-12 cursor-pointer items-center gap-4 py-3">
            {icon && (
                <span className="flex shrink-0 text-white/50 [&_svg]:size-[18px]">
                    {icon}
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-white">{label}</span>
                {hint && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-white/50">
                        {hint}
                    </span>
                )}
            </span>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                className="gc-switch shrink-0"
            />
        </label>
    );
}
