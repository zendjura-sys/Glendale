import type {
    AirThreat,
    AlertRegion,
    AlertUnit,
} from '@/components/alerts/alert-map';
import { tr } from '@/lib/i18n';

export type AlertState = {
    regions: AlertRegion[];
    units: AlertUnit[];
    active_count: number;
    mig_active: boolean;
    ballistic_threat: boolean;
    threats: AirThreat[];
    feed: {
        ref: string;
        channel?: string;
        group?: string;
        text: string;
        at: string;
    }[];
    source: string | null;
    /** Обов’язковий підпис-посилання на джерело (NEPTUN). */
    attribution?: { text: string; url: string } | null;
    stale: boolean;
    updated_at: string;
};

export type AlertPrefs = {
    region: string | null;
    /** Місце з довідника UkraineAlarm (район, громада, місто/село, район міста); null — уся область. */
    unit: {
        id: string;
        name: string;
        type: string;
        type_label: string;
        /** «Область · Район · Громада» — над місцем. */
        path: string;
        /** Від області до місця — для каскаду виборів. */
        path_ids: string[];
    } | null;
    /** Тривоги просто зараз саме в обраному місці. */
    status: {
        type: string;
        name: string;
        since: string | null;
        level: 'red' | 'yellow' | null;
        accent: string;
        severity: string;
    }[];
    /** Додаткові місця (рідні, робота) з підписом і статусом. */
    places?: {
        id: string;
        label: string;
        name: string;
        type_label: string;
        path: string;
        status: AlertPrefs['status'];
    }[];
    /** Чи є ключ UkraineAlarm — без нього тривог і сповіщень немає. */
    units_enabled: boolean;
    /** Отримувати сповіщення про тривоги взагалі. */
    push: boolean;
    /** Фільтри: початок, відбій, червоні, жовті; беззвучно — лише рядок у дзвіночку. */
    start: boolean;
    end: boolean;
    red: boolean;
    yellow: boolean;
    silent: boolean;
    shelter: boolean;
};

/** Що можна змінити в налаштуваннях тривог. */
export type AlertPrefsPatch = {
    region?: string | null;
    unit?: string | null;
    places?: { id: string; label: string }[];
    push?: boolean;
    start?: boolean;
    end?: boolean;
    red?: boolean;
    yellow?: boolean;
    silent?: boolean;
    shelter?: boolean;
};

/** Вузол дерева місць: район → громада → місто/село → район міста. */
export type AlertPlaceNode = {
    id: string;
    name: string;
    type: string;
    children: AlertPlaceNode[];
};

export type AlertPlaceHit = {
    id: string;
    name: string;
    type: string;
    type_label: string;
    path: string;
};

export type AlertDistrict = {
    id: string;
    name: string;
    communities: { id: string; name: string }[];
};

/** Тривалість «1 год 05 хв» від початку тривоги до зараз. */
export function duration(startedAt: string | null, now: number): string {
    if (!startedAt) return '';
    const total = Math.max(
        0,
        Math.floor((now - Date.parse(startedAt)) / 60000),
    );
    const h = Math.floor(total / 60);
    const min = total % 60;
    if (h >= 48) {
        // Тривала тривога (окуповані території тощо) — у днях.
        return tr('{d} дн.', { d: Math.floor(h / 24) });
    }

    return h > 0
        ? tr('{h} год {m} хв', { h, m: String(min).padStart(2, '0') })
        : tr('{m} хв', { m: min });
}

export type AlertSourceGroup = {
    group: string;
    title: string;
    about: string;
    enabled: boolean;
    channels: { name: string; regions: string[] }[];
};

/** Шари мапи (фільтри), як у агрегаторів: тривоги й окремо кожен тип цілей. */
export const LAYERS = [
    'alerts',
    'uav',
    'missile',
    'ballistic',
    'kab',
    'mig',
] as const;
export type AlertLayer = (typeof LAYERS)[number];

const LAYERS_KEY = 'gc.alerts.layers';
const SOUND_KEY = 'gc.alerts.sound';

export function loadLayers(): AlertLayer[] {
    try {
        const raw = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? 'null');
        if (Array.isArray(raw)) {
            return LAYERS.filter((l) => raw.includes(l));
        }
    } catch {
        // Сховище недоступне — усі шари.
    }
    return [...LAYERS];
}

export function saveLayers(layers: AlertLayer[]): void {
    try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(layers));
    } catch {
        // Не критично.
    }
}

export function loadSound(): boolean {
    try {
        return localStorage.getItem(SOUND_KEY) === '1';
    } catch {
        return false;
    }
}

export function saveSound(on: boolean): void {
    try {
        localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {
        // Не критично.
    }
}

/** Короткий сигнал тривоги без файлів: дві хвилі «сирени» через Web Audio. */
export function playSiren(): void {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.linearRampToValueAtTime(880, t + 0.6);
        osc.frequency.linearRampToValueAtTime(520, t + 1.2);
        osc.frequency.linearRampToValueAtTime(880, t + 1.8);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 2.3);
        osc.onended = () => void ctx.close();
    } catch {
        // Браузер не дозволив звук без дії людини — мовчимо.
    }
}

export function sourceGroupLabel(group: string | undefined): string {
    return (
        {
            official: tr('Офіційне'),
            intel: tr('Розвідка'),
            regional: tr('Регіональне'),
            aggregators: tr('Агрегатор'),
        }[group ?? ''] ?? tr('Канал')
    );
}
