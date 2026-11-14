import { useEffect, useState } from 'react';

/** Поточна тема сайту (data-theme на <html>) — оновлюється при перемиканні. */
export function useSiteTheme(): 'light' | 'dark' {
    const read = (): 'light' | 'dark' =>
        typeof document !== 'undefined' &&
        document.documentElement.dataset.theme === 'light'
            ? 'light'
            : 'dark';
    const [theme, setTheme] = useState<'light' | 'dark'>(read);

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(read()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });

        return () => observer.disconnect();
    }, []);

    return theme;
}
