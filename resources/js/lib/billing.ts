import { tr } from '@/lib/i18n';

/**
 * Білінг (лише сайт): покупки з рахунку й поповнення донатом.
 *
 * Будь-яка сторінка відкриває вікна через події — їх слухає BillingHost у SocialLayout.
 */
export const PURCHASE_EVENT = 'gc:purchase';
export const TOPUP_EVENT = 'gc:topup';

export type PurchaseRequest = {
    product: string;
    extra?: Record<string, string | number>;
    /** Для GameCon+ і GameCon+ сім’ї — запропонувати автопродовження. */
    renewable?: boolean;
};

export type TopupRequest = {
    /** Запропонована сума, ₴ (наприклад, скільки бракує на покупку). */
    amount?: number;
    /** Відкрити наявну заявку. */
    topupId?: number;
    /** Що зробити після зарахування (повернутися до покупки). */
    resume?: PurchaseRequest;
};

export function openPurchase(request: PurchaseRequest): void {
    window.dispatchEvent(
        new CustomEvent<PurchaseRequest>(PURCHASE_EVENT, { detail: request }),
    );
}

export function openTopup(request: TopupRequest = {}): void {
    window.dispatchEvent(
        new CustomEvent<TopupRequest>(TOPUP_EVENT, { detail: request }),
    );
}

/** 14900 → «149 ₴», 12345 → «123,45 ₴». */
export function money(kopecks: number): string {
    const value = kopecks / 100;

    return `${value.toLocaleString('uk-UA', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
    })} ₴`;
}

export const TX_LABELS = (): Record<string, string> => ({
    topup: tr('Поповнення'),
    purchase: tr('Покупка'),
    renewal: tr('Автопродовження'),
    refund: tr('Повернення'),
    adjust: tr('Корекція'),
});
