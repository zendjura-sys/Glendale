import { openPurchase } from '@/lib/billing';
import { tr } from '@/lib/i18n';

/** Ціни GameCon+ у гривнях (як у config/plus.php; списуються з рахунку). */
export const PLUS_PRICES = {
    plus_month: 149,
    plus_year: 1290,
    gift_month: 149,
    gift_year: 1290,
    family_month: 399,
    family_year: 3490,
    promo_top_7: 499,
    promo_top_30: 1490,
    promo_highlight_7: 199,
    promo_highlight_30: 590,
    promo_banner_30: 2490,
} as const;

export type PlusProduct = keyof typeof PLUS_PRICES;

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
});

/** Купити з рахунку: відкриває вікно підтвердження (BillingHost). */
export function buyProduct(
    product: PlusProduct,
    extra: Record<string, string | number> = {},
): void {
    openPurchase({
        product,
        extra,
        renewable: product.startsWith('plus_') || product.startsWith('family_'),
    });
}
