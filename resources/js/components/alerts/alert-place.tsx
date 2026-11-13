import {
    ChevronLeft,
    ChevronRight,
    History,
    MapPin,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
    AlertPlaceHit,
    AlertPrefs,
    AlertPrefsPatch,
} from '@/components/alerts/alert-utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Toggle } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type HistoryAlarm = {
    type: string;
    name: string;
    start: string | null;
    end: string | null;
    minutes: number | null;
    ongoing: boolean;
    accent: string;
};

function minutesLabel(minutes: number): string {
    return minutes >= 60
        ? tr('{h} год {m} хв', { h: Math.floor(minutes / 60), m: minutes % 60 })
        : tr('{m} хв', { m: minutes });
}

/** Історія тривог мого місця з API (останні 25) і підсумок за тиждень. Відкривається за натисканням. */
function AlertHistory() {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<{
        alarms: HistoryAlarm[];
        week: { count: number; minutes: number };
    } | null>(null);

    useEffect(() => {
        if (!open || data) return;
        api<{
            alarms: HistoryAlarm[];
            week: { count: number; minutes: number };
        }>('GET', '/alerts/history')
            .then(setData)
            .catch(() =>
                setData({ alarms: [], week: { count: 0, minutes: 0 } }),
            );
    }, [open, data]);

    return (
        <div className="rounded-lg bg-white/[0.03]">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-white"
            >
                <History className="size-4 text-white/60" />
                <span className="flex-1">{tr('Історія тривог')}</span>
                <ChevronRight
                    className={cn(
                        'size-4 text-white/40 transition',
                        open && 'rotate-90',
                    )}
                />
            </button>
            {open && (
                <div className="px-3 pb-3">
                    {data === null ? (
                        <p className="text-xs text-white/45">
                            {tr('Завантаження…')}
                        </p>
                    ) : data.alarms.length === 0 ? (
                        <p className="text-xs text-white/45">
                            {tr('Тривог поки не було.')}
                        </p>
                    ) : (
                        <>
                            <p className="mb-2 text-xs text-white/55">
                                {tr('За тиждень: {n} тривог, разом {t}', {
                                    n: data.week.count,
                                    t: minutesLabel(data.week.minutes),
                                })}
                            </p>
                            <ul className="grid gap-1.5">
                                {data.alarms.map((a, i) => (
                                    <li
                                        key={`${a.start}-${i}`}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span
                                            aria-hidden
                                            className="size-2 shrink-0 rounded-full"
                                            style={{ background: a.accent }}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-white/85">
                                            {a.name}
                                        </span>
                                        <span className="shrink-0 text-xs text-white/45">
                                            {a.start
                                                ? new Date(
                                                      a.start,
                                                  ).toLocaleString('uk-UA', {
                                                      day: '2-digit',
                                                      month: '2-digit',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : ''}
                                            {' · '}
                                            {a.ongoing
                                                ? tr('триває')
                                                : a.minutes !== null
                                                  ? minutesLabel(a.minutes)
                                                  : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

type PlaceRow = {
    id: string;
    name: string;
    type: string;
    has_children: boolean;
};

function wholeLabel(type: string): string {
    switch (type) {
        case 'State':
            return tr('Обрати всю область');
        case 'District':
            return tr('Обрати весь район');
        case 'Community':
            return tr('Обрати всю громаду');
        default:
            return tr('Обрати все місто');
    }
}

/**
 * Вибір місця, як у застосунку «Тривога»: області → райони («Обрати всю область») →
 * громади («Обрати весь район») → міста й села; зверху пошук.
 */
export function PlaceDialog({
    open,
    onClose,
    onPick,
}: {
    open: boolean;
    onClose: () => void;
    onPick: (id: string) => void;
}) {
    const [stack, setStack] = useState<PlaceRow[]>([]);
    const [rows, setRows] = useState<PlaceRow[] | null>(null);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<AlertPlaceHit[]>([]);
    const parent = stack.at(-1) ?? null;

    useEffect(() => {
        if (!open) return;
        let alive = true;
        setRows(null);
        api<{ places: PlaceRow[] }>(
            'GET',
            `/alerts/places${parent ? `?parent=${encodeURIComponent(parent.id)}` : ''}`,
        )
            .then((d) => alive && setRows(d.places))
            .catch(() => alive && setRows([]));

        return () => {
            alive = false;
        };
    }, [open, parent]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
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
    }, [query]);

    const close = () => {
        setStack([]);
        setQuery('');
        onClose();
    };
    const pick = (id: string) => {
        setStack([]);
        setQuery('');
        onPick(id);
    };
    const row =
        'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] text-white transition hover:bg-white/[0.06]';

    return (
        <Dialog open={open} onOpenChange={(v) => !v && close()}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 p-4 sm:max-w-lg">
                <div className="flex items-center gap-2">
                    {parent && (
                        <button
                            type="button"
                            onClick={() => setStack((s) => s.slice(0, -1))}
                            aria-label={tr('Назад')}
                            className="flex size-9 items-center justify-center rounded-lg text-primary hover:bg-white/10"
                        >
                            <ChevronLeft className="size-5" />
                        </button>
                    )}
                    <DialogTitle className="truncate text-base">
                        {parent?.name ?? tr('Оберіть місце')}
                    </DialogTitle>
                </div>
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tr('Область, місто чи район…')}
                        aria-label={tr('Пошук місця')}
                        className="input-glass h-10 w-full rounded-lg pr-3 pl-9 text-sm text-white placeholder:text-white/35"
                    />
                </div>
                <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                    {query.trim().length >= 2 ? (
                        hits.map((hit) => (
                            <button
                                key={hit.id}
                                type="button"
                                onClick={() => pick(hit.id)}
                                className={row}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block">{hit.name}</span>
                                    <span className="block truncate text-xs text-white/45">
                                        {hit.type_label}
                                        {hit.path ? ` · ${hit.path}` : ''}
                                    </span>
                                </span>
                            </button>
                        ))
                    ) : rows === null ? (
                        <p className="p-4 text-center text-sm text-white/45">
                            {tr('Завантаження…')}
                        </p>
                    ) : (
                        <>
                            {parent && (
                                <button
                                    type="button"
                                    onClick={() => pick(parent.id)}
                                    className={cn(row, 'font-bold')}
                                >
                                    {wholeLabel(parent.type)}
                                </button>
                            )}
                            {rows.map((place) => (
                                <button
                                    key={place.id}
                                    type="button"
                                    onClick={() =>
                                        place.has_children
                                            ? setStack((s) => [...s, place])
                                            : pick(place.id)
                                    }
                                    className={row}
                                >
                                    <span className="min-w-0 flex-1">
                                        {place.name}
                                    </span>
                                    {place.has_children && (
                                        <ChevronRight className="size-4 shrink-0 text-white/40" />
                                    )}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
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
    const [open, setOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const places = prefs.places ?? [];
    const savePlaces = (next: { id: string; label: string }[]) =>
        onSave({ places: next });

    const filters: {
        key: 'start' | 'end' | 'red' | 'yellow' | 'silent' | 'hush';
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
        {
            key: 'hush',
            label: tr('Тиша під час тривоги'),
            hint: tr(
                'поки у вашому місці тривога, лайки, запрошення в гру й інше несрочне — лише в дзвіночку',
            ),
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
                    {/* Моє місце: точний статус саме тут; натиснути — вибір, як у «Тривозі». */}
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.07]"
                    >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-white/60" />
                        <span className="min-w-0 flex-1">
                            <span className="block text-xs text-white/45">
                                {tr('Моє місце')}
                            </span>
                            <span className="block text-sm font-semibold text-white">
                                {prefs.unit?.name ?? tr('Уся область')}
                            </span>
                            {prefs.unit && (
                                <span className="block truncate text-xs text-white/45">
                                    {prefs.unit.type_label} · {prefs.unit.path}
                                </span>
                            )}
                            <span className="mt-2 flex flex-wrap gap-1.5">
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
                            </span>
                        </span>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-white/40" />
                    </button>
                    <AlertHistory key={prefs.unit?.id ?? prefs.region ?? ''} />

                    {/* Інші місця: рідні, робота — окремі сповіщення з підписом. */}
                    <div className="grid gap-2">
                        <p className="text-xs text-white/50">
                            {tr(
                                'Інші місця — сповіщення з підписом, наприклад «Мама»',
                            )}
                        </p>
                        {places.map((place) => (
                            <div
                                key={place.id}
                                className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <input
                                        defaultValue={place.label}
                                        maxLength={30}
                                        placeholder={tr('Підпис')}
                                        aria-label={tr('Підпис місця')}
                                        onBlur={(e) => {
                                            const label = e.target.value.trim();
                                            if (label === place.label) return;
                                            savePlaces(
                                                places.map((p) => ({
                                                    id: p.id,
                                                    label:
                                                        p.id === place.id
                                                            ? label
                                                            : p.label,
                                                })),
                                            );
                                        }}
                                        className="input-glass h-8 w-full rounded-md px-2 text-sm font-semibold text-white"
                                    />
                                    <p className="mt-1 truncate text-xs text-white/50">
                                        {place.name} · {place.path}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {place.status.length === 0 ? (
                                            <span className="rounded-md bg-[#10B981]/15 px-2 py-0.5 text-[11px] font-semibold text-[#10B981]">
                                                {tr('Тривоги немає')}
                                            </span>
                                        ) : (
                                            place.status.map((st) => (
                                                <span
                                                    key={st.type}
                                                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                                    style={{
                                                        color: st.accent,
                                                        background: `color-mix(in srgb, ${st.accent} 16%, transparent)`,
                                                    }}
                                                >
                                                    {st.name}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        savePlaces(
                                            places
                                                .filter(
                                                    (p) => p.id !== place.id,
                                                )
                                                .map((p) => ({
                                                    id: p.id,
                                                    label: p.label,
                                                })),
                                        )
                                    }
                                    aria-label={tr('Прибрати місце')}
                                    className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-red-400"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        ))}
                        {places.length < 5 && (
                            <button
                                type="button"
                                onClick={() => setAdding(true)}
                                className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg bg-white/[0.06] px-3 text-sm text-white transition hover:bg-white/10"
                            >
                                <Plus className="size-4" />
                                {tr('Додати місце')}
                            </button>
                        )}
                    </div>
                    <PlaceDialog
                        open={adding}
                        onClose={() => setAdding(false)}
                        onPick={(id) => {
                            setAdding(false);
                            if (places.some((p) => p.id === id)) return;
                            savePlaces([
                                ...places.map((p) => ({
                                    id: p.id,
                                    label: p.label,
                                })),
                                { id, label: '' },
                            ]);
                        }}
                    />
                    <PlaceDialog
                        open={open}
                        onClose={() => setOpen(false)}
                        onPick={(id) => {
                            setOpen(false);
                            onSave({ unit: id });
                        }}
                    />
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
