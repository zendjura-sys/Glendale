import {
    Biohazard,
    Bomb,
    CircleHelp,
    Flame,
    Plane,
    Radiation,
    ShieldCheck,
    Siren,
    Swords,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tr } from '@/lib/i18n';

/**
 * Єдина схема тривог (Мінцифри / Ajax ukrainealarm, alerts.in.ua, NEPTUN) — як `App\Enums\AlertType`
 * і `AlertScale` на сервері та `mobile/lib/alerts_config.dart` у застосунку. Палітра — під темне матове скло.
 */
export type AlertTypeCode =
    | 'NUCLEAR'
    | 'CHEMICAL'
    | 'BALLISTIC'
    | 'AIR'
    | 'ARTILLERY'
    | 'URBAN_FIGHTS'
    | 'UAV'
    | 'CLEAR'
    | 'NO_DATA';

export type AlertScaleCode = 'oblast' | 'raion' | 'hromada' | 'city';

export type AlertPalette = {
    hex: string;
    fill: string;
    border: string;
    text: string;
};

export type AlertTypeMeta = AlertPalette & {
    priority: number;
    label: () => string;
    short: () => string;
    icon: LucideIcon;
};

export const ALERT_TYPES: Record<AlertTypeCode, AlertTypeMeta> = {
    NUCLEAR: {
        priority: 100,
        label: () => tr('Радіаційна небезпека'),
        short: () => tr('Радіація'),
        icon: Radiation,
        hex: '#FACC15',
        fill: 'rgba(250, 204, 21, 0.40)',
        border: 'rgba(253, 224, 71, 0.62)',
        text: '#FDE047',
    },
    CHEMICAL: {
        priority: 90,
        label: () => tr('Хімічна загроза'),
        short: () => tr('Хімзагроза'),
        icon: Biohazard,
        hex: '#A855F7',
        fill: 'rgba(168, 85, 247, 0.34)',
        border: 'rgba(192, 132, 252, 0.55)',
        text: '#C084FC',
    },
    BALLISTIC: {
        priority: 80,
        label: () => tr('Ракетна небезпека'),
        short: () => tr('Балістика'),
        icon: Flame,
        hex: '#BE123C',
        fill: 'rgba(190, 18, 60, 0.44)',
        border: 'rgba(251, 113, 133, 0.65)',
        text: '#FDA4AF',
    },
    AIR: {
        priority: 70,
        label: () => tr('Повітряна тривога (червоний рівень)'),
        short: () => tr('Тривога'),
        icon: Siren,
        hex: '#DC2626',
        fill: 'rgba(220, 38, 38, 0.38)',
        border: 'rgba(248, 113, 113, 0.60)',
        text: '#F87171',
    },
    ARTILLERY: {
        priority: 60,
        label: () => tr('Загроза артобстрілу'),
        short: () => tr('Артобстріл'),
        icon: Bomb,
        hex: '#F97316',
        fill: 'rgba(249, 115, 22, 0.32)',
        border: 'rgba(251, 146, 60, 0.52)',
        text: '#FB923C',
    },
    URBAN_FIGHTS: {
        priority: 50,
        label: () => tr('Вуличні бої'),
        short: () => tr('Бої'),
        icon: Swords,
        hex: '#84CC16',
        fill: 'rgba(132, 204, 22, 0.30)',
        border: 'rgba(163, 230, 53, 0.52)',
        text: '#A3E635',
    },
    UAV: {
        priority: 40,
        label: () => tr('Повітряна тривога (жовтий рівень)'),
        short: () => tr('БпЛА'),
        icon: Plane,
        hex: '#F59E0B',
        fill: 'rgba(245, 158, 11, 0.26)',
        border: 'rgba(251, 191, 36, 0.48)',
        text: '#FBBF24',
    },
    CLEAR: {
        priority: 10,
        label: () => tr('Немає тривоги'),
        short: () => tr('Спокійно'),
        icon: ShieldCheck,
        hex: '#10B981',
        fill: 'rgba(16, 185, 129, 0.14)',
        border: 'rgba(52, 211, 153, 0.35)',
        text: '#34D399',
    },
    NO_DATA: {
        priority: 0,
        label: () => tr('Немає даних'),
        short: () => tr('Невідомо'),
        icon: CircleHelp,
        hex: '#475569',
        fill: 'rgba(71, 85, 105, 0.28)',
        border: 'rgba(100, 116, 139, 0.40)',
        text: '#94A3B8',
    },
};

/** Від найважливішої до найменш важливої (для легенди). */
export const ALERT_TYPE_ORDER = (
    Object.keys(ALERT_TYPES) as AlertTypeCode[]
).sort((a, b) => ALERT_TYPES[b].priority - ALERT_TYPES[a].priority);

/** Повітряна тривога за масштабом: уся область — найнасиченіша, населений пункт — найлегша. */
export const AIR_RAID_SCALE_COLORS: Record<
    AlertScaleCode,
    AlertPalette & { label: () => string }
