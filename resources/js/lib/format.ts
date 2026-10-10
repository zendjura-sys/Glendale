import { LOCALE, pluralForm, tr } from '@/lib/i18n';

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const dayMonth = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
});
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});
const timeOnly = new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
});
const compact = new Intl.NumberFormat(LOCALE, {
    notation: 'compact',
    maximumFractionDigits: 1,
});

/**
 * «щойно», «5 хв тому», «вчора о 14:20», «12 березня о 09:10».
 */
export function timeAgo(iso: string): string {
    const date = new Date(iso);
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);

    if (seconds < 45) {
        return tr('щойно');
    }

    if (seconds < 3600) {
        return relative.format(-Math.round(seconds / 60), 'minute');
    }

    if (seconds < 6 * 3600) {
        return relative.format(-Math.round(seconds / 3600), 'hour');
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return tr('сьогодні о {format}', { format: timeOnly.format(date) });
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return tr('вчора о {format}', { format: timeOnly.format(date) });
    }

    const formatter =
        date.getFullYear() === today.getFullYear() ? dayMonth : dayMonthYear;

    return tr('{format} о {format2}', {
        format: formatter.format(date),
        format2: timeOnly.format(date),
    });
}

const shortDay = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
});

export function clockTime(iso: string): string {
    return timeOnly.format(new Date(iso));
}

/**
 * Час у списку бесід: «14:20», «вчора», «12 бер.», «12.03.24».
 */
export function shortTime(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return timeOnly.format(date);
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return tr('вчора');
    }

    return date.getFullYear() === today.getFullYear()
        ? shortDay.format(date)
        : date.toLocaleDateString(LOCALE);
}

/**
 * Роздільник днів у чаті: «Сьогодні», «Вчора», «12 березня».
 */
export function dayLabel(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return tr('Сьогодні');
    if (date.toDateString() === yesterday.toDateString()) return tr('Вчора');

    return formatDate(iso, date.getFullYear() !== today.getFullYear());
}

export function formatDate(iso: string, withYear = true): string {
    return (withYear ? dayMonthYear : dayMonth).format(new Date(iso));
}

export function compactNumber(value: number): string {
    return value < 1000 ? String(value) : compact.format(value);
}

/**
 * Українська множина: plural(5, ['друг', 'друзі', 'друзів']).
 */
export function plural(count: number, forms: [string, string, string]): string {
    return pluralForm(count, forms);
}

export function lastSeen(iso: string | null, gender?: string | null): string {
    if (!iso) {
        return tr('давно не заходив(-ла)');
    }

    const verb =
        gender === 'female'
            ? tr('була')
            : gender === 'male'
              ? tr('був')
              : tr('був(-ла)');

    return tr('{verb} в мережі {timeAgo}', { verb, timeAgo: timeAgo(iso) });
}

export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export function formatBytes(bytes: number | null | undefined): string {
    if (!bytes) return tr('0 Б');
    const units = [tr('Б'), tr('КБ'), tr('МБ'), tr('ГБ')];
    const power = Math.min(
        units.length - 1,
        Math.floor(Math.log(bytes) / Math.log(1024)),
    );
    const value = bytes / 1024 ** power;

    return `${value >= 10 || power === 0 ? Math.round(value) : value.toFixed(1).replace('.', ',')} ${units[power]}`;
}

export function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));

    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function formatLength(seconds: number): string {
    const minutes = Math.round(Math.max(0, seconds) / 60);
    const hours = Math.floor(minutes / 60);

    if (hours === 0) return tr('{minutes} хв', { minutes });

    return minutes % 60 === 0
        ? tr('{hours} год', { hours })
        : tr('{hours} год {v} хв', { hours, v: minutes % 60 });
}

/** Назва мови мовою інтерфейсу: «німецька», «English». */
export function languageName(code: string, locale: string): string {
    try {
        const name = new Intl.DisplayNames([locale], { type: 'language' }).of(
            code,
        );

        return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
    } catch {
        return code;
    }
}
