import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CriteriaKind = 'game' | 'movie';
export type Criteria = Record<string, number>;

/** Критерії оцінки (як у App\Support\ReviewCriteria). */
export const CRITERIA = (kind: CriteriaKind): [string, string][] =>
    kind === 'game'
        ? [
              ['story', tr('Сюжет')],
              ['graphics', tr('Графіка')],
              ['sound', tr('Звук')],
              ['gameplay', tr('Геймплей')],
          ]
        : [
              ['story', tr('Сюжет')],
              ['visuals', tr('Візуал')],
              ['sound', tr('Звук')],
              ['acting', tr('Акторська гра')],
          ];

/** Ввід: для кожного критерію 10 сегментів; повторне натискання на ту саму оцінку — зняти. */
export function CriteriaInput({
    kind,
    value,
    onChange,
}: {
    kind: CriteriaKind;
    value: Criteria;
    onChange: (next: Criteria) => void;
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs text-white/50">
                {tr('За критеріями (необов’язково)')}
            </p>
            {CRITERIA(kind).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-white/75">
                        {label}
                    </span>
                    <div
                        role="radiogroup"
                        aria-label={label}
                        className="flex flex-1 gap-1"
                    >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                            (n) => (
                                <button
                                    key={n}
                                    type="button"
                                    role="radio"
                                    aria-checked={value[key] === n}
                                    aria-label={`${label}: ${n}`}
                                    onClick={() => {
                                        const next = { ...value };
                                        if (next[key] === n) delete next[key];
                                        else next[key] = n;
                                        onChange(next);
                                    }}
                                    className={cn(
                                        'h-3.5 flex-1 rounded-full transition-colors',
                                        (value[key] ?? 0) >= n
                                            ? 'bg-primary'
                                            : 'bg-white/[0.08] hover:bg-white/[0.16]',
                                    )}
                                />
                            ),
                        )}
                    </div>
                    <b className="w-6 text-right text-sm text-white tabular-nums">
                        {value[key] ?? '–'}
                    </b>
                </div>
            ))}
        </div>
    );
}

/** Підсумок: середні за критеріями смугами (лише ті, що вже хтось оцінив). */
export function CriteriaBars({
    kind,
    averages,
}: {
    kind: CriteriaKind;
    averages?: Record<string, number | null> | null;
}) {
    const rows = CRITERIA(kind).filter(([key]) => averages?.[key] != null);
    if (rows.length === 0) return null;

    return (
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {rows.map(([key, label]) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-white/65">{label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                        <span
                            className="block h-full rounded-full bg-primary"
                            style={{
                                width: `${((averages?.[key] ?? 0) / 10) * 100}%`,
                            }}
                        />
                    </span>
                    <b className="w-8 text-right text-white tabular-nums">
                        {averages?.[key]}
                    </b>
                </div>
            ))}
        </div>
    );
}

/** У відгуку: компактні оцінки «Сюжет 9 · Графіка 7…». */
export function CriteriaChips({
    kind,
    criteria,
}: {
    kind: CriteriaKind;
    criteria?: Criteria | null;
}) {
    const rows = CRITERIA(kind).filter(([key]) => criteria?.[key]);
    if (rows.length === 0) return null;

    return (
        <div className="mt-2 flex flex-wrap gap-1.5">
            {rows.map(([key, label]) => (
                <span
                    key={key}
                    className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/70"
                >
                    {label}{' '}
                    <b className="text-white tabular-nums">{criteria?.[key]}</b>
                </span>
            ))}
        </div>
    );
}
