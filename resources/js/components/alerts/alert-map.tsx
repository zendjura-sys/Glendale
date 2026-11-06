import { m, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import outline from '@/data/ukraine-outline.json';
import { tr } from '@/lib/i18n';

export type AlertRegion = {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    active: boolean;
    type: 'air_raid' | 'artillery' | 'partial' | null;
    kind: string | null;
    started_at: string | null;
    minutes: number | null;
};

export type AirThreat = {
    id: number;
    type: 'uav' | 'missile' | 'ballistic' | 'kab' | 'mig' | 'artillery';
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
};

/** Колір тривоги: повітряна — червоний, часткова — помаранчевий, артобстріл — жовтий. */
export const ALERT_COLOR: Record<string, string> = {
    air_raid: '#ef4444',
    partial: '#f59e0b',
    artillery: '#eab308',
};

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

const W = 1000;
const H = 680;
const LNG0 = 22.0;
const LNG1 = 40.4;
const LAT0 = 44.2;
const LAT1 = 52.5;

/** Проста проєкція для мапи України (рівнопроміжна з поправкою на широту). */
function project(lat: number, lng: number): [number, number] {
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

/**
 * Мапа тривог: контур України, області (кола в центрах) з підсвіткою тривоги
 * й цілі зі стрілками курсу. Лише приблизні місця — центр міста чи області зі зведення.
 */
export function AlertMap({
    regions,
    threats,
    mine,
    onSelect,
    showAlerts = true,
    now,
}: {
    regions: AlertRegion[];
    threats: AirThreat[];
    mine: string | null;
    onSelect?: (slug: string) => void;
    /** Шар тривог за областями (вимикається фільтром). */
    showAlerts?: boolean;
    /** Поточний час (мс) — цілі рухаються за курсом; без нього стоять у точці зведення. */
    now?: number;
}) {
    const reduce = useReducedMotion();
    const path = useMemo(
        () =>
            (outline as number[][][])
                .map(
                    (ring) =>
                        'M' +
                        ring
                            .map(([lng, lat]) =>
                                project(lat, lng)
                                    .map((v) => v.toFixed(1))
                                    .join(','),
                            )
                            .join('L') +
                        'Z',
                )
                .join(''),
        [],
    );
    const placed = threats.filter((t) => t.region !== null);

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={tr('Мапа тривог України')}
        >
            <path
                d={path}
                fill="rgb(255 255 255 / 0.05)"
                stroke="rgb(255 255 255 / 0.22)"
                strokeWidth={1.5}
            />
            {regions.map((region) => {
                const [x, y] = project(region.lat, region.lng);
                const lit = region.active && showAlerts;
                const color = lit
                    ? (ALERT_COLOR[region.type ?? 'air_raid'] ?? '#ef4444')
                    : 'rgb(255 255 255 / 0.18)';
                const isMine = region.slug === mine;
                const small = region.slug === 'kyiv';

                return (
                    <g
                        key={region.slug}
                        className={onSelect ? 'cursor-pointer' : undefined}
                        onClick={() => onSelect?.(region.slug)}
                    >
                        <title>{region.name}</title>
                        {lit && !reduce && (
                            <m.circle
                                cx={x}
                                cy={y}
                                r={small ? 14 : 30}
                                fill={color}
                                initial={{ opacity: 0.35, scale: 1 }}
                                animate={{ opacity: 0, scale: 1.8 }}
                                transition={{
                                    duration: 2.4,
                                    repeat: Infinity,
                                    ease: 'easeOut',
                                }}
                                style={{ transformOrigin: `${x}px ${y}px` }}
                            />
                        )}
                        <circle
                            cx={x}
                            cy={y}
                            r={small ? 10 : 24}
                            fill={lit ? color : 'rgb(255 255 255 / 0.06)'}
                            fillOpacity={lit ? 0.55 : 1}
                            stroke={isMine ? '#ffffff' : color}
                            strokeWidth={isMine ? 3 : 1.5}
                        />
                        {!small && (
                            <text
                                x={x}
                                y={y + 40}
                                textAnchor="middle"
                                fontSize={15}
                                fill="rgb(255 255 255 / 0.7)"
                            >
                                {region.name
                                    .replace(' область', '')
                                    .replace('Автономна Республіка ', '')}
                            </text>
                        )}
                    </g>
                );
            })}
            {placed.map((threat) => {
                const [ox, oy] = project(threat.lat, threat.lng);
                const pos = now ? threatPosition(threat, now) : threat;
                const [x, y] = project(pos.lat, pos.lng);
                const moved = Math.hypot(x - ox, y - oy) > 1;
                const color = THREAT_COLOR[threat.type];
                const rad = ((threat.course ?? 0) * Math.PI) / 180;
                const tx = x + Math.sin(rad) * 46;
                const ty = y - Math.cos(rad) * 46;

                return (
                    <m.g
                        key={threat.id}
                        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                        // Менш упевнена мітка — блідіша.
                        animate={{
                            opacity: 0.45 + (threat.confidence / 100) * 0.55,
                            scale: 1,
                        }}
                        style={{ transformOrigin: `${ox}px ${oy}px` }}
                    >
                        {moved && (
                            // Слід від точки виявлення до розрахункового місця.
                            <line
                                x1={ox}
                                y1={oy}
                                x2={x}
                                y2={y}
                                stroke={color}
                                strokeOpacity={0.35}
                                strokeWidth={2}
                            />
                        )}
                        <title>
                            {threatLabel(threat.type)} · {threat.place} ·{' '}
                            {threat.confidence}%
                        </title>
                        {threat.course !== null && (
                            <>
                                <line
                                    x1={x}
                                    y1={y}
                                    x2={tx}
                                    y2={ty}
                                    stroke={color}
                                    strokeWidth={3}
                                    strokeDasharray="6 5"
                                />
                                <circle cx={tx} cy={ty} r={4.5} fill={color} />
                            </>
                        )}
                        <circle
                            cx={x}
                            cy={y}
                            r={9}
                            fill={color}
                            stroke="#0b1220"
                            strokeWidth={2.5}
                        />
                    </m.g>
                );
            })}
        </svg>
    );
}
