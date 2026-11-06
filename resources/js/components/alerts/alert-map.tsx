import {
    Clock,
    Gauge,
    MapPin,
    Minus,
    Plus,
    Radio,
    RefreshCw,
    X,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import units from '@/data/ua-units.json';
import { tr } from '@/lib/i18n';

export type AlertKind =
    | 'air_raid'
    | 'artillery'
    | 'urban_fights'
    | 'chemical'
    | 'nuclear';

export type AlertRegion = {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    active: boolean;
    /** air_raid — уся область, partial — частина області, інше — вид тривоги. */
    type: 'air_raid' | 'partial' | Exclude<AlertKind, 'air_raid'> | null;
    kind: AlertKind | null;
    started_at: string | null;
    minutes: number | null;
};

/** Район чи громада під тривогою (код КАТОТТГ). */
export type AlertUnit = {
    code: string;
    kind: AlertKind;
    started_at: string | null;
};

export type ThreatVariant = 'shahed' | 'jet' | 'gerbera' | 'fpv' | 'cruise';

export type AirThreat = {
    id: number;
    type: 'uav' | 'missile' | 'ballistic' | 'kab' | 'mig' | 'artillery';
    /** Різновид для значка й швидкості (для БпЛА й ракет). */
    variant: ThreatVariant | null;
    region: string | null;
    place: string | null;
    title: string;
    lat: number;
    lng: number;
    course: number | null;
    speed: number;
    /** Упевненість 0–100 за кількістю й вагою джерел. */
    confidence: number;
    sources: string[];
    detected_at: string;
    expires_at: string;
    /** Коли мітку востаннє підтвердило джерело. */
    updated_at: string;
};

/** Колір виду тривоги (без фіолетового й рожевого). */
export const KIND_COLOR: Record<AlertKind, string> = {
    air_raid: '#c42525',
    artillery: '#e0661a',
    urban_fights: '#8a2f12',
    chemical: '#5f9e1c',
    nuclear: '#d4a20b',
};

/** «Жовтий рівень»: в області тривога, але не в цьому районі. */
export const NEARBY_COLOR = '#eab308';

/** Колір області в списках: повна, часткова чи свій вид тривоги. */
export const ALERT_COLOR: Record<string, string> = {
    ...KIND_COLOR,
    partial: '#f59e0b',
};

export function kindLabel(kind: AlertKind | 'partial' | 'nearby'): string {
    return {
        air_raid: tr('Повітряна тривога'),
        artillery: tr('Загроза артобстрілу'),
        urban_fights: tr('Вуличні бої'),
        chemical: tr('Хімічна загроза'),
        nuclear: tr('Радіаційна загроза'),
        partial: tr('Частина області'),
        nearby: tr('Тривога поруч'),
    }[kind];
}

/** Колір цілі за типом (без фіолетового й рожевого). */
export const THREAT_COLOR: Record<AirThreat['type'], string> = {
    uav: '#38bdf8',
    missile: '#f97316',
    ballistic: '#ef4444',
    kab: '#facc15',
    mig: '#22d3ee',
    artillery: '#eab308',
};

export function threatLabel(type: AirThreat['type']): string {
    return {
        uav: tr('БпЛА'),
        missile: tr('Ракета'),
        ballistic: tr('Балістика'),
        kab: tr('КАБ'),
        mig: tr('МіГ-31К'),
        artillery: tr('Артилерія'),
    }[type];
}

/** Назва різновиду, якщо відомий (у картці цілі). */
export function threatTitle(
    threat: Pick<AirThreat, 'type' | 'variant'>,
): string {
    switch (threat.variant) {
        case 'shahed':
            return tr('Shahed / БпЛА');
        case 'jet':
            return tr('Реактивний Shahed');
        case 'gerbera':
            return tr('Гербера (імітатор)');
        case 'fpv':
            return tr('FPV-дрон');
        case 'cruise':
            return tr('Крилата ракета');
        default:
            return threatLabel(threat.type);
    }
}

/**
 * Значки цілей у квадраті 24×24, носом на північ (обертаються за курсом):
 * «Шахед»/«Гербера» — дельта-крило з носом і гвинтом, реактивний — дельта з соплом,
 * FPV — квадрокоптер, крилата ракета — корпус з крилами й хвостовим оперенням,
 * балістика — гостра ракета зі стабілізаторами, КАБ — бомба, МіГ — літак, артилерія — спалах.
 */
export const GLYPHS = {
    // «Шахед»/«Герань-2» і «Гербера»: дельта, вертикальні законцівки крил і гвинт позаду.
    shahed: 'M12 1c1 0 1.5 1.2 1.5 3v2.6l8.3 10.5V16h1.1v5h-1.1v-1.4h-8.5l-.4 1.2h2.4v1.5H8.7v-1.5h2.4l-.4-1.2H2.2V21H1.1v-5h1.1v1.1l8.3-10.5V4c0-1.8.5-3 1.5-3Z',
    // Реактивний «Герань-3/5»: та сама дельта без гвинта, сопло з двома прорізами.
    jet: 'M12 1c1.1 0 1.6 1.4 1.6 3.4v2.3L23 17.4v2.6h-9.1l.1-1.5c0-.5-.4-.7-.7-.4l-.4.6v3.6h-1.8v-3.6l-.4-.6c-.3-.3-.7-.1-.7.4l.1 1.5H1v-2.6l9.4-10.7V4.4C10.4 2.4 10.9 1 12 1Z',
    fpv: 'M5 1.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Zm14 0a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM5 15.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Zm14 0a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM6.2 4.8 12 9.4l5.8-4.6 1.4 1.4-4.6 5.8 4.6 5.8-1.4 1.4-5.8-4.6-5.8 4.6-1.4-1.4 4.6-5.8-4.6-5.8ZM10 6.5h4v11h-4Z',
    cruise: 'M12 1c.8 0 1.2.8 1.2 2v6.2l8.3 2.1v1.7l-8.3-.7v6.4l3.4 1.9v1.5l-3.4-.6-.2 2.5h-2l-.2-2.5-3.4.6v-1.5l3.4-1.9v-6.4l-8.3.7v-1.7l8.3-2.1V3c0-1.2.4-2 1.2-2Z',
    ballistic:
        'M12 .5l1.5 4.6v4l2 1.7v1.4l-2-.4v8.4l2.2 1.7V23H8.3v-1.1l2.2-1.7v-8.4l-2 .4v-1.4l2-1.7v-4Z',
    kab: 'M12 1.5c2.6 0 3.8 2.8 3.8 6.7v7l2.6 3.3v2.2l-3.4-1.6-3 3.4-3-3.4-3.4 1.6v-2.2l2.6-3.3v-7c0-3.9 1.2-6.7 3.8-6.7Z',
    mig: 'M12 .8 13.6 7l8.6 6.1v2.1l-8.7-2.6-.5 6.2 3.1 2.1v1.6l-4.1-1-4.1 1v-1.6l3.1-2.1-.5-6.2-8.7 2.6v-2.1L10.4 7Z',
    artillery:
        'M12 2l2 6 6-2-4 5 5 4-6 .5L13 22l-1-6-4 4.5.8-6.3L3 13.5l5.3-2.6L5 5.5l5.4 2.6Z',
} as const;

/** Значок цілі: різновид, а якщо невідомий — тип (БпЛА → «Шахед», ракета → крилата). */
export function glyphFor(threat: Pick<AirThreat, 'type' | 'variant'>): string {
    if (threat.variant === 'gerbera') return GLYPHS.shahed;
    if (threat.variant) return GLYPHS[threat.variant];
    return {
        uav: GLYPHS.shahed,
        missile: GLYPHS.cruise,
        ballistic: GLYPHS.ballistic,
        kab: GLYPHS.kab,
        mig: GLYPHS.mig,
        artillery: GLYPHS.artillery,
    }[threat.type];
}

/** Для легенди за типом. */
export const THREAT_GLYPH: Record<AirThreat['type'], string> = {
    uav: GLYPHS.shahed,
    missile: GLYPHS.cruise,
    ballistic: GLYPHS.ballistic,
    kab: GLYPHS.kab,
    mig: GLYPHS.mig,
    artillery: GLYPHS.artillery,
};

export const W = 1000;
export const H = 680;
const LNG0 = 22.0;
const LNG1 = 40.4;
const LAT0 = 44.2;
const LAT1 = 52.5;

/** Проста проєкція для мапи України (та сама, що в `resources/js/data/ua-units.json`). */
export function project(lat: number, lng: number): [number, number] {
    const x = ((lng - LNG0) / (LNG1 - LNG0)) * W;
    const y = ((LAT1 - lat) / (LAT1 - LAT0)) * H;

    return [x, y];
}

/** Найдальше, куди «доповзає» мітка від точки зі зведення (км), щоб не відлітала за межі здорового глузду. */
const MAX_DRIFT_KM = 200;

/**
 * Поточне розрахункове місце цілі: точка зі зведення + курс × швидкість типу × час,
 * що минув (до «згасання» мітки). Без курсу чи швидкості — стоїть на місці.
 */
export function threatPosition(
    threat: AirThreat,
    now: number,
): { lat: number; lng: number } {
    if (threat.course === null || !threat.speed) {
        return { lat: threat.lat, lng: threat.lng };
    }
    const end = Math.min(now, Date.parse(threat.expires_at));
    const hours = Math.max(0, end - Date.parse(threat.detected_at)) / 3_600_000;
    const km = Math.min(MAX_DRIFT_KM, threat.speed * hours);
    const rad = (threat.course * Math.PI) / 180;
    const lat = threat.lat + (km * Math.cos(rad)) / 111;
    const lng =
        threat.lng +
        (km * Math.sin(rad)) / (111 * Math.cos((threat.lat * Math.PI) / 180));

    return { lat, lng };
}

type Shape = { c: string; n: string; o: string; d: string };
type UnitShape = Shape & { x: number; y: number };

const UNITS = units.units as UnitShape[];
const OBLASTS = units.oblasts as { k: string; o: string; d: string }[];
const KNOWN = new Set(UNITS.map((u) => u.c));
/** Чорнобильська зона відчуження (частина Вишгородського району поза громадами). */
const CHEZ = (units as { chez?: { d: string; x: number; y: number } }).chez;

/** Найбільший масштаб мапи (кнопки «+» / «−»). */
const MAX_ZOOM = 3.25;

/** Тривога, що триває понад добу (окуповані території тощо), — зі штрихуванням. */
const LONG_MS = 24 * 3_600_000;

/**
 * Мапа тривог: райони (і громади, якщо тривога там) зафарбовані за видом тривоги,
 * межі областей, жовтий рівень у частково охоплених областях, рухомі цілі зі значками за типом.
 * Межі: © учасники OpenStreetMap (ODbL), реєстр КАТОТТГ.
 */
export function AlertMap({
    regions,
    units: alerted,
    threats,
    mine,
    onSelect,
    showAlerts = true,
    now,
}: {
    regions: AlertRegion[];
    units: AlertUnit[];
    threats: AirThreat[];
    mine: string | null;
    onSelect?: (slug: string) => void;
    /** Шар тривог (вимикається фільтром). */
    showAlerts?: boolean;
    /** Поточний час (мс) — цілі рухаються за курсом; без нього стоять у точці зведення. */
    now?: number;
}) {
    const reduce = useReducedMotion();
    const id = useId().replace(/:/g, '');
    const byCode = useMemo(
        () => new Map(alerted.map((u) => [u.code, u])),
        [alerted],
    );
    const partial = useMemo(
        () =>
            new Set(
                regions
                    .filter((r) => r.active && r.type === 'partial')
                    .map((r) => r.slug),
            ),
        [regions],
    );
    // Громади з тривогою — окремий файл меж, вантажимо лише коли вони потрібні.
    const needHromadas = alerted.some((u) => !KNOWN.has(u.code));
    const [hromadas, setHromadas] = useState<Shape[] | null>(null);
    useEffect(() => {
        if (!needHromadas || hromadas) return;
        void import('@/data/ua-hromadas.json').then((mod) =>
            setHromadas(mod.default as Shape[]),
        );
    }, [needHromadas, hromadas]);
    const clock = now ?? 0;
    const [selected, setSelected] = useState<number | null>(null);
    const [zoom, setZoom] = useState(1);
    const scroller = useRef<HTMLDivElement>(null);
    // Масштабуємо навколо центру видимої частини (або обраної цілі).
    const zoomTo = (next: number) => {
        const el = scroller.current;
        const z = Math.min(MAX_ZOOM, Math.max(1, next));
        if (!el) return setZoom(z);
        const cx = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
        const cy = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight;
        setZoom(z);
        requestAnimationFrame(() => {
            el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2;
            el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2;
        });
    };
    const picked = threats.find((t) => t.id === selected) ?? null;
    const pickedAt = picked
        ? project(
              ...((p) => [p.lat, p.lng] as const)(
                  now ? threatPosition(picked, now) : picked,
              ),
          )
        : null;

    const fill = (code: string, oblast: string) => {
        const unit = showAlerts ? byCode.get(code) : undefined;
        if (unit) {
            const long =
                clock > 0 &&
                unit.started_at !== null &&
                clock - Date.parse(unit.started_at) > LONG_MS;
            return {
                fill: long
                    ? `url(#hatch-${unit.kind}-${id})`
                    : KIND_COLOR[unit.kind],
                opacity: 0.85,
            };
        }
        if (showAlerts && partial.has(oblast)) {
            return { fill: `url(#nearby-${id})`, opacity: 1 };
        }
        return { fill: 'rgb(255 255 255 / 0.045)', opacity: 1 };
    };
    const special = showAlerts
        ? alerted.filter((u) => u.kind === 'nuclear' || u.kind === 'chemical')
        : [];

    return (
        <div className="relative">
            <div
                ref={scroller}
                className="[scrollbar-width:thin] overflow-auto overscroll-contain rounded-xl"
                style={{ maxHeight: zoom > 1 ? '70vh' : undefined }}
            >
                <div className="relative" style={{ width: `${zoom * 100}%` }}>
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="h-auto w-full"
                        role="img"
                        aria-label={tr('Мапа тривог України')}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelected(null);
                        }}
                    >
                        <defs>
                            {(Object.keys(KIND_COLOR) as AlertKind[]).map(
                                (kind) => (
                                    <pattern
                                        key={kind}
                                        id={`hatch-${kind}-${id}`}
                                        width="6"
                                        height="6"
                                        patternUnits="userSpaceOnUse"
                                        patternTransform="rotate(45)"
                                    >
                                        <rect
                                            width="6"
                                            height="6"
                                            fill={KIND_COLOR[kind]}
                                        />
                                        <line
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="6"
                                            stroke="rgb(0 0 0 / 0.45)"
                                            strokeWidth="2.2"
                                        />
                                    </pattern>
                                ),
                            )}
                            <pattern
                                id={`chez-${id}`}
                                width="5"
                                height="5"
                                patternUnits="userSpaceOnUse"
                                patternTransform="rotate(45)"
                            >
                                <line
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="5"
                                    stroke="rgb(0 0 0 / 0.55)"
                                    strokeWidth="1.8"
                                />
                            </pattern>
                            {/* Жовтий рівень: жовті смуги поверх темного, щоб не змішувалось у оливковий. */}
                            <pattern
                                id={`nearby-${id}`}
                                width="7"
                                height="7"
                                patternUnits="userSpaceOnUse"
                                patternTransform="rotate(-45)"
                            >
                                <rect
                                    width="7"
                                    height="7"
                                    fill="rgb(234 179 8 / 0.10)"
                                />
                                <line
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="7"
                                    stroke={NEARBY_COLOR}
                                    strokeOpacity={0.55}
                                    strokeWidth="1.6"
                                />
                            </pattern>
                        </defs>

                        {UNITS.map((u) => {
                            const f = fill(u.c, u.o);
                            const unit = byCode.get(u.c);
                            return (
                                <path
                                    key={u.c}
                                    d={u.d}
                                    fill={f.fill}
                                    fillOpacity={f.opacity}
                                    stroke="rgb(255 255 255 / 0.12)"
                                    strokeWidth={0.6}
                                    className={
                                        onSelect ? 'cursor-pointer' : undefined
                                    }
                                    onClick={() => onSelect?.(u.o)}
                                >
                                    <title>
                                        {u.n}
                                        {unit
                                            ? ` · ${kindLabel(unit.kind)}`
                                            : ''}
                                    </title>
                                </path>
                            );
                        })}

                        {hromadas
                            ?.filter((h) => byCode.has(h.c))
                            .map((h) => {
                                const f = fill(h.c, h.o);
                                const unit = byCode.get(h.c);
                                return (
                                    <path
                                        key={h.c}
                                        d={h.d}
                                        fill={f.fill}
                                        fillOpacity={0.95}
                                        stroke="rgb(0 0 0 / 0.35)"
                                        strokeWidth={0.5}
                                    >
                                        <title>
                                            {h.n}
                                            {unit
                                                ? ` · ${kindLabel(unit.kind)}`
                                                : ''}
                                        </title>
                                    </path>
                                );
                            })}

                        {CHEZ && (
                            // Зона відчуження завжди штрихована поверх заливки — тривога під нею видна як скрізь.
                            <g pointerEvents="none">
                                <path
                                    d={CHEZ.d}
                                    fill={`url(#chez-${id})`}
                                    stroke="rgb(255 255 255 / 0.45)"
                                    strokeWidth={0.8}
                                    strokeDasharray="3 2"
                                >
                                    <title>
                                        {tr('Чорнобильська зона відчуження')}
                                    </title>
                                </path>
                                <text
                                    x={CHEZ.x}
                                    y={CHEZ.y + 5}
                                    textAnchor="middle"
                                    fontSize={14}
                                    fill="rgb(255 255 255 / 0.8)"
                                >
                                    ☢
                                </text>
                            </g>
                        )}

                        {OBLASTS.map((o) => (
                            <path
                                key={o.k}
                                d={o.d}
                                fill="none"
                                stroke={
                                    o.o === mine
                                        ? 'rgb(255 255 255 / 0.9)'
                                        : 'rgb(255 255 255 / 0.35)'
                                }
                                strokeWidth={o.o === mine ? 2.2 : 1.1}
                                pointerEvents="none"
                            />
                        ))}

                        {regions
                            .filter((r) => r.slug !== 'kyiv')
                            .map((r) => {
                                const [x, y] = project(r.lat, r.lng);
                                return (
                                    <text
                                        key={r.slug}
                                        x={x}
                                        y={y}
                                        textAnchor="middle"
                                        fontSize={14}
                                        fontWeight={600}
                                        fill="rgb(255 255 255 / 0.62)"
                                        pointerEvents="none"
                                    >
                                        {r.name
                                            .replace(' область', '')
                                            .replace(
                                                'Автономна Республіка ',
                                                '',
                                            )}
                                    </text>
                                );
                            })}

                        {special.map((u) => {
                            const shape = UNITS.find((s) => s.c === u.code);
                            if (!shape) return null;
                            return (
                                <text
                                    key={`s-${u.code}`}
                                    x={shape.x}
                                    y={shape.y + 6}
                                    textAnchor="middle"
                                    fontSize={18}
                                    pointerEvents="none"
                                >
                                    {u.kind === 'nuclear' ? '☢' : '☣'}
                                </text>
                            );
                        })}

                        {threats
                            .filter((t) => t.region !== null)
                            .map((threat) => {
                                const [ox, oy] = project(
                                    threat.lat,
                                    threat.lng,
                                );
                                const pos = now
                                    ? threatPosition(threat, now)
                                    : threat;
                                const [x, y] = project(pos.lat, pos.lng);
                                const moved = Math.hypot(x - ox, y - oy) > 1;
                                const color = THREAT_COLOR[threat.type];

                                return (
                                    <m.g
                                        key={threat.id}
                                        className="cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelected(threat.id);
                                        }}
                                        initial={
                                            reduce ? false : { opacity: 0 }
                                        }
                                        // Менш упевнена мітка — блідіша.
                                        animate={{
                                            opacity:
                                                0.45 +
                                                (threat.confidence / 100) *
                                                    0.55,
                                        }}
                                    >
                                        <title>
                                            {threatTitle(threat)} ·{' '}
                                            {threat.place} · {threat.confidence}
                                            %
                                        </title>
                                        {moved && (
                                            // Слід від точки виявлення до розрахункового місця.
                                            <line
                                                x1={ox}
                                                y1={oy}
                                                x2={x}
                                                y2={y}
                                                stroke={color}
                                                strokeOpacity={0.45}
                                                strokeWidth={2}
                                                strokeDasharray="5 4"
                                            />
                                        )}
                                        {/* Більша зона натискання. */}
                                        <circle
                                            cx={x}
                                            cy={y}
                                            r={16}
                                            fill="transparent"
                                        />
                                        {threat.id === selected && (
                                            <circle
                                                cx={x}
                                                cy={y}
                                                r={17}
                                                fill="none"
                                                stroke="#ffffff"
                                                strokeOpacity={0.8}
                                                strokeWidth={1.5}
                                            />
                                        )}
                                        <path
                                            d={glyphFor(threat)}
                                            fill={color}
                                            stroke="#0b1220"
                                            strokeWidth={1.3}
                                            strokeLinejoin="round"
                                            transform={`translate(${x} ${y}) rotate(${threat.course ?? 0}) scale(1.15) translate(-12 -12)`}
                                        />
                                    </m.g>
                                );
                            })}

                        <text
                            x={W - 6}
                            y={H - 6}
                            textAnchor="end"
                            fontSize={10}
                            fill="rgb(255 255 255 / 0.35)"
                        >
                            © OpenStreetMap · ODbL
                        </text>
                    </svg>
                    <AnimatePresence>
                        {picked && pickedAt && (
                            <ThreatCard
                                key={picked.id}
                                threat={picked}
                                now={clock}
                                regionName={
                                    regions.find(
                                        (r) => r.slug === picked.region,
                                    )?.name ?? null
                                }
                                left={(pickedAt[0] / W) * 100}
                                top={(pickedAt[1] / H) * 100}
                                onClose={() => setSelected(null)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
            {/* Масштаб: на телефоні мапа дрібна — збільшуємо й гортаємо пальцем. */}
            <div className="absolute top-2 right-2 flex flex-col overflow-hidden rounded-xl bg-[#0d1626]/85 backdrop-blur">
                <button
                    type="button"
                    onClick={() => zoomTo(zoom + 0.75)}
                    disabled={zoom >= MAX_ZOOM}
                    aria-label={tr('Збільшити')}
                    className="flex size-9 items-center justify-center text-white/80 hover:text-white disabled:opacity-35"
                >
                    <Plus className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={() => zoomTo(zoom - 0.75)}
                    disabled={zoom <= 1}
                    aria-label={tr('Зменшити')}
                    className="flex size-9 items-center justify-center text-white/80 hover:text-white disabled:opacity-35"
                >
                    <Minus className="size-4" />
                </button>
            </div>
        </div>
    );
}

/** «4 хв тому», «щойно», «1 год 5 хв тому». */
function ago(iso: string, now: number): string {
    const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
    if (min < 1) return tr('щойно');
    if (min < 60) return tr('{m} хв тому', { m: min });
    return tr('{h} год {m} хв тому', { h: Math.floor(min / 60), m: min % 60 });
}

/**
 * Картка цілі над міткою: тип, приблизне місце, швидкість і курс, коли помічена вперше
 * й коли востаннє підтверджена, скільки джерел.
 */
function ThreatCard({
    threat,
    now,
    regionName,
    left,
    top,
    onClose,
}: {
    threat: AirThreat;
    now: number;
    regionName: string | null;
    left: number;
    top: number;
    onClose: () => void;
}) {
    const reduce = useReducedMotion();
    const below = top < 38;
    const region = regionName
        ?.replace(' область', '')
        .replace('Автономна Республіка ', '');

    return (
        <m.div
            role="dialog"
            aria-label={threatTitle(threat)}
            initial={reduce ? false : { opacity: 0, y: below ? -6 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 w-64 rounded-2xl bg-[#0d1626]/95 p-3.5 text-sm text-white/85 backdrop-blur-xl"
            style={{
                left: `clamp(8px, calc(${left}% - 128px), calc(100% - 264px))`,
                top: `${top}%`,
                transform: below
                    ? 'translateY(22px)'
                    : 'translateY(calc(-100% - 22px))',
            }}
        >
            <div className="flex items-center gap-2">
                <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: THREAT_COLOR[threat.type] }}
                />
                <b className="min-w-0 flex-1 truncate text-white">
                    {threatTitle(threat)}
                </b>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={tr('Закрити')}
                    className="-m-1 rounded-lg p-1 text-white/50 hover:text-white"
                >
                    <X className="size-4" />
                </button>
            </div>
            <p className="mt-2 flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-red-400" />
                <span>
                    ≈ {threat.place ?? tr('Україна')}
                    {region &&
                        threat.place !== regionName &&
                        `, ${region}`}{' '}
                    <span className="text-white/45">{tr('(орієнтовно)')}</span>
                </span>
            </p>
            {(threat.speed > 0 || threat.course !== null) && (
                <p className="mt-1.5 flex items-center gap-2">
                    <Gauge className="size-4 shrink-0 text-amber-300" />
                    {[
                        threat.speed > 0 &&
                            tr('{v} км/год', { v: threat.speed }),
                        threat.course !== null &&
                            tr('курс {c}°', { c: threat.course }),
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            )}
            <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2.5 text-xs text-white/55">
                {now > 0 && (
                    <>
                        <p className="flex items-center gap-2">
                            <Clock className="size-3.5 shrink-0" />
                            {tr('вперше помічена {t}', {
                                t: ago(threat.detected_at, now),
                            })}
                        </p>
                        <p className="flex items-center gap-2">
                            <RefreshCw className="size-3.5 shrink-0" />
                            {tr('оновлено {t}', {
                                t: ago(threat.updated_at, now),
                            })}
                        </p>
                    </>
                )}
                <p className="flex items-center gap-2">
                    <Radio className="size-3.5 shrink-0" />
                    {tr('джерел: {n} · упевненість {c}%', {
                        n: threat.sources.length,
                        c: threat.confidence,
                    })}
                </p>
            </div>
        </m.div>
    );
}
