/** Тариф з каталогу (ціни — у гривнях; адміністратор змінює їх в Адмінка → Білінг). */
export type BillingProduct = {
    kind: 'plus' | 'family' | 'gift' | 'promo' | 'phone';
    /** Вид просування сервера (для kind = promo). */
    promo: 'top' | 'highlight' | 'banner' | null;
    name: string;
    price: number;
    /** «Стара» ціна для показу знижки. */
    old_price: number | null;
    days: number;
    /** Можна ввімкнути автопродовження. */
    recurring: boolean;
    badge: string | null;
    available: boolean;
};

/** Налаштування нативної кнопки Google Pay (pay.js). */
export type GooglePayConfig = {
    environment: 'TEST' | 'PRODUCTION';
    merchant_id: string | null;
    merchant_name: string;
    gateway: string;
    gateway_merchant_id: string | null;
    networks: string[];
};

export type SharedBilling = {
    /** Оплата карткою працює (адміністратор підключив еквайринг monobank). */
    card: boolean;
    products: Record<string, BillingProduct>;
    /** Пропонувати зберегти картку для автопродовження. */
    save_card: boolean;
    google_pay: GooglePayConfig | null;
    /** Значки способів оплати внизу сайту. */
    badges: PaymentBadge[];
};

export type PaymentBadge =
    | 'plata'
    | 'visa'
    | 'mastercard'
    | 'maestro'
    | 'prostir'
    | 'apple_pay'
    | 'google_pay';

export type SavedCard = {
    id: number;
    masked_pan: string;
    payment_system: string | null;
};

export type PaymentOrderCard = {
    id: number;
    code: string;
    kind: 'purchase' | 'renewal';
    product: string;
    price: number;
    amount: number;
    credit_used: number;
    discount: number;
    status:
        | 'pending'
        | 'paid'
        | 'failed'
        | 'cancelled'
        | 'refunded'
        | 'expired';
    method: string;
    masked_pan: string | null;
    failure: string | null;
    refunded: number;
    page_url: string | null;
    created_at: string;
    paid_at: string | null;
};

export type Quote = {
    price: number;
    discount: number;
    promo: string | null;
    credit: number;
    amount: number;
    cards: SavedCard[];
    available: boolean;
};
