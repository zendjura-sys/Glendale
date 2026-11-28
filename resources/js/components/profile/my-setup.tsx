import { router } from '@inertiajs/react';
import {
    Armchair,
    Cpu,
    Gamepad2,
    Headphones,
    Keyboard,
    Mic,
    Monitor,
    Mouse,
    Package,
    Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Toggle } from '@/components/gc/admin';
import { Widget } from '@/components/gc/widget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';

export type SetupData = {
    public: boolean;
    pc: { cpu: string | null; gpu: string | null; ram: number | null };
    gear: Record<string, string | null>;
    /** Оцінка збірки (№224): бал, клас, частини у %, слабке місце й поради. */
    rating?: {
        score: number | null;
        tier: string | null;
        parts: { cpu: number | null; gpu: number | null; ram: number | null };
        weak: 'cpu' | 'gpu' | null;
        advice: string[];
    } | null;
};

const GEAR: [string, LucideIcon, () => string][] = [
    ['monitor', Monitor, () => tr('Монітор')],
    ['mouse', Mouse, () => tr('Мишка')],
    ['keyboard', Keyboard, () => tr('Клавіатура')],
    ['headset', Headphones, () => tr('Навушники')],
    ['mic', Mic, () => tr('Мікрофон')],
    ['controller', Gamepad2, () => tr('Геймпад')],
    ['chair', Armchair, () => tr('Крісло')],
    ['other', Package, () => tr('Ще')],
];

const field =
    'input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30';

/** «Мій сетап»: ПК і периферія; власник редагує в діалозі. */
export function MySetup({
    data,
    isSelf,
}: {
    data: SetupData | null | undefined;
    isSelf: boolean;
}) {
    const pcData: Partial<SetupData['pc']> = data?.pc ?? {};
    const gearData: Record<string, string | null | undefined> =
        data?.gear ?? {};
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        public: data?.public ?? false,
        cpu: pcData.cpu ?? '',
        gpu: pcData.gpu ?? '',
        ram: pcData.ram ? String(pcData.ram) : '',
        ...Object.fromEntries(GEAR.map(([key]) => [key, gearData[key] ?? ''])),
    } as Record<string, string | boolean>);
    if (!data) return null;
    const pc = [
        pcData.cpu,
        pcData.gpu,
        pcData.ram ? tr('{ram} ГБ ОЗП', { ram: pcData.ram }) : null,
    ].filter(Boolean);
    const gear = GEAR.filter(([key]) => gearData[key]);
    const empty = pc.length === 0 && gear.length === 0;
    if (empty && !isSelf) return null;

    const save = () =>
        router.put(
            '/settings/setup',
            { ...form, ram: form.ram === '' ? null : Number(form.ram) },
            { preserveScroll: true, onSuccess: () => setOpen(false) },
        );

    return (
        <Widget title={tr('Мій сетап')}>
            <div className="space-y-2 px-1">
                {pc.length > 0 && (
                    <div className="flex items-start gap-2.5 text-sm text-white/85">
                        <Cpu className="mt-0.5 size-4 shrink-0 text-white/40" />
                        <span>{pc.join(' · ')}</span>
                    </div>
                )}
                {data.rating && (
                    <PcScore rating={data.rating} isSelf={isSelf} />
                )}
                {gear.map(([key, Icon, label]) => (
                    <div
                        key={key}
                        className="flex items-start gap-2.5 text-sm text-white/85"
                        title={label()}
                    >
                        <Icon className="mt-0.5 size-4 shrink-0 text-white/40" />
                        <span className="min-w-0 break-words">
                            {gearData[key]}
                        </span>
                    </div>
                ))}
                {empty && (
                    <p className="text-sm text-white/45">
                        {tr('Розкажіть, на чому граєте: ПК, мишка, навушники…')}
                    </p>
                )}
                {isSelf && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-white"
                    >
                        <Pencil className="size-3.5" />
                        {empty ? tr('Заповнити') : tr('Змінити')}
                    </button>
                )}
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Мій сетап')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'ПК також враховується в «Чи потягне мій ПК» на сторінках ігор.',
                            )}
                        </DialogDescription>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem]">
                        <input
                            value={String(form.cpu)}
                            onChange={(e) =>
                                setForm({ ...form, cpu: e.target.value })
                            }
                            placeholder={tr('Процесор')}
                            maxLength={80}
                            className={field}
                        />
                        <input
                            value={String(form.gpu)}
                            onChange={(e) =>
                                setForm({ ...form, gpu: e.target.value })
                            }
                            placeholder={tr('Відеокарта')}
                            maxLength={80}
                            className={field}
                        />
                        <input
                            value={String(form.ram)}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    ram: e.target.value.replace(/\D/g, ''),
                                })
                            }
                            placeholder={tr('ОЗП, ГБ')}
                            inputMode="numeric"
                            className={field}
                        />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {GEAR.map(([key, Icon, label]) => (
                            <label key={key} className="relative block">
                                <Icon className="pointer-events-none absolute top-3 left-3 size-4 text-white/35" />
                                <input
                                    value={String(form[key] ?? '')}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            [key]: e.target.value,
                                        })
                                    }
                                    placeholder={label()}
                                    maxLength={80}
                                    className={`${field} pl-9`}
                                />
                            </label>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/70">
                            {tr('Показувати всім')}
                        </span>
                        <Toggle
                            checked={Boolean(form.public)}
                            onChange={(value) =>
                                setForm({ ...form, public: value })
                            }
                            label={tr('Показувати всім')}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={save}
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold"
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </Widget>
    );
}

/** Оцінка збірки: бал і клас, смужки частин; власнику — поради, що міняти першим. */
function PcScore({
    rating,
    isSelf,
}: {
    rating: NonNullable<SetupData['rating']>;
    isSelf: boolean;
}) {
    const parts: [keyof typeof rating.parts, string][] = [
        ['gpu', tr('Відео')],
        ['cpu', tr('Процесор')],
        ['ram', tr('Пам’ять')],
    ];
    const shown = parts.filter(([key]) => rating.parts[key] !== null);
    if (rating.score === null && shown.length === 0 && !isSelf) return null;

    return (
        <div className="gc-pc-score">
            {rating.score !== null && (
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[var(--gc-text)] tabular-nums">
                        {rating.score}
                    </span>
                    <span className="text-sm text-[var(--gc-text-2)]">
                        {tr('{tier} збірка', { tier: rating.tier ?? '' })}
                    </span>
                </div>
            )}
            {shown.length > 0 && (
                <div className="mt-2 space-y-1.5">
                    {shown.map(([key, label]) => (
                        <div
                            key={key}
                            className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-xs"
                        >
                            <span
                                className={
                                    rating.weak === key
                                        ? 'font-semibold text-[var(--gc-alert)]'
                                        : 'text-[var(--gc-text-2)]'
                                }
                            >
                                {label}
                            </span>
                            <span className="gc-pc-score__bar" aria-hidden>
                                <span
                                    style={{ width: `${rating.parts[key]}%` }}
                                    className={
                                        rating.weak === key ? 'is-weak' : ''
                                    }
                                />
                            </span>
                            <span className="text-right text-[var(--gc-text-2)] tabular-nums">
                                {rating.parts[key]}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {isSelf && rating.advice.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--gc-text-2)]">
                    {rating.advice.map((line) => (
                        <li key={line} className="flex gap-2">
                            <span
                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--gc-accent)]"
                                aria-hidden
                            />
                            <span>{line}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
