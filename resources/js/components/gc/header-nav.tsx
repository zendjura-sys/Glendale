import { Link, usePage } from '@inertiajs/react';
import {
    Clapperboard,
    Music,
    Newspaper,
    Server,
    ShieldHalf,
    Zap,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

/**
 * Перемикач головних розділів у шапці-острові (Spatial Arctic): пігулки з іконками Lucide,
 * активна — суцільна плашка з небесним текстом, що плавно перетікає (без руху — миттєво).
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
            icon: Newspaper,
            module: null,
        },
        {
            key: 'families',
            href: '/families',
            label: tr('Сім’ї'),
            icon: ShieldHalf,
            module: 'families',
        },
        {
            key: 'servers',
            href: '/servers',
            label: tr('Сервери'),
            icon: Server,
            module: 'servers',
        },
        {
            key: 'cinema',
            href: '/cinema',
            label: tr('Кіно'),
            icon: Clapperboard,
            module: 'cinema',
        },
        {
            key: 'music',
            href: '/music',
            label: tr('Музика'),
            icon: Music,
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
                'gc-header-nav flex items-center gap-1 rounded-full p-1',
                className,
            )}
        >
            {items.map((item) => (
                <Link
                    key={item.key}
                    href={item.href}
                    title={item.label}
                    prefetch
                    aria-current={active === item.key ? 'page' : undefined}
                    className={cn(
                        'relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                        active === item.key
                            ? 'text-sky-400'
                            : 'text-white/70 hover:text-white',
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
                                          stiffness: 420,
                                          damping: 34,
                                      }
                            }
                            className="gc-header-nav-active absolute inset-0 rounded-full"
                        />
                    )}
                    <item.icon className="relative size-4" />
                    <span className="relative hidden 2xl:inline">
                        {item.label}
                    </span>
                </Link>
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
        <Link
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
        </Link>
    );
}
