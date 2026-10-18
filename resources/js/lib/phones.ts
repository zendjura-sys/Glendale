import { Award, Crown, Gem, Medal, Phone, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tr } from '@/lib/i18n';
import type { PhoneCard, PhoneTier } from '@/types';

/** Рівні номерів від звичайного до діамантового (як App\Services\Phones\PhoneTiers). */
export const PHONE_TIERS: PhoneTier[] = [
    'regular',
    'bronze',
    'silver',
    'gold',
    'platinum',
    'diamond',
];

export function TIER_LABELS(): Record<PhoneTier, string> {
    return {
        regular: tr('Звичайний'),
        bronze: tr('Бронзовий'),
        silver: tr('Срібний'),
        gold: tr('Золотий'),
        platinum: tr('Платиновий'),
        diamond: tr('Діамантовий'),
    };
}

/** Що робить номер рідкісним — підказка біля рівня. */
export function TIER_HINTS(): Record<PhoneTier, string> {
    return {
        regular: tr('Будь-які цифри'),
        bronze: tr('Дві однакові пари (45-45) або три однакові цифри'),
        silver: tr('Три однакові пари або дзеркальний номер'),
        gold: tr('4–5 однакових цифр поспіль або «драбинка» 1234567'),
        platinum: tr('6 однакових цифр поспіль'),
        diamond: tr('Усі 7 цифр однакові, і код оператора з тих самих цифр'),
    };
}

export const TIER_ICONS: Record<PhoneTier, LucideIcon> = {
    regular: Phone,
    bronze: Award,
    silver: Medal,
    gold: Trophy,
    platinum: Crown,
    diamond: Gem,
};

export type PickerProps = {
    phone: PhoneCard | null;
    codes: { premium: string; random: string };
    prices: Record<PhoneTier, { price: number; full_price: number }>;
    chances: Record<Exclude<PhoneTier, 'regular'>, number>;
    discount: number;
    isPlus: boolean;
    nextRandomAt: string | null;
    cooldownDays: number;
};

export type PhoneCheck = {
    number: string;
    operator: string;
    digits: string;
    tier: PhoneTier;
    available: boolean;
    reason: string | null;
    product: string;
    price: number;
    full_price: number;
};

/** «0,05 %», «5 %». */
export function percent(value: number): string {
    return `${value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })} %`;
}
