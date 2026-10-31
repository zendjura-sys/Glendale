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
    data: SetupData;
    isSelf: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        public: data.public,
        cpu: data.pc.cpu ?? '',
        gpu: data.pc.gpu ?? '',
        ram: data.pc.ram ? String(data.pc.ram) : '',
        ...Object.fromEntries(GEAR.map(([key]) => [key, data.gear[key] ?? ''])),
    } as Record<string, string | boolean>);
    const pc = [
        data.pc.cpu,
        data.pc.gpu,
        data.pc.ram ? tr('{ram} ГБ ОЗП', { ram: data.pc.ram }) : null,
    ].filter(Boolean);
    const gear = GEAR.filter(([key]) => data.gear[key]);
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
                {gear.map(([key, Icon, label]) => (
                    <div
                        key={key}
                        className="flex items-start gap-2.5 text-sm text-white/85"
                        title={label()}
                    >
                        <Icon className="mt-0.5 size-4 shrink-0 text-white/40" />
                        <span className="min-w-0 break-words">
                            {data.gear[key]}
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
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-gc-lilac-300 hover:text-white"
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
