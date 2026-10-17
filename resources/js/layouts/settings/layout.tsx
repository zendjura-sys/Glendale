import { Link } from '@inertiajs/react';
import {
    MonitorSmartphone,
    Palette,
    PanelBottom,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { PropsWithChildren } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editNavigation } from '@/routes/navigation';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { PageTransition } from '@/components/gc/page-transition';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';

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
        title: tr('Панель'),
        description: tr('Розділи панелі на телефоні'),
        href: editNavigation(),
        icon: PanelBottom,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const reduce = useReducedMotion();

    return (
        <div className="mx-auto max-w-[980px]">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold text-white">
                    {tr('Налаштування')}
                </h1>
                <p className="mt-1 text-sm text-white/45">
                    {tr('Керуйте сторінкою, приватністю та безпекою акаунта')}
                </p>
            </div>

            <div className="flex flex-col gap-5 md:flex-row">
                <aside className="md:w-[250px] md:shrink-0">
                    <nav
                        className="glass scrollbar-none flex gap-1 overflow-x-auto rounded-2xl p-2 md:sticky md:top-[76px] md:flex-col md:overflow-visible"
                        aria-label={tr('Налаштування')}
                    >
                        {items.map(
                            ({ title, description, href, icon: Icon }) => {
                                const active = isCurrentOrParentUrl(href);

                                return (
                                    <Link
                                        key={toUrl(href)}
                                        href={href}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={cn(
                                            'relative flex flex-1 shrink-0 items-center gap-3 rounded-xl px-2.5 py-2 whitespace-nowrap transition-colors',
                                            active
                                                ? 'text-white'
                                                : 'text-white/60 hover:bg-white/[0.045] hover:text-white',
                                        )}
                                    >
                                        {/* Підсвітка активного розділу «перетікає» між пунктами. */}
                                        {active && (
                                            <motion.span
                                                layoutId="settings-nav-active"
                                                transition={motionOr(
                                                    reduce,
                                                    SNAP,
                                                )}
                                                className="absolute inset-0 rounded-xl bg-white/[0.07] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
                                            />
                                        )}
                                        <span
                                            className={cn(
                                                'relative flex size-8 shrink-0 items-center justify-center rounded-[10px] transition-colors',
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
                                            <span className="hidden truncate text-xs text-white/35 md:block">
                                                {description}
                                            </span>
                                        </span>
                                    </Link>
                                );
                            },
                        )}
                    </nav>
                </aside>

                <PageTransition nested className="min-w-0 flex-1 space-y-5">
                    {children}
                </PageTransition>
            </div>
        </div>
    );
}

export function SettingsCard({
    title,
    description,
    children,
    tone = 'default',
}: PropsWithChildren<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
}>) {
    return (
        <div
            className={cn(
                'glass rounded-3xl p-6 sm:p-7',
                tone === 'danger' && 'border-rose-400/15 bg-rose-500/[0.03]',
            )}
        >
            <div className="mb-6">
                <h2
                    className={cn(
                        'text-[17px] font-semibold',
                        tone === 'danger' ? 'text-rose-200' : 'text-white',
                    )}
                >
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 text-sm text-white/45">{description}</p>
                )}
            </div>
            {children}
        </div>
    );
}
