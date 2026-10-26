import {
    Check,
    CircleHelp,
    Cpu,
    Loader2,
    MemoryStick,
    MonitorCog,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Level = Record<string, string>;
type State = 'ok' | 'fail' | 'unknown' | 'none';
type Compare = { cpu: State; gpu: State; ram: State; verdict: State } | null;
type Pc = { cpu: string | null; gpu: string | null; ram: number | null };

type Check = {
    requirements: { minimum: Level; recommended: Level };
    pc: Pc;
    configured: boolean;
    minimum: Compare;
    recommended: Compare;
    summary: 'recommended' | 'minimum' | 'below' | 'unknown' | null;
};

const ROWS: { key: string; label: string; compare?: 'cpu' | 'gpu' | 'ram' }[] =
    [
        { key: 'os', label: tr('Система') },
        { key: 'cpu', label: tr('Процесор'), compare: 'cpu' },
        { key: 'gpu', label: tr('Відеокарта'), compare: 'gpu' },
        { key: 'ram', label: tr('Пам’ять'), compare: 'ram' },
        { key: 'storage', label: tr('Місце на диску') },
        { key: 'directx', label: 'DirectX' },
    ];

const SUMMARY: Record<
    NonNullable<Check['summary']>,
    { text: string; className: string }
> = {
    recommended: {
        text: tr('Потягне на рекомендованих налаштуваннях'),
        className: 'bg-emerald-500/12 text-emerald-100',
    },
    minimum: {
        text: tr('Потягне на мінімальних налаштуваннях'),
        className: 'bg-primary/12 text-white',
    },
    below: {
        text: tr('Не дотягує до мінімальних вимог'),
        className: 'bg-rose-500/12 text-rose-100',
    },
    unknown: {
        text: tr('Не все вдалося порівняти — дивіться вимоги нижче'),
        className: 'bg-white/[0.05] text-white/75',
    },
};

/** «Чи потягне мій ПК»: системні вимоги Steam і порівняння зі збіркою (орієнтовно). */
export function PcCheck({
    slug,
    onFail,
}: {
    slug: string;
    onFail?: () => void;
}) {
    const [data, setData] = useState<Check | null>(null);
    const [failed, setFailed] = useState(false);
    const [editing, setEditing] = useState(false);

    const load = useCallback(() => {
        api<Check>('GET', `/games/${slug}/pc-check`)
            .then(setData)
            .catch(() => {
                setFailed(true);
                onFail?.();
            });
    }, [slug, onFail]);

    useEffect(load, [load]);

    if (failed) return null;
    if (data === null) {
        return (
            <div className="flex items-center gap-2 text-sm text-white/45">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                {tr('Завантажуємо вимоги…')}
            </div>
        );
    }
    const { minimum, recommended } = data.requirements;
    const empty =
        Object.keys(minimum).length === 0 &&
        Object.keys(recommended).length === 0;

    return (
        <div className="space-y-3">
            {data.summary && (
                <p
                    className={cn(
                        'rounded-2xl px-3 py-2.5 text-sm font-medium',
                        SUMMARY[data.summary].className,
                    )}
                >
                    {SUMMARY[data.summary].text}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-sm break-words text-white/60">
                    {data.configured
                        ? [
                              data.pc.cpu,
                              data.pc.gpu,
                              data.pc.ram
                                  ? tr('{n} ГБ', { n: data.pc.ram })
                                  : null,
                          ]
                              .filter(Boolean)
                              .join(' · ')
                        : tr(
                              'Вкажіть свою збірку — порівняємо з вимогами гри.',
                          )}
                </p>
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 transition hover:bg-white/10"
                >
                    <MonitorCog className="size-4" />
                    {data.configured ? tr('Змінити збірку') : tr('Моя збірка')}
                </button>
            </div>
            {empty ? (
                <p className="text-sm text-white/45">
                    {tr('Системних вимог для ПК не знайшли.')}
                </p>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {(
                        [
                            [
                                'minimum',
                                tr('Мінімальні'),
                                minimum,
                                data.minimum,
                            ],
                            [
                                'recommended',
                                tr('Рекомендовані'),
                                recommended,
                                data.recommended,
                            ],
                        ] as const
                    ).map(([key, title, level, compare]) =>
                        Object.keys(level).length === 0 ? null : (
                            <div
                                key={key}
                                className="rounded-2xl bg-white/[0.03] p-3"
                            >
                                <p className="mb-2 text-xs font-semibold text-white/50">
                                    {title}
                                </p>
                                <dl className="space-y-2">
                                    {ROWS.filter((row) => level[row.key]).map(
                                        (row) => (
                                            <div
                                                key={row.key}
                                                className="flex gap-2"
                                            >
                                                {row.compare && compare ? (
                                                    <Mark
                                                        state={
                                                            compare[row.compare]
                                                        }
                                                    />
                                                ) : (
                                                    <span className="size-4 shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <dt className="text-[11px] text-white/40">
                                                        {row.label}
                                                    </dt>
                                                    <dd className="text-sm break-words text-white/80">
                                                        {level[row.key]}
                                                    </dd>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </dl>
                            </div>
                        ),
                    )}
                </div>
            )}
            <p className="text-[11px] text-white/35">
                {tr(
                    'Вимоги — зі Steam. Порівняння орієнтовне: моделі оцінюємо за загальнодоступними тестами.',
                )}
            </p>
            <PcDialog
                open={editing}
                onOpenChange={setEditing}
                onSaved={() => {
                    setEditing(false);
                    load();
                }}
            />
        </div>
    );
}

function Mark({ state }: { state: State }) {
    if (state === 'ok')
        return (
            <Check
                className="mt-3 size-4 shrink-0 text-emerald-400"
                aria-label={tr('Підходить')}
            />
        );
    if (state === 'fail')
        return (
            <X
                className="mt-3 size-4 shrink-0 text-rose-400"
                aria-label={tr('Не дотягує')}
            />
        );
    if (state === 'unknown')
        return (
            <CircleHelp
                className="mt-3 size-4 shrink-0 text-white/35"
                aria-label={tr('Не вдалося порівняти')}
            />
        );

    return <span className="size-4 shrink-0" />;
}

/** Збірка ПК: одна на акаунт, використовується на сторінках усіх ігор. */
export function PcDialog({
    open,
    onOpenChange,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const [pc, setPc] = useState<Pc>({ cpu: null, gpu: null, ram: null });
    const [gpus, setGpus] = useState<string[]>([]);
    const [known, setKnown] = useState<{ cpu: boolean; gpu: boolean } | null>(
        null,
    );
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        api<{ pc: Pc; gpus: string[]; cpu_known: boolean; gpu_known: boolean }>(
            'GET',
            '/games/pc',
        )
            .then((d) => {
                setPc(d.pc);
                setGpus(d.gpus);
                setKnown(
                    d.pc.cpu || d.pc.gpu
                        ? { cpu: d.cpu_known, gpu: d.gpu_known }
                        : null,
                );
            })
            .catch(() => undefined);
    }, [open]);

    const save = async () => {
        setBusy(true);
        try {
            const res = await api<{ cpu_known: boolean; gpu_known: boolean }>(
                'PUT',
                '/games/pc',
                pc,
            );
            setKnown({ cpu: res.cpu_known, gpu: res.gpu_known });
            if ((pc.cpu && !res.cpu_known) || (pc.gpu && !res.gpu_known)) {
                toast.warning(
                    tr('Збережено, але модель не впізнали — уточніть назву.'),
                );
            } else {
                toast.success(tr('Збірку збережено.'));
                onSaved();
            }
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : tr('Не вдалося зберегти.'),
            );
        } finally {
            setBusy(false);
        }
    };

    const input =
        'input-glass h-10 w-full min-w-0 rounded-control px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-dialog border-white/10 text-white sm:max-w-md">
                <DialogTitle className="font-display text-xl">
                    {tr('Моя збірка')}
                </DialogTitle>
                <p className="text-sm text-white/55">
                    {tr(
                        'Одна на акаунт — порівнюємо з вимогами кожної гри. Бачите її лише ви.',
                    )}
                </p>
                <div className="grid gap-3">
                    <label className="text-xs text-white/55">
                        <span className="mb-1 flex items-center gap-1.5">
                            <Cpu className="size-3.5" /> {tr('Процесор')}
                        </span>
                        <input
                            value={pc.cpu ?? ''}
                            maxLength={80}
                            onChange={(e) =>
                                setPc({ ...pc, cpu: e.target.value })
                            }
                            placeholder="Intel Core i5-12400F / AMD Ryzen 5 5600"
                            className={input}
                        />
                        {known && pc.cpu && <Hint ok={known.cpu} />}
                    </label>
                    <label className="text-xs text-white/55">
                        <span className="mb-1 flex items-center gap-1.5">
                            <MonitorCog className="size-3.5" />{' '}
                            {tr('Відеокарта')}
                        </span>
                        <input
                            value={pc.gpu ?? ''}
                            maxLength={80}
                            list="gc-gpus"
                            onChange={(e) =>
                                setPc({ ...pc, gpu: e.target.value })
                            }
                            placeholder="RTX 3060 / RX 6600"
                            className={input}
                        />
                        <datalist id="gc-gpus">
                            {gpus.map((g) => (
                                <option key={g} value={g} />
                            ))}
                        </datalist>
                        {known && pc.gpu && <Hint ok={known.gpu} />}
                    </label>
                    <label className="text-xs text-white/55">
                        <span className="mb-1 flex items-center gap-1.5">
                            <MemoryStick className="size-3.5" />{' '}
                            {tr('Оперативна пам’ять')}
                        </span>
                        <select
                            value={pc.ram ?? ''}
                            onChange={(e) =>
                                setPc({
                                    ...pc,
                                    ram: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                })
                            }
                            className={input}
                        >
                            <option value="">{tr('Не вказано')}</option>
                            {[4, 6, 8, 12, 16, 24, 32, 48, 64, 128].map((n) => (
                                <option key={n} value={n}>
                                    {tr('{n} ГБ', { n })}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-control px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={save}
                        className="btn-glow rounded-control px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Hint({ ok }: { ok: boolean }) {
    return (
        <span
            className={cn(
                'mt-1 block text-[11px]',
                ok ? 'text-emerald-300' : 'text-amber-300',
            )}
        >
            {ok
                ? tr('Модель упізнано')
                : tr(
                      'Модель не впізнали — напишіть повну назву, напр. «GeForce GTX 1660 Super».',
                  )}
        </span>
    );
}
