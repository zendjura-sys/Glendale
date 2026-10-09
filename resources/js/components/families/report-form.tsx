import { useForm } from '@inertiajs/react';
import {
    Briefcase,
    Coins,
    ImagePlus,
    Sparkles,
    Swords,
    User,
    UserPlus,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldError, inputClass } from '@/components/servers/server-form';
import { toMinor, uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ReportConfig, ReportType, RosterEntry } from '@/types';
import { btnPrimary, kyivDate, textareaClass } from './ui';
import { tr } from '@/lib/i18n';

type Tier = 'light' | 'medium' | 'heavy';

type Form = {
    type: ReportType;
    for: 'self' | 'friend';
    beneficiary_id: number | '';
    event_date: string;
    wins: number;
    losses: number;
    hours: number[];
    tier: Tier;
    count: number;
    amount: string;
    description: string;
    proofs: File[];
};

const typeIcons: Record<ReportType, LucideIcon> = {
    bizwar: Swords,
    contract: Briefcase,
    investment: Coins,
    other: Sparkles,
};

const dayOptions = (min: string, today: string) => {
    const days: string[] = [];
    const cursor = new Date(`${today}T12:00:00Z`);
    const floor = new Date(`${min}T12:00:00Z`);
    while (cursor >= floor && days.length < 7) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return days;
};

