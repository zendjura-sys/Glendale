import { Bell, MessageCircle, Music2, UsersRound, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const KEY = 'gc.split';

/** Сторінка відкрита всередині панелі «поруч» — без шапки й меню. */
export function isPanelView(): boolean {
    return (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('panel') === '1'
    );
}

function withPanel(path: string): string {
    return `${path}${path.includes('?') ? '&' : '?'}panel=1`;
}

const TABS = [
    { path: '/messages', label: () => tr('Чати'), icon: MessageCircle },
    { path: '/music', label: () => tr('Музика'), icon: Music2 },
    { path: '/friends', label: () => tr('Друзі'), icon: UsersRound },
    { path: '/notifications', label: () => tr('Сповіщення'), icon: Bell },
];

/**
 * Розділений екран на широких моніторах: праворуч — чат, музика чи друзі, ліворуч — будь-яка сторінка.
 * Відкривається з палітри команд (Ctrl+K → «Розділити екран»); стан пам’ятається в цьому браузері.
 */
export function SplitPanel() {
    const reduce = useReducedMotion();
    const [path, setPath] = useState<string | null>(null);

    useEffect(() => {
        if (isPanelView()) return;
        try {
            const saved = localStorage.getItem(KEY);
            if (saved && window.matchMedia('(min-width: 1280px)').matches) {
                setPath(saved);
            }
        } catch {
            // Без сховища — панель просто не відновлюється.
        }
        const onSplit = (event: Event) =>
            setPath((event as CustomEvent<string>).detail || '/messages');
        window.addEventListener('gc:split', onSplit);

        return () => window.removeEventListener('gc:split', onSplit);
    }, []);

    useEffect(() => {
        if (isPanelView()) return;
        try {
            if (path) localStorage.setItem(KEY, path);
            else localStorage.removeItem(KEY);
        } catch {
            // Без сховища — не пам’ятаємо.
        }
        document.documentElement.classList.toggle('gc-split', path !== null);
    }, [path]);

    if (isPanelView()) return null;

    return (
        <AnimatePresence>
            {path && (
                <m.aside
                    initial={reduce ? false : { opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? undefined : { opacity: 0, x: 24 }}
                    transition={{ duration: 0.2 }}
                    className="glass-strong fixed top-[76px] right-3 bottom-3 z-40 hidden w-[420px] flex-col overflow-hidden rounded-2xl xl:flex"
                    aria-label={tr('Поруч')}
                >
                    <div className="flex items-center gap-1 p-1.5">
                        {TABS.map((tab) => (
                            <button
                                key={tab.path}
                                type="button"
                                onClick={() => setPath(tab.path)}
                                className={cn(
                                    'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition',
                                    path === tab.path
                                        ? 'bg-primary text-white'
                                        : 'text-white/65 hover:bg-[var(--gc-l3)] hover:text-white',
                                )}
                            >
                                <tab.icon className="size-3.5" />
                                {tab.label()}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPath(null)}
                            aria-label={tr('Закрити панель')}
                            className="flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-[var(--gc-l3)] hover:text-white"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                    <iframe
                        key={path}
                        src={withPanel(path)}
                        title={tr('Поруч')}
                        className="min-h-0 flex-1 bg-transparent"
                    />
                </m.aside>
            )}
        </AnimatePresence>
    );
}