> = {
    oblast: {
        label: () => tr('Вся область'),
        hex: '#DC2626',
        fill: 'rgba(220, 38, 38, 0.38)',
        border: 'rgba(248, 113, 113, 0.60)',
        text: '#F87171',
    },
    raion: {
        label: () => tr('Район'),
        hex: '#E11D48',
        fill: 'rgba(225, 29, 72, 0.30)',
        border: 'rgba(251, 113, 133, 0.50)',
        text: '#FB7185',
    },
    hromada: {
        label: () => tr('Громада (ОТГ)'),
        hex: '#F43F5E',
        fill: 'rgba(244, 63, 94, 0.24)',
        border: 'rgba(251, 113, 133, 0.42)',
        text: '#FDA4AF',
    },
    city: {
        label: () => tr('Населений пункт'),
        hex: '#FB7185',
        fill: 'rgba(251, 113, 133, 0.18)',
        border: 'rgba(253, 164, 175, 0.38)',
        text: '#FECDD3',
    },
};

export function isAlertType(code: unknown): code is AlertTypeCode {
    return typeof code === 'string' && code in ALERT_TYPES;
}

/** Кольори зони/плашки: для AIR — за масштабом, інакше — за типом. */
export function resolveAlertColors(
    type: AlertTypeCode | null | undefined,
    scale?: AlertScaleCode | null,
): AlertPalette {
    const code = type ?? 'CLEAR';
    if (code === 'AIR' && scale && scale in AIR_RAID_SCALE_COLORS) {
        return AIR_RAID_SCALE_COLORS[scale];
    }

    return ALERT_TYPES[code] ?? ALERT_TYPES.NO_DATA;
}

/** Головна тривога серед кількох — з найвищим пріоритетом. */
export function primaryAlert(
    codes: (AlertTypeCode | null | undefined)[],
): AlertTypeCode {
    let best: AlertTypeCode = 'CLEAR';
    for (const code of codes) {
        if (code && ALERT_TYPES[code].priority > ALERT_TYPES[best].priority) {
            best = code;
        }
    }

    return best;
}

/**
 * Суцільні заливки зон на мапі в стилі alerts.in.ua — світла й темна версії за темою сайту:
 * світла — бежевий / лососево-червоний / жовтий, темна — нічний синій / темно-малиновий / вохра.
 * AIR світлішає (на темній — тьмяніє) зі зменшенням масштабу.
 */
type MapPalette = {
    types: Record<AlertTypeCode, string>;
    air: Record<AlertScaleCode, string>;
};
export const MAP_FILL: Record<'light' | 'dark', MapPalette> = {
    light: {
        types: {
            NUCLEAR: '#a78bfa',
            CHEMICAL: '#9ccc4a',
            BALLISTIC: '#d2463e',
            AIR: '#e8776c',
            ARTILLERY: '#f39a4a',
            URBAN_FIGHTS: '#e0783a',
            UAV: '#ffc93c',
            CLEAR: '#ece2d4',
            NO_DATA: '#d8d2c9',
        },
        air: {
            oblast: '#e8776c',
            raion: '#ec897f',
            hromada: '#f09b92',
            city: '#f3ada6',
        },
    },
    dark: {
        types: {
            NUCLEAR: '#5b2f9e',
            CHEMICAL: '#4f7a1a',
            BALLISTIC: '#a3162a',
            AIR: '#8a1f2e',
            ARTILLERY: '#a8571c',
            URBAN_FIGHTS: '#8f431a',
            UAV: '#c8921e',
            CLEAR: '#1d2a3f',
            NO_DATA: '#232833',
        },
        air: {
            oblast: '#8a1f2e',
            raion: '#7c2334',
            hromada: '#6c283b',
            city: '#5d2b41',
        },
    },
};

/** Межі й підписи мапи для кожної теми (тла немає — мапа лежить прямо на картці). */
export const MAP_INK: Record<
    'light' | 'dark',
    {
        unit: string;
        oblast: string;
        mine: string;
        label: string;
        faint: string;
    }
> = {
    light: {
        unit: 'rgb(255 255 255 / 0.75)',
        oblast: 'rgb(120 100 80 / 0.45)',
        mine: 'rgb(30 41 59 / 0.85)',
        label: 'rgb(30 41 59 / 0.72)',
        faint: 'rgb(30 41 59 / 0.45)',
    },
    dark: {
        unit: 'rgb(0 0 0 / 0.35)',
        oblast: 'rgb(255 255 255 / 0.16)',
        mine: 'rgb(255 255 255 / 0.85)',
        label: 'rgb(255 255 255 / 0.82)',
        faint: 'rgb(255 255 255 / 0.4)',
    },
};

/** Колір заливки зони на мапі: для AIR — за масштабом. */
export function mapFill(
    type: AlertTypeCode,
    scale?: AlertScaleCode | null,
    theme: 'light' | 'dark' = 'dark',
): string {
    const palette = MAP_FILL[theme];
    if (type === 'AIR' && scale) return palette.air[scale];

    return palette.types[type];
}
