const relative = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });
const dayMonth = new Intl.DateTimeFormat('uk', {
    day: 'numeric',
    month: 'long',
});
const dayMonthYear = new Intl.DateTimeFormat('uk', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});
const timeOnly = new Intl.DateTimeFormat('uk', {
    hour: '2-digit',
    minute: '2-digit',
});
const compact = new Intl.NumberFormat('uk', {
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
        return 'щойно';
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
        return `сьогодні о ${timeOnly.format(date)}`;
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return `вчора о ${timeOnly.format(date)}`;
    }

    const formatter =
        date.getFullYear() === today.getFullYear() ? dayMonth : dayMonthYear;

    return `${formatter.format(date)} о ${timeOnly.format(date)}`;
}

const shortDay = new Intl.DateTimeFormat('uk', {
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
        return 'вчора';
    }

    return date.getFullYear() === today.getFullYear()
        ? shortDay.format(date)
        : date.toLocaleDateString('uk');
}

/**
 * Роздільник днів у чаті: «Сьогодні», «Вчора», «12 березня».
 */
export function dayLabel(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Сьогодні';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчора';

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
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return forms[0];
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return forms[1];
    }

    return forms[2];
}

export function lastSeen(iso: string | null, gender?: string | null): string {
    if (!iso) {
        return 'давно не заходив(-ла)';
    }

    const verb =
        gender === 'female' ? 'була' : gender === 'male' ? 'був' : 'був(-ла)';

    return `${verb} в мережі ${timeAgo(iso)}`;
}

export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}
