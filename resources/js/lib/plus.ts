import { openPurchase } from '@/lib/billing';
import { tr } from '@/lib/i18n';

/** Базові тарифи (ключі). Ціни й назви приходять із сервера (props.billing.products), бо їх змінює адміністратор. */
export type PlusProduct =
    | 'plus_month'
    | 'plus_year'
    | 'gift_month'
    | 'gift_year'
    | 'family_month'
    | 'family_year'
    | 'promo_top_7'
    | 'promo_top_30'
    | 'promo_highlight_7'
    | 'promo_highlight_30'
    | 'promo_banner_30';

/** Назви базових тарифів мовою інтерфейсу; власні тарифи адміністратора — назвою з каталогу. */
export const PRODUCT_LABELS = (): Record<string, string> => ({
    plus_month: tr('GameCon+ на місяць'),
    plus_year: tr('GameCon+ на рік'),
    gift_month: tr('Подарунок GameCon+ на місяць'),
    gift_year: tr('Подарунок GameCon+ на рік'),
    family_month: tr('GameCon+ для сім’ї на місяць'),
    family_year: tr('GameCon+ для сім’ї на рік'),
    promo_top_7: tr('Місце в топі каталогу · 7 днів'),
    promo_top_30: tr('Місце в топі каталогу · 30 днів'),
    promo_highlight_7: tr('Виділена картка · 7 днів'),
    promo_highlight_30: tr('Виділена картка · 30 днів'),
    promo_banner_30: tr('Банер над каталогом · 30 днів'),
    phone_regular: tr('Номер +777 · звичайний'),
    phone_bronze: tr('Номер +777 · бронзовий'),
    phone_silver: tr('Номер +777 · срібний'),
    phone_gold: tr('Номер +777 · золотий'),
    phone_platinum: tr('Номер +777 · платиновий'),
    phone_diamond: tr('Номер +777 · діамантовий'),
});

/** Купити карткою: відкриває вікно оплати (BillingHost). */
export function buyProduct(
    product: string,
    extra: Record<string, string | number> = {},
): void {
    // Чи пропонувати автопродовження, вирішує вікно оплати за каталогом (recurring).
    openPurchase({ product, extra });
}
