import { router, usePage } from '@inertiajs/react';
import {
    Bell,
    Bookmark,
    CornerDownLeft,
    Keyboard,
    MessageCircle,
    PanelRight,
    PenSquare,
    Search,
    Settings,
    User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModuleIcon } from '@/components/gc/module-icon';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Command = {
    id: string;
    label: string;
    hint?: string;
    icon?: LucideIcon;
    module?: string;
    run: () => void;
};

type Hit = { kind: string; title: string; hint: string; href: string };

/** Подія, якою інші частини сайту відкривають палітру (напр. кнопка в шапці). */
export const PALETTE_EVENT = 'gc:palette';

/**
 * Палітра команд (Ctrl+K / ⌘K): перехід у розділи, дії й пошук людей, ігор, спільнот — з клавіатури.
 */
export function CommandPalette() {
    const { nav, auth } = usePage().props;
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [hits, setHits] = useState<Hit[]>([]);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setOpen((v) => !v);
            }
        };
        const onOpen = () => setOpen(true);
        window.addEventListener('keydown', onKey, true);
        window.addEventListener(PALETTE_EVENT, onOpen);

        return () => {
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener(PALETTE_EVENT, onOpen);
        };
    }, []);

    useEffect(() => {
        if (open) {
            setQuery('');
            setActive(0);
            setHits([]);
            requestAnimationFrame(() => input.current?.focus());
        }
    }, [open]);

    const go = (href: string) => () => {
        setOpen(false);
        router.visit(href);
    };

    const commands = useMemo<Command[]>(() => {
        const username = auth.user?.username ?? '';

        return [
            {
                id: 'post',
                label: tr('Новий запис'),
                icon: PenSquare,
                run: () => {
                    setOpen(false);
                    router.visit('/feed', {
                        onFinish: () =>
                            document
                                .querySelector<HTMLTextAreaElement>(
                                    '#main-content textarea',
                                )
                                ?.focus(),
                    });
                },
            },
            {
                id: 'me',
                label: tr('Моя сторінка'),
                icon: User,
                run: go(`/${username}`),
            },
            {
                id: 'messages',
                label: tr('Повідомлення'),
                icon: MessageCircle,
                run: go('/messages'),
            },
            {
                id: 'notifications',
                label: tr('Сповіщення'),
                icon: Bell,
                run: go('/notifications'),
            },
            {
                id: 'saved',
                label: tr('Збережене'),
                icon: Bookmark,
                run: go('/saved'),
            },
            ...(nav ?? []).map((item) => ({
                id: `nav-${item.key}`,
                label: item.label,
                module: item.icon,
                run: go(item.href),
            })),
            {
                id: 'settings',
                label: tr('Налаштування'),
                icon: Settings,
                run: go('/settings/profile'),
            },
            {
                id: 'split',
                label: tr('Розділити екран'),
                hint: tr('Чат чи музика поруч'),
                icon: PanelRight,
                run: () => {
                    setOpen(false);
                    window.dispatchEvent(
                        new CustomEvent('gc:split', { detail: '/messages' }),
                    );
                },
            },
            {
                id: 'keys',
                label: tr('Гарячі клавіші'),
                icon: Keyboard,
                run: () => {
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent('gc:shortcuts'));
                },
            },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nav, auth.user?.username]);

    const q = query.trim().toLowerCase();
    const matched = q
        ? commands.filter((c) => c.label.toLowerCase().includes(q))
        : commands;
    const items: Command[] = [
        ...matched,
        ...hits.map((hit, i) => ({
            id: `hit-${i}`,
            label: hit.title,
            hint: hit.hint,
            icon: Search,
            run: go(hit.href),
        })),
    ];

    useEffect(() => {
        setActive(0);
        if (q.length < 2) {
            setHits([]);

            return;
        }
        const timer = setTimeout(() => {
            api<{ hits?: Hit[]; users?: { name: string; username: string }[] }>(
                'GET',
                `/search/quick?q=${encodeURIComponent(q)}`,
            )
                .then((r) =>
                    setHits(
                        r.hits && r.hits.length > 0
                            ? r.hits.slice(0, 8)
                            : (r.users ?? []).slice(0, 6).map((u) => ({
                                  kind: 'user',
                                  title: u.name,
                                  hint: `@${u.username}`,
                                  href: `/${u.username}`,
                              })),
                    ),
                )
                .catch(() => setHits([]));
        }, 180);

        return () => clearTimeout(timer);
    }, [q]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            items[active]?.run();
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <m.div
                    className="fixed inset-0 z-[90] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    onClick={() => setOpen(false)}
                >
                    <m.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={tr('Палітра команд')}
                        initial={
                            reduce ? false : { opacity: 0, y: -8, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: 0.16 }}
                        onClick={(e) => e.stopPropagation()}
                        className="glass-strong w-full max-w-xl overflow-hidden rounded-2xl"
                    >
                        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
                            <Search className="size-4 text-white/45" />
                            <input
                                ref={input}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder={tr('Перейти, зробити чи знайти…')}
                                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
                                aria-label={tr('Палітра команд')}
                            />
                            <kbd className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-white/45">
                                Esc
                            </kbd>
                        </div>
                        <ul
                            className="max-h-[50vh] overflow-y-auto p-1.5"
                            role="listbox"
                        >
                            {items.length === 0 && (
                                <li className="px-3 py-6 text-center text-sm text-white/45">
                                    {tr('Нічого не знайдено')}
                                </li>
                            )}
                            {items.map((item, i) => {
                                const Icon = item.icon;

                                return (
                                    <li
                                        key={item.id}
                                        role="option"
                                        aria-selected={i === active}
                                    >
                                        <button
                                            type="button"
                                            onMouseEnter={() => setActive(i)}
                                            onClick={item.run}
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                                                i === active
                                                    ? 'bg-primary/20 text-white'
                                                    : 'text-white/80',
                                            )}
                                        >
                                            {Icon ? (
                                                <Icon className="size-4 shrink-0 text-white/55" />
                                            ) : (
                                                <ModuleIcon
                                                    name={item.module ?? ''}
                                                    className="size-4 shrink-0 text-white/55"
                                                />
                                            )}
                                            <span className="min-w-0 flex-1 truncate">
                                                {item.label}
                                            </span>
                                            {item.hint && (
                                                <span className="truncate text-xs text-white/40">
                                                    {item.hint}
                                                </span>
                                            )}
                                            {i === active && (
                                                <CornerDownLeft className="size-3.5 shrink-0 text-white/40" />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
