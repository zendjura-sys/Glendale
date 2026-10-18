/**
 * Налаштування цього пристрою (не акаунта): розмір тексту. Живуть у localStorage
 * і ставляться на <html data-text>, тож діють з першого кадру й не потребують сервера.
 * Розмір масштабує кореневий шрифт — усі rem-розміри Tailwind ростуть разом із ним.
 */

export const TEXT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

const KEY = 'gc.text-size';

export function readTextSize(): TextSize {
    try {
        const value = localStorage.getItem(KEY);

        return (TEXT_SIZES as readonly string[]).includes(value ?? '')
            ? (value as TextSize)
            : 'm';
    } catch {
        return 'm';
    }
}

/** Показати розмір одразу (попередній перегляд), нічого не зберігаючи. */
export function applyTextSize(size: TextSize): void {
    if (typeof document === 'undefined') return;
    if (size === 'm') {
        delete document.documentElement.dataset.text;
    } else {
        document.documentElement.dataset.text = size;
    }
}

export function saveTextSize(size: TextSize): void {
    applyTextSize(size);
    try {
        if (size === 'm') {
            localStorage.removeItem(KEY);
        } else {
            localStorage.setItem(KEY, size);
        }
    } catch {
        // Приватний режим чи заблоковане сховище — розмір діє до перезавантаження.
    }
}
