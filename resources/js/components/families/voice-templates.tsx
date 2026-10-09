import { router } from '@inertiajs/react';
import { Check, Lock, Mic, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export type VoiceTemplate = {
    id: number;
    name: string;
    ranks: number[] | null;
    families: number;
};

const RANKS = Array.from({ length: 9 }, (_, i) => i + 1);

/** Ранги 1–9: усі ввімкнені — кімната відкрита для всієї сім’ї (null). */
function RankPicker({
    value,
    onChange,
}: {
    value: number[] | null;
    onChange: (ranks: number[] | null) => void;
}) {
    const on = value ?? RANKS;
    const toggle = (rank: number) => {
        const next = on.includes(rank)
            ? on.filter((r) => r !== rank)
            : [...on, rank].sort((a, b) => a - b);
        onChange(next.length === RANKS.length ? null : next);
    };

    return (
        <div className="flex flex-wrap items-center gap-1">
            {RANKS.map((r) => (
                <button
                    key={r}
                    type="button"
                    onClick={() => toggle(r)}
                    aria-label={tr('Ранг {r}', { r })}
                    className={cn(
                        'size-7 rounded-lg text-xs font-semibold transition',
                        on.includes(r)
                            ? 'bg-gradient-brand text-white'
                            : 'bg-white/[0.05] text-white/40 hover:bg-white/10',
                    )}
                >
                    {r}
                </button>
            ))}
            <span className="ml-1 inline-flex h-7 items-center gap-1 rounded-lg bg-amber-400/10 px-2 text-xs text-amber-200">
                <Check className="size-3" /> 10
            </span>
        </div>
    );
}

function TemplateRow({ template }: { template: VoiceTemplate }) {
    const [name, setName] = useState(template.name);
    const [ranks, setRanks] = useState(template.ranks);
    const [apply, setApply] = useState(false);
    const dirty =
        name.trim() !== template.name ||
        JSON.stringify(ranks) !== JSON.stringify(template.ranks);

    const save = () =>
        router.patch(
            `/admin/families/voice-rooms/${template.id}`,
            { name, ranks, apply_ranks: apply },
            { preserveScroll: true, onSuccess: () => setApply(false) },
        );
    const remove = () => {
        if (
            !confirm(
                tr(
                    'Прибрати «{name}» з усіх сімей? Розмови в цій кімнаті завершаться.',
                    { name: template.name },
                ),
            )
        )
            return;
        router.delete(`/admin/families/voice-rooms/${template.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
            <Mic className="size-4 shrink-0 text-white/40" />
            <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className="input-glass h-9 min-w-[140px] flex-1 rounded-xl px-3 text-sm text-white focus:outline-none"
            />
            <RankPicker value={ranks} onChange={setRanks} />
            <span className="text-xs text-white/40">
                {tr('у')} {template.families} {tr('сім’ях')}
            </span>
            {dirty && (
                <>
                    <label className="inline-flex items-center gap-1.5 text-xs text-white/55">
                        <input
                            type="checkbox"
                            checked={apply}
                            onChange={(e) => setApply(e.target.checked)}
                        />
                        {tr('Застосувати доступ до всіх сімей')}
                    </label>
                    <button
                        type="button"
                        onClick={save}
                        className="inline-flex h-9 items-center rounded-xl bg-gradient-brand px-3 text-sm font-medium text-white"
                    >
                        {tr('Зберегти')}
                    </button>
                </>
            )}
            <button
                type="button"
                onClick={remove}
                aria-label={tr('Прибрати кімнату')}
                className="inline-flex size-9 items-center justify-center rounded-xl text-rose-300 hover:bg-rose-500/10"
            >
                <Trash2 className="size-4" />
            </button>
        </div>
    );
}

/**
 * Адмінка: кімнати, які з’являються в кожній сім’ї. Ранги — стартовий доступ,
 * далі лідер змінює його в «Рангах і правах» своєї сім’ї.
 */
export function VoiceTemplates({ templates }: { templates: VoiceTemplate[] }) {
    const [name, setName] = useState('');
    const [ranks, setRanks] = useState<number[] | null>(null);

    const add = () => {
        if (!name.trim()) return;
        router.post(
            '/admin/families/voice-rooms',
            { name, ranks },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setName('');
                    setRanks(null);
                },
            },
        );
    };

    return (
        <section className="glass mb-5 rounded-2xl p-4">
            <div className="mb-3 flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Lock className="size-4 text-white/60" />
                </div>
                <div>
                    <h2 className="font-semibold text-white">
                        {tr('Голосові кімнати для всіх сімей')}
                    </h2>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Кімнати з’являються в кожній сім’ї автоматично. Нові учасники бачать ті, що відкриті їхньому рангу; лідер заходить завжди. Сім’я може змінити доступ у «Рангах і правах», але не видалити кімнату.',
                        )}
                    </p>
                </div>
            </div>

            <div className="grid gap-2">
                {templates.map((t) => (
                    <TemplateRow key={`${t.id}-${t.name}`} template={t} />
                ))}
                {templates.length === 0 && (
                    <p className="rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white/40">
                        {tr(
                            'Поки що кожна сім’я отримує лише кімнату «Загальна».',
                        )}
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-white/10 p-3">
                    <Plus className="size-4 shrink-0 text-white/40" />
                    <input
                        value={name}
                        maxLength={60}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && add()}
                        placeholder={tr('Назва, наприклад «Бізвар»')}
                        className="input-glass h-9 min-w-[140px] flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <RankPicker value={ranks} onChange={setRanks} />
                    <button
                        type="button"
                        onClick={add}
                        disabled={!name.trim()}
                        className="inline-flex h-9 items-center rounded-xl bg-gradient-brand px-3 text-sm font-medium text-white disabled:opacity-40"
                    >
                        {tr('Додати')}
                    </button>
                </div>
            </div>
        </section>
    );
}
