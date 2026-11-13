import { useEffect, useState } from 'react';
import type {
    AlertDistrict,
    AlertPrefs,
    AlertPrefsPatch,
} from '@/components/alerts/alert-utils';
import { Toggle } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * «Налаштування сповіщень тривог»: регіон з довідника UkraineAlarm (область → район → громада)
 * і фільтри подій. Сповіщення — один раз на початку й один раз на відбій.
 */
export function AlertPlacePicker({
    prefs,
    onSave,
}: {
    prefs: AlertPrefs;
    onSave: (patch: AlertPrefsPatch) => void;
}) {
    const [districts, setDistricts] = useState<AlertDistrict[]>([]);
    const region = prefs.region;

    useEffect(() => {
        if (!region || !prefs.units_enabled) return;
        let alive = true;
        api<{ districts: AlertDistrict[] }>(
            'GET',
            `/alerts/units?region=${encodeURIComponent(region)}`,
        )
            .then((d) => alive && setDistricts(d.districts))
            .catch(() => undefined);

        return () => {
            alive = false;
        };
    }, [region, prefs.units_enabled]);

    const unit = prefs.unit;
    const district =
        unit?.type === 'District'
            ? unit.id
            : (districts.find((d) =>
                  d.communities.some((c) => c.id === unit?.id),
              )?.id ?? '');
    const communities =
        districts.find((d) => d.id === district)?.communities ?? [];
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
            {region && prefs.units_enabled && districts.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-white/50">
                        {tr('Район')}
                        <select
                            value={district}
                            onChange={(e) =>
                                onSave({ unit: e.target.value || null })
                            }
                            className="input-glass mt-1 h-10 w-full rounded-lg px-3 text-sm text-white"
                        >
                            <option value="">{tr('Уся область')}</option>
                            {districts.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs text-white/50">
                        {tr('Громада')}
                        <select
                            value={unit?.type === 'Community' ? unit.id : ''}
                            disabled={!district || communities.length === 0}
                            onChange={(e) =>
                                onSave({ unit: e.target.value || district })
                            }
                            className="input-glass mt-1 h-10 w-full rounded-lg px-3 text-sm text-white disabled:opacity-50"
                        >
                            <option value="">{tr('Увесь район')}</option>
                            {communities.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
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
