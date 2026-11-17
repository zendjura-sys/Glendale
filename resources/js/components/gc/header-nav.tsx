import { usePage } from '@inertiajs/react';
import { Zap } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ModuleIcon } from '@/components/gc/module-icon';
import { PrefetchLink } from '@/components/gc/prefetch-link';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

/**
 * Перемикач головних розділів у шапці-острові (iOS 27+ Liquid Glass / 21st Nimbus):
 * пігулки з ModuleIcon, активна — водяна крапля з morphing layoutId.
 */
export function HeaderNav({ className }: { className?: string }) {
    const { modules } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const reduce = useReducedMotion();
    const items = [
        {
            key: 'feed',
            href: '/feed',
            label: tr('Стрічка'),
            icon: 'newspaper',
            module: null,
        },
        {
            key: 'families',
            href: '/families',
            label: tr('Сім’ї'),
            icon: 'crown',
            module: 'families',
        },
        {
            key: 'servers',
            href: '/servers',
            label: tr('Сервери'),
            icon: 'server',
            module: 'servers',
        },
        {
            key: 'cinema',
            href: '/cinema',
            label: tr('Кіно'),
            icon: 'clapperboard',
            module: 'cinema',
        },
        {
            key: 'music',
            href: '/music',
            label: tr('Музика'),
            icon: 'music',
            module: 'music',
        },
    ].filter((i) => i.module === null || modules.includes(i.module));
    const active = items.find(
        (i) =>
            currentUrl === i.href ||
            currentUrl.startsWith(`${i.href}/`) ||
            currentUrl.startsWith(`${i.href}?`),
    )?.key;

    return (
        <nav
            aria-label={tr('Головні розділи')}
            className={cn(
                'gc-header-nav gc-liquid-glass-inner flex items-center gap-0.5 rounded-full p-1',
                className,
            )}
        >
            {items.map((item) => (
                <PrefetchLink
                    key={item.key}
                    kind="nav"
                    href={item.href}
                    title={item.label}
                    aria-current={active === item.key ? 'page' : undefined}
                    className={cn(
                        'relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                        active === item.key
                            ? 'text-[var(--gc-liquid-fg)]'
                            : 'text-[var(--gc-liquid-fg-soft)] hover:text-[var(--gc-liquid-fg)]',
                    )}
                >
                    {active === item.key && (
                        <m.span
                            layoutId="gc-header-nav"
                            transition={
                                reduce
                                    ? { duration: 0 }
                                    : {
                                          type: 'spring',
                                          stiffness: 380,
                                          damping: 32,
                                          mass: 0.85,
                                      }
                            }
                            className="gc-header-nav-active gc-liquid-drop absolute inset-0 rounded-full"
                            aria-hidden
                        />
                    )}
                    <ModuleIcon
                        name={item.icon}
                        animated
                        size={16}
                        className="relative"
                    />
                    <span className="relative hidden 2xl:inline">
                        {item.label}
                    </span>
                </PrefetchLink>
            ))}
        </nav>
    );
}

/** Індикатор «Готові грати»: зелена крапка, коли ви або друзі готові зараз; дотик — до стрічки. */
export function ReadyIndicator() {
    const on = usePlugin('ready_to_play');
    const [state, setState] = useState<{
        mine: unknown;
        friends: unknown[];
    } | null>(null);

    useEffect(() => {
        if (!on) return;
        void api<{ mine: unknown; friends: unknown[] }>('GET', '/ready')
            .then(setState)
            .catch(() => undefined);
    }, [on]);

    if (!on || state === null) return null;
    const count = state.friends.length + (state.mine ? 1 : 0);

    return (
        <PrefetchLink
            kind="nav"
            href="/feed#ready"
            title={tr('Готові грати зараз')}
            className="gc-icon-button hidden h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:flex"
        >
            <Zap
                className={cn('size-4', count > 0 ? 'text-emerald-400' : '')}
            />
            {count > 0 && (
                <span className="text-emerald-400 tabular-nums">{count}</span>
            )}
        </PrefetchLink>
    );
}
