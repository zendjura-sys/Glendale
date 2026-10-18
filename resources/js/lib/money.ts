import { shortNumber } from '@/lib/format';
import { LOCALE } from '@/lib/i18n';
const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/**
 * Копійки → «12 500 ₴» або «12 500,50 ₴».
 */
export function uah(minor: number | null | undefined, signed = false): string {
    const value = minor ?? 0;
    const abs = Math.abs(value);
    const cents = abs % 100;
    const text = `${whole.format(Math.floor(abs / 100))}${cents ? `,${String(cents).padStart(2, '0')}` : ''} ₴`;

    if (value < 0) {
        return `−${text}`;
    }

    return signed && value > 0 ? `+${text}` : text;
}

/**
 * Коротко для плиток: 1 000 000 ₴ → «1M ₴», дрібні суми як є.
 */
export function uahShort(minor: number | null | undefined): string {
    const value = Math.trunc((minor ?? 0) / 100);
    if (Math.abs(value) < 1000) {
        return uah(minor);
    }

    return `${shortNumber(value)} ₴`;
}

/**
 * Гривні з форми → копійки.
 */
export function toMinor(value: string | number): number {
    return Math.round(
        Number(String(value).replace(/\s/g, '').replace(',', '.')) * 100,
    );
}
