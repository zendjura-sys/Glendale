import { useEffect, useRef, useState } from 'react';

/**
 * Чернетки незакінченого тексту — на цьому пристрої (localStorage): повідомлення в чаті,
 * коментарі, статті. Сторінку закрили чи оновили — текст повертається.
 * Сховище може бути недоступне (приватний режим) — тоді просто не зберігаємо.
 */
const PREFIX = 'gc-draft:';
const EVENT = 'gc-drafts';

export function readDraft(key: string): string {
    try {
        return window.localStorage.getItem(PREFIX + key) ?? '';
    } catch {
        return '';
    }
}

export function writeDraft(key: string, text: string) {
    try {
        if (text.trim()) {
            window.localStorage.setItem(PREFIX + key, text);
        } else {
            window.localStorage.removeItem(PREFIX + key);
        }
        window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    } catch {
        // Немає сховища — чернетка просто не збережеться.
    }
}

/** Чернетка за ключем, що оновлюється, коли її змінюють деінде (напр., список чатів). */
export function useStoredDraft(key: string | null): string {
    const [text, setText] = useState(() => (key ? readDraft(key) : ''));
    useEffect(() => {
        if (!key) return;
        setText(readDraft(key));
        const sync = (event: Event) => {
            if ((event as CustomEvent<string>).detail === key) {
                setText(readDraft(key));
            }
        };
        window.addEventListener(EVENT, sync);

        return () => window.removeEventListener(EVENT, sync);
    }, [key]);

    return text;
}

/**
 * Автозбереження поля: на старті підставляє збережене (якщо поле порожнє),
 * далі зберігає з паузою 300 мс. Порожній текст прибирає чернетку.
 * Повертає true, якщо текст відновлено з чернетки.
 */
export function useDraft(
    key: string | null,
    value: string,
    setValue: (text: string) => void,
): boolean {
    const [restored, setRestored] = useState(false);
    const loaded = useRef<string | null>(null);

    useEffect(() => {
        if (!key || loaded.current === key) return;
        loaded.current = key;
        const saved = readDraft(key);
        if (saved && !value.trim()) {
            setValue(saved);
            setRestored(true);
        } else {
            setRestored(false);
        }
        // Лише при зміні ключа: підставити збережене один раз.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        if (!key || loaded.current !== key) return;
        const timer = window.setTimeout(() => writeDraft(key, value), 300);

        return () => window.clearTimeout(timer);
    }, [key, value]);

    return restored;
}
