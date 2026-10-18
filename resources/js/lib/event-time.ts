import { LOCALE, tr } from '@/lib/i18n';

const KYIV = 'Europe/Kyiv';

function viewerZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || KYIV;
    } catch {
        return KYIV;
    }
}

function format(date: Date, timeZone: string, withDate: boolean): string {
    return date.toLocaleString(LOCALE, {
        timeZone,
        ...(withDate ? { day: '2-digit', month: '2-digit' } : {}),
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Час події в часовому поясі глядача. Події створюють за Києвом, тож якщо пояс інший —
 * поруч показуємо й київський час, щоб домовлятися без плутанини.
 */
export function eventTime(iso: string): string {
    const date = new Date(iso);
    const zone = viewerZone();
    const local = format(date, zone, true);

    if (local === format(date, KYIV, true)) {
        return local;
    }

    return `${local} · ${tr('Київ')} ${format(date, KYIV, false)}`;
}

/** День і місяць події в поясі глядача (для плиток календаря). */
export function eventDay(iso: string, part: 'day' | 'month'): string {
    return new Date(iso).toLocaleDateString(LOCALE, {
        timeZone: viewerZone(),
        ...(part === 'day' ? { day: 'numeric' } : { month: 'short' }),
    });
}

/** Година й хвилини в поясі глядача. */
export function localTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(LOCALE, {
        timeZone: viewerZone(),
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Київський час, якщо він відрізняється від часу глядача (інакше null). */
export function kyivHint(iso: string): string | null {
    const kyiv = new Date(iso).toLocaleTimeString(LOCALE, {
        timeZone: KYIV,
        hour: '2-digit',
        minute: '2-digit',
    });

    return kyiv === localTime(iso) ? null : kyiv;
}

/** Повна дата дня в поясі глядача (заголовки днів у календарі). */
export function localDay(iso: string): string {
    return new Date(iso).toLocaleDateString(LOCALE, {
        timeZone: viewerZone(),
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
}