export function ReportForm({
    action,
    config,
    usage,
    roster,
    meId,
    allowed,
    onDone,
}: {
    action: string;
    config: ReportConfig;
    usage: Record<string, Record<Tier, number>>;
    roster: RosterEntry[];
    meId: number;
    allowed: ReportType[];
    onDone?: () => void;
}) {
    const form = useForm<Form>({
        type: allowed[0] ?? 'other',
        for: 'self',
        beneficiary_id: '',
        event_date: config.today,
        wins: 0,
        losses: 0,
        hours: [],
        tier: 'light',
        count: 1,
        amount: '',
        description: '',
        proofs: [],
    });
    const { data, setData, errors } = form;
    const fileRef = useRef<HTMLInputElement>(null);
    const [previews, setPreviews] = useState<string[]>([]);

    useEffect(() => {
        const urls = data.proofs.map((f) => URL.createObjectURL(f));
        setPreviews(urls);

        return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }, [data.proofs]);

    const days = dayOptions(config.min_date, config.today);
    const used =
        data.for === 'self' ? (usage[data.event_date]?.[data.tier] ?? 0) : null;
    const left =
        used === null ? null : Math.max(0, config.contract_limit - used);

    const reward = useMemo(() => {
        const r = config.rates;
        switch (data.type) {
            case 'bizwar':
                return toMinor(
                    data.wins * (r.bizwar_win ?? 0) +
                        data.losses * (r.bizwar_loss ?? 0),
                );
            case 'contract':
                return toMinor(data.count * (r[`contract_${data.tier}`] ?? 0));
            case 'investment':
                return Math.floor(
                    (toMinor(data.amount || 0) *
                        Math.round((r.investment_cashback ?? 0) * 100)) /
                        10000,
                );
            default:
                return null;
        }
    }, [data, config.rates]);

    const toggleHour = (h: number) =>
        setData(
            'hours',
            data.hours.includes(h)
                ? data.hours.filter((x) => x !== h)
                : [...data.hours, h].sort((a, b) => a - b),
        );

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        setData(
            'proofs',
            [...data.proofs, ...Array.from(files)].slice(0, config.max_proofs),
        );
    };

    const submit = () =>
        form.post(action, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset(
                    'wins',
                    'losses',
                    'hours',
                    'count',
                    'amount',
                    'description',
                    'proofs',
                );
                onDone?.();
            },
        });

    const friends = roster.filter((m) => m.id !== meId);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(config.types) as ReportType[]).map((type) => {
                    const Icon = typeIcons[type];
                    const enabled = allowed.includes(type);

                    return (
                        <button
                            key={type}
                            type="button"
                            disabled={!enabled}
                            title={
                                enabled
                                    ? undefined
                                    : tr(
                                          'Ваш ранг не може подавати цей тип звіту',
                                      )
                            }
                            onClick={() => setData('type', type)}
                            className={cn(
                                'flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-30',
                                data.type === type
                                    ? 'border-amber-300/50 bg-amber-300/10 text-amber-100 shadow-[0_0_24px_-8px_rgb(250_204_21/0.7)]'
                                    : 'border-white/[0.07] bg-white/[0.03] text-white/60 hover:text-white',
                            )}
                        >
                            <Icon className="size-4" />
                            {config.types[type]}
                        </button>
                    );
                })}
            </div>
            <FieldError message={errors.type} />

            <div>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1">
                    {(
                        [
                            ['self', tr('За себе'), User],
                            ['friend', tr('За друга'), UserPlus],
                        ] as const
                    ).map(([value, label, Icon]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setData('for', value)}
                            className={cn(
                                'flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium transition',
                                data.for === value
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            <Icon className="size-4" /> {label}
                        </button>
                    ))}
                </div>
                {data.for === 'friend' && (
                    <div className="mt-2">
                        <select
                            value={data.beneficiary_id}
                            onChange={(e) =>
                                setData(
                                    'beneficiary_id',
                                    e.target.value
                                        ? Number(e.target.value)
                                        : '',
                                )
                            }
                            className={cn(inputClass, '[color-scheme:dark]')}
                        >
                            <option value="">{tr('Оберіть учасника…')}</option>
                            {friends.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.display} {tr('· ранг')} {m.rank}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-white/40">
                            {tr(
                                'Винагорода піде на рахунок друга, а ви будете вказані як автор звіту.',
                            )}
                        </p>
                        <FieldError message={errors.beneficiary_id} />
                    </div>
                )}
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-white/60">
                        {tr('Дата події')}
                    </span>
                    <span className="text-white/35">
                        {tr('Звіт приймається')} {config.deadline_hours}{' '}
                        {tr('год')}
                    </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {days.map((d, i) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setData('event_date', d)}
                            className={cn(
                                'h-10 shrink-0 rounded-xl px-3.5 text-sm font-medium transition',
                                data.event_date === d
                                    ? 'bg-gradient-brand text-white'
                                    : 'bg-white/[0.04] text-white/60 hover:text-white',
                            )}
                        >
                            {i === 0
                                ? tr('Сьогодні')
                                : i === 1
                                  ? tr('Вчора')
                                  : kyivDate(d)}
                        </button>
                    ))}
                </div>
                <FieldError message={errors.event_date} />
            </div>

            {data.type === 'bizwar' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Stepper
                            label={tr('Перемоги')}
                            value={data.wins}
                            onChange={(v) => setData('wins', v)}
                            tone="text-emerald-300"
                            hint={uah(toMinor(config.rates.bizwar_win ?? 0))}
                        />
                        <Stepper
                            label={tr('Поразки')}
                            value={data.losses}
                            onChange={(v) => setData('losses', v)}
                            tone="text-rose-300"
                            hint={uah(toMinor(config.rates.bizwar_loss ?? 0))}
                        />
                    </div>
                    <FieldError message={errors.wins} />
                    <div>
                        <div className="mb-1.5 text-xs font-medium text-white/60">
                            {tr('Години бізварів')}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {config.hours.map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => toggleHour(h)}
                                    className={cn(
                                        'h-9 w-12 rounded-lg font-mono text-sm transition',
                                        data.hours.includes(h)
                                            ? 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/40'
                                            : 'bg-white/[0.04] text-white/55 hover:text-white',
                                    )}
                                >
                                    {h}:00
                                </button>
                            ))}
                        </div>
                        <FieldError message={errors.hours} />
                    </div>
                </div>
            )}

            {data.type === 'contract' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(config.tiers) as Tier[]).map((tier) => (
                            <button
                                key={tier}
                                type="button"
                                onClick={() => setData('tier', tier)}
                                className={cn(
                                    'rounded-2xl border px-2 py-2.5 text-center transition',
                                    data.tier === tier
                                        ? 'border-gc-lilac-500/60 bg-gc-indigo/15 text-white'
                                        : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:text-white',
                                )}
                            >
                                <div className="text-sm font-semibold">
                                    {config.tiers[tier]}
                                </div>
                                <div className="text-xs text-white/45">
                                    {uah(
                                        toMinor(
                                            config.rates[`contract_${tier}`] ??
                                                0,
                                        ),
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    <Stepper
                        label={tr('Кількість')}
                        value={data.count}
                        min={1}
                        max={left ?? config.contract_limit}
                        onChange={(v) => setData('count', v)}
                        hint={
                            left === null
                                ? tr('Ліміт {contract_limit} на день', {
                                      contract_limit: config.contract_limit,
                                  })
                                : tr(
                                      'Сьогодні використано {used}/{contract_limit}',
                                      {
                                          used,
                                          contract_limit: config.contract_limit,
                                      },
                                  )
                        }
                    />
                    {left === 0 && (
                        <p className="text-xs text-rose-300">
                            {tr(
                                'Ліміт контрактів цього рівня на обрану дату вичерпано.',
                            )}
                        </p>
                    )}
                    <FieldError message={errors.count ?? errors.tier} />
                </div>
            )}

            {data.type === 'investment' && (
                <div>
                    <div className="mb-1.5 text-xs font-medium text-white/60">
                        {tr('Сума інвестиції в скарбницю, ₴')}
                    </div>
                    <input
                        inputMode="decimal"
                        value={data.amount}
                        onChange={(e) => setData('amount', e.target.value)}
                        placeholder="50 000"
                        className={cn(inputClass, 'text-lg font-semibold')}
                    />
                    <FieldError message={errors.amount} />
                </div>
            )}

            <div>
                <textarea
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    rows={data.type === 'other' ? 3 : 2}
                    placeholder={
                        data.type === 'other'
                            ? tr(
                                  'Що саме зроблено? Офіцер визначить винагороду.',
                              )
                            : tr('Коментар (необов’язково)')
                    }
                    className={textareaClass}
                />
                <FieldError message={errors.description} />
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-white/60">
                        {tr('Скріншоти-докази')}
                        {config.require_proof && (
                            <span className="text-rose-300"> *</span>
                        )}
                    </span>
                    <span className="text-white/35">
                        {data.proofs.length}/{config.max_proofs}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {previews.map((src, i) => (
                        <div
                            key={src}
                            className="relative size-20 overflow-hidden rounded-xl ring-1 ring-white/10"
                        >
                            <img
                                src={src}
                                alt=""
                                className="size-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setData(
                                        'proofs',
                                        data.proofs.filter((_, j) => j !== i),
                                    )
                                }
                                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
                                aria-label={tr('Прибрати')}
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                    {data.proofs.length < config.max_proofs && (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-xs text-white/45 transition hover:border-white/30 hover:text-white"
                        >
                            <ImagePlus className="size-5" /> {tr('Додати')}
                        </button>
                    )}
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
                <FieldError
                    message={
                        errors.proofs ??
                        Object.entries(errors).find(([k]) =>
                            k.startsWith('proofs.'),
                        )?.[1]
                    }
                />
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                <div className="min-w-0 flex-1">
                    <div className="text-xs tracking-wide text-white/40 uppercase">
                        {tr('Очікувана винагорода')}
                    </div>
                    <div className="font-display text-xl font-bold text-emerald-300">
                        {reward === null ? tr('визначить офіцер') : uah(reward)}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={submit}
                    disabled={
                        form.processing ||
                        (data.type === 'contract' && left === 0) ||
                        (data.for === 'friend' && !data.beneficiary_id)
                    }
                    className={cn(btnPrimary, 'h-12 px-6')}
                >
                    {form.processing ? tr('Надсилаємо…') : tr('Надіслати звіт')}
                </button>
            </div>
        </div>
    );
}

function Stepper({
    label,
    value,
    onChange,
    min = 0,
    max = 40,
    hint,
    tone = 'text-white',
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    hint?: string;
    tone?: string;
}) {
    const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));

    return (
        <div className="rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06]">
            <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-medium text-white/60">{label}</span>
                {hint && <span className="text-white/35">{hint}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => set(value - 1)}
                    className="size-10 rounded-xl bg-white/[0.06] text-lg text-white/70 hover:bg-white/10"
                >
                    −
                </button>
                <div
                    className={cn(
                        'flex-1 text-center font-display text-2xl font-bold tabular-nums',
                        tone,
                    )}
                >
                    {value}
                </div>
                <button
                    type="button"
                    onClick={() => set(value + 1)}
                    className="size-10 rounded-xl bg-white/[0.06] text-lg text-white/70 hover:bg-white/10"
                >
                    +
                </button>
            </div>
        </div>
    );
}
