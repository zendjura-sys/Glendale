import { router, usePage } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { tr } from '@/lib/i18n';
import { applyTheme, resolveTheme, saveGuestTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Швидкий перемикач «Неоновий синій» ↔ «Крижана Арктика». Тема змінюється одразу,
 * вибір зберігається в акаунті (або в браузері гостя). Повний вибір, зокрема «як на пристрої», —
 * Налаштування → Вигляд. У стилях без світлої теми перемикача немає.
 */
function useThemeToggle() {
    const user = usePage().props.auth.user;
    const skin = user?.skin ?? 'gamecon';
    const pref = user?.theme ?? 'system';
    const [current, setCurrent] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        setCurrent(resolveTheme(pref, skin));
    }, [pref, skin]);

    const toggle = () => {
        const next = current === 'light' ? 'dark' : 'light';
        setCurrent(applyTheme(next, skin));
        if (user) {
            router.put(
                '/settings/theme',
                { theme: next },
                { preserveScroll: true, preserveState: true },
            );
        } else {
            saveGuestTheme(next);
        }
    };

    return { available: skin === 'gamecon', current, toggle };
}

export function ThemeButton({ className }: { className?: string }) {
    const { available, current, toggle } = useThemeToggle();
    if (!available) return null;
    const label =
        current === 'light'
            ? tr('Темна тема «Неоновий синій»')
            : tr('Світла тема «Крижана Арктика»');

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={label}
            title={label}
            className={cn(
                'gc-icon-button size-10 items-center justify-center rounded-xl transition',
                className,
            )}
        >
            {current === 'light' ? (
                <Moon className="size-[19px]" />
            ) : (
                <Sun className="size-[19px]" />
            )}
        </button>
    );
}

export function ThemeMenuItem() {
    const { available, current, toggle } = useThemeToggle();
    if (!available) return null;

    return (
        <DropdownMenuItem
            className="rounded-lg focus:bg-white/[0.06]"
            onSelect={(event) => {
                event.preventDefault();
                toggle();
            }}
        >
            {current === 'light' ? <Moon /> : <Sun />}
            {current === 'light' ? tr('Темна тема') : tr('Світла тема')}
        </DropdownMenuItem>
    );
}

/** Рядок для мобільного меню. */
export function ThemeRow() {
    const { available, current, toggle } = useThemeToggle();
    if (!available) return null;

    return (
        <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white/80 active:bg-white/[0.06]"
        >
            {current === 'light' ? (
                <Moon className="size-[18px] text-white/50" />
            ) : (
                <Sun className="size-[18px] text-white/50" />
            )}
            {current === 'light'
                ? tr('Темна тема «Неоновий синій»')
                : tr('Світла тема «Крижана Арктика»')}
        </button>
    );
}
