import { Head } from '@inertiajs/react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Row = { code: string; name: string; count: number };

/** ISO 3166-1: літерний код → числовий (так позначені країни в world-atlas). */
const NUMERIC: Record<string, string> = {
    UA: '804',
    PL: '616',
    DE: '276',
    CZ: '203',
    SK: '703',
    RO: '642',
    MD: '498',
    LT: '440',
    LV: '428',
    EE: '233',
    GE: '268',
    KZ: '398',
    TR: '792',
    FR: '250',
    ES: '724',
    IT: '380',
    GB: '826',
    US: '840',
    CA: '124',
};

const WIDTH = 960;
const HEIGHT = 500;

/** Карта гравців: скільки людей з кожної країни; колір країни — за кількістю. */
export default function PlayersMap({ countries }: { countries: Row[] }) {
    const reduce = useReducedMotion();
    const [world, setWorld] = useState<GeoPermissibleObjects[] | null>(null);
    const [hover, setHover] = useState<Row | null>(null);
    const max = Math.max(1, ...countries.map((c) => c.count));
    const total = countries.reduce((sum, c) => sum + c.count, 0);
    const byNumeric = useMemo(() => {
        const map = new Map<string, Row>();
        for (const row of countries) {
            if (NUMERIC[row.code]) map.set(NUMERIC[row.code], row);
        }

        return map;
    }, [countries]);

    useEffect(() => {
        // Контури країн вантажимо окремим шматком лише на цій сторінці.
        void import('world-atlas/countries-110m.json').then((mod) => {
            const topo = (mod.default ?? mod) as unknown as Topology<{
                countries: GeometryCollection;
            }>;
            const geo = feature(topo, topo.objects.countries);
            setWorld(
                'features' in geo
                    ? (geo.features as GeoPermissibleObjects[])
                    : [],
            );
        });
    }, []);

    const path = useMemo(() => {
        const projection = geoEqualEarth().fitSize([WIDTH, HEIGHT], {
            type: 'Sphere',
        });

        return geoPath(projection);
    }, []);

    return (
        <>
            <Head title={tr('Карта гравців')} />
            <div className="mx-auto max-w-5xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Карта гравців')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Звідки гравці GameCon — за країною в профілі. Лише кількість, без імен.',
                        )}
                    </p>
                </header>
                <section className="glass relative overflow-hidden rounded-2xl p-2 sm:p-4">
                    <svg
                        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                        className="h-auto w-full"
                        role="img"
                        aria-label={tr('Карта гравців')}
                    >
                        {world?.map((country, i) => {
                            const id = String(
                                (country as { id?: string | number }).id ?? '',
                            );
                            const row = byNumeric.get(id);
                            const share = row ? row.count / max : 0;

                            return (
                                <m.path
                                    key={id || i}
                                    d={path(country) ?? undefined}
                                    initial={reduce ? false : { opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.4 }}
                                    onMouseEnter={() => setHover(row ?? null)}
                                    onMouseLeave={() => setHover(null)}
                                    className={cn(
                                        'stroke-white/10 transition-[fill]',
                                        row && row.count > 0
                                            ? 'cursor-pointer'
                                            : '',
                                    )}
                                    style={{
                                        strokeWidth: 0.5,
                                        fill:
                                            row && row.count > 0
                                                ? `rgba(56, 189, 248, ${0.25 + share * 0.7})`
                                                : 'rgba(255, 255, 255, 0.06)',
                                    }}
                                />
                            );
                        })}
                    </svg>
                    {hover && (
                        <div className="glass-strong pointer-events-none absolute top-4 left-4 rounded-xl px-3 py-2 text-sm text-white">
                            {hover.name}: <b>{hover.count}</b>
                        </div>
                    )}
                </section>
                <section className="glass rounded-2xl p-4">
                    <h2 className="mb-3 text-sm font-semibold text-white">
                        {tr('{total} гравців у {count} країнах', {
                            total,
                            count: countries.filter((c) => c.count > 0).length,
                        })}
                    </h2>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {countries
                            .filter((c) => c.count > 0)
                            .map((c) => (
                                <li
                                    key={c.code}
                                    className="flex items-center gap-3 text-sm"
                                >
                                    <span className="w-36 truncate text-white/80">
                                        {c.name}
                                    </span>
                                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                        <span
                                            className="block h-full rounded-full bg-sky-400"
                                            style={{
                                                width: `${(c.count / max) * 100}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="w-10 text-right text-white/60 tabular-nums">
                                        {c.count}
                                    </span>
                                </li>
                            ))}
                    </ul>
                </section>
            </div>
        </>
    );
}
