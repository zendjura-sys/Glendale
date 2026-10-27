import { router } from '@inertiajs/react';
import { CalendarClock, Pencil, Plus, Radio, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Widget } from '@/components/gc/widget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { LOCALE, tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type StreamSlot = {
    day: number;
    time: string;
    title: string | null;
    next_at: string;
};

const DAYS = [
    () => tr('Понеділок'),
    () => tr('Вівторок'),
    () => tr('Середа'),
    () => tr('Четвер'),
    () => tr('Пʼятниця'),
    () => tr('Субота'),
    () => tr('Неділя'),
];

const field =
    'input-glass h-10 rounded-xl px-3 text-sm text-white placeholder:text-white/30';

function when(iso: string): string {
    return new Date(iso).toLocaleString(LOCALE, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Розклад стрімів: «Наступний стрім» і тиждень; власник редагує слоти в діалозі. */
export function StreamSchedule({
    slots,
    isSelf,
}: {
    slots: StreamSlot[];
    isSelf: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(
        slots.map(({ day, time, title }) => ({
            day,
            time,
            title: title ?? '',
        })),
    );
    if (slots.length === 0 && !isSelf) return null;
    const [next, ...rest] = slots;

    const save = () =>
        router.put(
            '/settings/stream-schedule',
            { slots: form },
            { preserveScroll: true, onSuccess: () => setOpen(false) },
        );

    return (
        <Widget title={tr('Розклад стрімів')}>
            <div className="space-y-2 px-1">
                {next && (
                    <div className="flex items-center gap-3 rounded-xl bg-gc-indigo/10 p-3">
                        <Radio className="size-5 shrink-0 text-gc-lilac-300" />
                        <div className="min-w-0">
                            <p className="text-xs text-white/50">
                                {tr('Наступний стрім')}
                            </p>
                            <p className="truncate text-sm font-semibold text-white">
                                {when(next.next_at)}
                                {next.title && ` · ${next.title}`}
                            </p>
                        </div>
                    </div>
                )}
                {rest.map((slot) => (
                    <div
                        key={`${slot.day}-${slot.time}`}
                        className="flex items-center gap-2.5 text-sm text-white/75"
                    >
                        <CalendarClock className="size-4 shrink-0 text-white/40" />
                        <span className="truncate">
                            {when(slot.next_at)}
                            {slot.title && ` · ${slot.title}`}
                        </span>
                    </div>
                ))}
                {slots.length === 0 && (
                    <p className="text-sm text-white/45">
                        {tr(
                            'Коли ви стрімите? Глядачі побачать найближчий стрім.',
                        )}
                    </p>
                )}
                {isSelf && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-gc-lilac-300 hover:text-white"
                    >
                        <Pencil className="size-3.5" />
                        {slots.length === 0
                            ? tr('Додати розклад')
                            : tr('Змінити')}
                    </button>
                )}
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Розклад стрімів')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Час — за Києвом; глядачі бачать його у своєму часовому поясі.',
                            )}
                        </DialogDescription>
                    </div>
                    <div className="space-y-2">
                        {form.map((slot, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-[1fr_6.5rem_auto] gap-2 sm:grid-cols-[9rem_6.5rem_1fr_auto]"
                            >
                                <select
                                    value={slot.day}
                                    onChange={(e) =>
                                        setForm(
                                            form.map((s, j) =>
                                                j === i
                                                    ? {
                                                          ...s,
                                                          day: Number(
                                                              e.target.value,
                                                          ),
                                                      }
                                                    : s,
                                            ),
                                        )
                                    }
                                    className={field}
                                >
                                    {DAYS.map((label, d) => (
                                        <option key={d} value={d + 1}>
                                            {label()}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="time"
                                    value={slot.time}
                                    onChange={(e) =>
                                        setForm(
                                            form.map((s, j) =>
                                                j === i
                                                    ? {
                                                          ...s,
                                                          time: e.target.value,
                                                      }
                                                    : s,
                                            ),
                                        )
                                    }
                                    className={field}
                                />
                                <input
                                    value={slot.title}
                                    onChange={(e) =>
                                        setForm(
                                            form.map((s, j) =>
                                                j === i
                                                    ? {
                                                          ...s,
                                                          title: e.target.value,
                                                      }
                                                    : s,
                                            ),
                                        )
                                    }
                                    placeholder={tr('Що стрімите')}
                                    maxLength={60}
                                    className={cn(
                                        field,
                                        'order-last col-span-2 sm:order-none sm:col-span-1',
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setForm(form.filter((_, j) => j !== i))
                                    }
                                    aria-label={tr('Видалити')}
                                    className="flex size-10 items-center justify-center rounded-xl text-white/45 transition hover:bg-rose-500/10 hover:text-rose-300"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        ))}
                        {form.length < 7 && (
                            <button
                                type="button"
                                onClick={() =>
                                    setForm([
                                        ...form,
                                        { day: 5, time: '20:00', title: '' },
                                    ])
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.1]"
                            >
                                <Plus className="size-4" />
                                {tr('Додати слот')}
                            </button>
                        )}
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
