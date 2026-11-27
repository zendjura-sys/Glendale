import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Nav = { path: string | null; go: (path: string) => void; back: () => void; close: () => void; canBack: boolean };
const NavContext = createContext<Nav>({ path: null, go: () => undefined, back: () => undefined, close: () => undefined, canBack: false });

/**
 * Навігація всередині програми: сторінки розділів (сім’я, клан, гра…) відкриваються в єдиному вікні
 * поверх сітки модулів, зі своєю історією «Назад». Із віджета — у єдиному вікні (через Main).
 */
export function NavProvider({ children, widget = false }: { children: ReactNode; widget?: boolean }) {
    const [stack, setStack] = useState<string[]>([]);
    const go = useCallback(
        (path: string) => {
            if (widget) return void window.gamecon.nav.open(path);
            setStack((s) => (s[s.length - 1] === path ? s : [...s, path]));
        },
        [widget],
    );
    useEffect(() => (widget ? undefined : window.gamecon.nav.onGo((p) => setStack((s) => [...s, p]))), [widget]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if ((e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft')) && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) setStack((s) => s.slice(0, -1));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    const value = useMemo<Nav>(
        () => ({ path: stack[stack.length - 1] ?? null, go, back: () => setStack((s) => s.slice(0, -1)), close: () => setStack([]), canBack: stack.length > 1 }),
        [stack, go],
    );
    return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export const useNav = (): Nav => useContext(NavContext);
