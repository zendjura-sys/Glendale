import { usePage } from '@inertiajs/react';
import { tr } from '@/lib/i18n';
import type { BillingProduct } from '@/types/billing';

/**
 * Оплата (лише сайт): карткою через monobank — Visa, Mastercard, Apple Pay, Google Pay.
 *
 * Будь-яка сторінка відкриває вікно оплати подією — її слухає BillingHost у SocialLayout.
 */
export const PURCHASE_EVENT = 'gc:purchase';

export type PurchaseRequest = {
    product: string;
    extra?: Record<string, string | number>;
    /** Для GameCon+ і GameCon+ сім’ї — запропонувати автопродовження. */
    renewable?: boolean;
};

export function openPurchase(request: PurchaseRequest): void {
    window.dispatchEvent(
        new CustomEvent<PurchaseRequest>(PURCHASE_EVENT, { detail: request }),
    );
}

/** Тарифи з адмінки (ціни в гривнях). */
export function useProducts(): Record<string, BillingProduct> {
    return usePage().props.billing?.products ?? {};
}

/** Тарифи одного типу, що зараз продаються, у порядку з адмінки. */
export function useKind(
    kind: BillingProduct['kind'],
): [string, BillingProduct][] {
    return Object.entries(useProducts()).filter(
        ([, p]) => p.kind === kind && p.available,
    );
}

/** Коротка назва періоду: 30 днів → «Місяць», 365 → «Рік», інакше — назва тарифу. */
export function periodLabel(product: BillingProduct): string {
    if (product.days >= 28 && product.days <= 31) return tr('Місяць');
    if (product.days >= 365 && product.days <= 366) return tr('Рік');
    if (product.days >= 89 && product.days <= 92) return tr('3 місяці');
    if (product.days >= 180 && product.days <= 183) return tr('Пів року');
    if (product.days === 7) return tr('Тиждень');

    return product.name;
}

/** «/ місяць», «/ рік» або «/ 45 дн.». */
export function perPeriod(days: number): string {
    if (days >= 28 && days <= 31) return tr('/ місяць');
    if (days >= 365 && days <= 366) return tr('/ рік');

    return tr('/ {n} дн.', { n: days });
}

/** Ціна тарифу в гривнях; 0 — тарифу немає. */
export function usePrice(product: string): number {
    return useProducts()[product]?.price ?? 0;
}

/** 14900 → «149 ₴», 12345 → «123,45 ₴». */
export function money(kopecks: number): string {
    const value = kopecks / 100;

    return `${value.toLocaleString('uk-UA', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
    })} ₴`;
}

export const ORDER_STATUS = (): Record<string, string> => ({
    pending: tr('Очікує оплати'),
    paid: tr('Оплачено'),
    failed: tr('Не пройшла'),
    cancelled: tr('Скасовано'),
    refunded: tr('Повернено'),
    expired: tr('Час минув'),
});
