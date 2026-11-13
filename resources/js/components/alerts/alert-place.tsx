import { MapPin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
    AlertPlaceHit,
    AlertPlaceNode,
    AlertPrefs,
    AlertPrefsPatch,
} from '@/components/alerts/alert-utils';
import { Toggle } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Назва рівня для підпису поля каскаду. */
function levelLabel(type: string | undefined): string {
    switch (type) {
        case 'District':
            return tr('Район');
        case 'Community':
            return tr('Територіальна громада');
        case 'CityOrVillage':
            return tr('Населений пункт');
        case 'CityDistrict':
            return tr('Район міста');
        default:
            return tr('Місце');
    }
}

/**
 * «Налаштування сповіщень тривог», як у застосунку «Тривога»: пошук місця за назвою або вибір
 * крок за кроком — район → громада → місто/село → район міста (довідник UkraineAlarm).
 * Тривога в районі чи області над обраним місцем діє й на нього; сусідні громади — ні.
 */
export function AlertPlacePicker({
    prefs,
    onSave,
}: {
    prefs: AlertPrefs;
    onSave: (patch: AlertPrefsPatch) => void;
}) {
    const [tree, setTree] = useState<AlertPlaceNode[]>([]);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<AlertPlaceHit[]>([]);
    const region = prefs.region;

    useEffect(() => {
        if (!region || !prefs.units_enabled) return;
        let alive = true;
        api<{ tree?: AlertPlaceNode[] }>(
            'GET',
            `/alerts/units?region=${encodeURIComponent(region)}`,
        )
            .then((d) => alive && setTree(d.tree ?? []))
            .catch(() => undefined);

        return () => {
            alive = false;
        };
    }, [region, prefs.units_enabled]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2 || !prefs.units_enabled) {
            setHits([]);
            return;
        }
        const timer = window.setTimeout(() => {
            api<{ places: AlertPlaceHit[] }>(
                'GET',
                `/alerts/search?q=${encodeURIComponent(q)}`,
            )
                .then((d) => setHits(d.places))
                .catch(() => undefined);
        }, 250);

        return () => window.clearTimeout(timer);
    }, [query, prefs.units_enabled]);

    // Каскад: на кожному рівні — діти обраного вище вузла; path_ids[0] — область.
    const levels = useMemo(() => {
        const path = prefs.unit?.path_ids.slice(1) ?? [];
        const out: {
            options: AlertPlaceNode[];
            value: string;
            parent: string | null;
        }[] = [];
        let options = tree;
        let parent: string | null = null;
        for (let depth = 0; options.length > 0; depth++) {
            const value = path[depth] ?? '';
            out.push({ options, value, parent });
            const picked = options.find((o) => o.id === value);
            if (!picked) break;
            parent = picked.id;
            options = picked.children;
        }

        return out;
    }, [tree, prefs.unit]);

    const filters: {
        key: 'start' | 'end' | 'red' | 'yellow' | 'silent';
        label: string;
        hint: string;
        dot?: string;
    }[] = [
        {
            key: 'start',
            label: tr('Початок тривоги'),
            hint: tr('одразу, як API оголосить тривогу'),
        },
        {
            key: 'end',
            label: tr('Відбій тривоги'),
            hint: tr('з тривалістю тривоги'),
        },
        {
            key: 'red',
            label: tr('Червоні тривоги'),
            hint: tr('ракетна небезпека, хімічна, радіаційна — в укриття'),
            dot: 'bg-[#EF4444]',
        },
        {
            key: 'yellow',
            label: tr('Жовті тривоги'),
            hint: tr(
                'лише БпЛА, артобстріл, вуличні бої, інформаційні, локальні в районах',
            ),
            dot: 'bg-[#F59E0B]',
        },
        {
            key: 'silent',
            label: tr('Беззвучний режим'),
            hint: tr('лише рядок у дзвіночку, без push і звуку'),
        },
    ];

    return (
        <div className="mt-4 grid gap-4 border-t border-[var(--gc-hairline)] pt-4">
            <h3 className="text-sm font-semibold text-white">
                {tr('Налаштування сповіщень тривог')}
            </h3>
            {!prefs.units_enabled && (
                <p className="text-xs text-amber-300">
                    {tr(
                        'Офіційне джерело UkraineAlarm ще не підключено — сповіщень про тривоги поки немає.',
                    )}
                </p>
            )}

            {prefs.units_enabled && (
                <>
                    {/* Моє місце: точний статус саме тут. */}
                    <div className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-3">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-white/60" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">
                                {prefs.unit?.name ?? tr('Уся область')}
                            </p>
                            {prefs.unit && (
                                <p className="truncate text-xs text-white/45">
                                    {prefs.unit.type_label} · {prefs.unit.path}
                                </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {prefs.status.length === 0 ? (
                                    <span className="rounded-md bg-[#10B981]/15 px-2 py-0.5 text-xs font-semibold text-[#10B981]">
                                        {tr('Тривоги немає')}
                                    </span>
                                ) : (
                                    prefs.status.map((s) => (
                                        <span
                                            key={s.type}
                                            className="rounded-md px-2 py-0.5 text-xs font-semibold"
                                            style={{
                                                color: s.accent,
                                                background: `color-mix(in srgb, ${s.accent} 16%, transparent)`,
                                            }}
                                        >
                                            {s.name}
                                            {s.level === 'yellow'
                                                ? ` · ${tr('жовтий рівень')}`
                                                : s.level === 'red'
                                                  ? ` · ${tr('червоний рівень')}`
                                                  : ''}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                        {prefs.unit && (
                            <button
                                type="button"
                                onClick={() => onSave({ unit: null })}
                                aria-label={tr('Уся область')}
                                className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>

                    {/* Пошук: місто, село, громада чи район по всій Україні. */}
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={tr(
                                'Знайти місто, село, громаду чи район',
                            )}
                            aria-label={tr('Пошук місця')}
                            className="input-glass h-10 w-full rounded-lg pr-3 pl-9 text-sm text-white placeholder:text-white/35"
                        />
                        {hits.length > 0 && (
                            <ul className="gc-solid absolute inset-x-0 top-11 z-20 max-h-72 overflow-auto rounded-lg p-1">
                                {hits.map((hit) => (
                                    <li key={hit.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSave({ unit: hit.id });
                                                setQuery('');
                                                setHits([]);
                                            }}
                                            className="block w-full rounded-md px-3 py-2 text-left transition hover:bg-white/10"
                                        >
                                            <span className="block text-sm text-white">
                                                {hit.name}
                                            </span>
                                            <span className="block truncate text-xs text-white/45">
                                                {hit.type_label}
                                                {hit.path
                                                    ? ` · ${hit.path}`
                                                    : ''}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Або крок за кроком: район → громада → місто/село → район міста. */}
                    {region && levels.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {levels.map((level, depth) => (
                                <label
                                    key={depth}
                                    className="text-xs text-white/50"
                                >
                                    {levelLabel(level.options[0]?.type)}
                                    <select
                                        value={level.value}
                                        onChange={(e) =>
                                            onSave({
                                                unit:
                                                    e.target.value ||
                                                    level.parent,
                                            })
                                        }
                                        className="input-glass mt-1 h-10 w-full rounded-lg px-3 text-sm text-white"
                                    >
                                        <option value="">
                                            {depth === 0
                                                ? tr('Уся область')
                                                : tr('Усе вище обране')}
                                        </option>
                                        {level.options.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div
                className={cn(
                    'grid gap-1 sm:grid-cols-2',
                    !prefs.push && 'pointer-events-none opacity-50',
                )}
            >
                {filters.map((f) => (
                    <label
                        key={f.key}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm text-white"
                    >
                        <Toggle
                            checked={prefs[f.key]}
                            onChange={(v) => onSave({ [f.key]: v })}
                            label={f.label}
                        />
                        <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                                {f.dot && (
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-2 rounded-full',
                                            f.dot,
                                        )}
                                    />
                                )}
                                {f.label}
                            </span>
                            <span className="block text-xs text-white/45">
                                {f.hint}
                            </span>
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
