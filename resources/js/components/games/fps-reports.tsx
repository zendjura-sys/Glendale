import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RowSkeleton } from '@/components/gc/skeletons';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type FpsData = {
    rows: { gpu: string; fps: number; reports: number }[];
    total: number;
    resolution: string;
    preset: string;
    resolutions: string[];
    presets: Record<string, string>;
    mine: {
        gpu: string;
        cpu: string | null;
        resolution: string;
        preset: string;
        fps: number;
    } | null;
    pc: { cpu: string | null; gpu: string | null } | null;
};

const select = 'input-glass h-9 rounded-xl px-2 text-sm text-white';

/** FPS від спільноти: медіана за відеокартами; свій результат — у два кліки (ПК підставляється з «Мого сетапу»). */
export function FpsReports({ slug }: { slug: string }) {
    const signedIn = Boolean(usePage().props.auth.user);
    const [data, setData] = useState<FpsData | null>(null);
    const [form, setForm] = useState({
        gpu: '',
        cpu: '',
        resolution: '1080p',
        preset: 'high',
        fps: '',
    });
    const [open, setOpen] = useState(false);

    const load = useCallback(
        (resolution?: string, preset?: string) =>
            void api<FpsData>(
                'GET',
                `/games/${slug}/fps?resolution=${resolution ?? ''}&preset=${preset ?? ''}`,
            ).then((d) => {
                setData(d);
                setForm((f) =>
                    f.gpu
                        ? f
                        : {
                              ...f,
                              gpu: d.mine?.gpu ?? d.pc?.gpu ?? '',
                              cpu: d.mine?.cpu ?? d.pc?.cpu ?? '',
                              fps: d.mine ? String(d.mine.fps) : '',
                          },
                );
            }),
        [slug],
    );

    useEffect(() => load(), [load]);

    if (data === null) return <RowSkeleton avatar="none" />;
    const best = Math.max(1, ...data.rows.map((r) => r.fps));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <select
                    value={data.resolution}
                    onChange={(e) => load(e.target.value, data.preset)}
                    aria-label={tr('Роздільність')}
                    className={select}
                >
                    {data.resolutions.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </select>
                <select
                    value={data.preset}
                    onChange={(e) => load(data.resolution, e.target.value)}
                    aria-label={tr('Налаштування графіки')}
                    className={select}
                >
                    {Object.entries(data.presets).map(([key, label]) => (
                        <option key={key} value={key}>
                            {tr(label)}
                        </option>
                    ))}
                </select>
                <span className="self-center text-xs text-white/45">
                    {tr('Звітів: {count}', { count: data.total })}
                </span>
            </div>
            {data.rows.length === 0 ? (
                <p className="text-sm text-white/50">
                    {tr('Для цих налаштувань звітів ще немає.')}
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {data.rows.map((r) => (
                        <li
                            key={r.gpu}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="w-40 shrink-0 truncate text-white/80 sm:w-56">
                                {r.gpu}
                            </span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                <span
                                    className={cn(
                                        'block h-full rounded-full',
                                        r.fps >= 60
                                            ? 'bg-emerald-400/80'
                                            : r.fps >= 30
                                              ? 'bg-amber-400/80'
                                              : 'bg-rose-400/80',
                                    )}
                                    style={{
                                        width: `${(r.fps / best) * 100}%`,
                                    }}
                                />
                            </span>
                            <span className="w-16 text-right font-semibold text-white tabular-nums">
                                {r.fps} FPS
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {signedIn &&
                (open ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void api<FpsData>('POST', `/games/${slug}/fps`, {
                                ...form,
                                fps: Number(form.fps),
                            })
                                .then((d) => {
                                    setData(d);
                                    setOpen(false);
                                    toast.success(
                                        tr('Дякуємо! Ваш FPS враховано.'),
                                    );
                                })
                                .catch((err: unknown) =>
                                    toast.error(
                                        err instanceof ApiError
                                            ? err.message
                                            : tr('Не вдалося.'),
                                    ),
                                );
                        }}
                        className="grid gap-2 rounded-xl bg-white/[0.04] p-3 sm:grid-cols-2"
                    >
                        <input
                            value={form.gpu}
                            onChange={(e) =>
                                setForm({ ...form, gpu: e.target.value })
                            }
                            placeholder={tr('Відеокарта')}
                            maxLength={80}
                            className={cn(select, 'h-10')}
                        />
                        <input
                            value={form.cpu}
                            onChange={(e) =>
                                setForm({ ...form, cpu: e.target.value })
                            }
                            placeholder={tr('Процесор (необовʼязково)')}
                            maxLength={80}
                            className={cn(select, 'h-10')}
                        />
                        <select
                            value={form.resolution}
                            onChange={(e) =>
                                setForm({ ...form, resolution: e.target.value })
                            }
                            className={cn(select, 'h-10')}
                        >
                            {data.resolutions.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <select
                            value={form.preset}
                            onChange={(e) =>
                                setForm({ ...form, preset: e.target.value })
                            }
                            className={cn(select, 'h-10')}
                        >
                            {Object.entries(data.presets).map(
                                ([key, label]) => (
                                    <option key={key} value={key}>
                                        {tr(label)}
                                    </option>
                                ),
                            )}
                        </select>
                        <input
                            type="number"
                            value={form.fps}
                            onChange={(e) =>
                                setForm({ ...form, fps: e.target.value })
                            }
                            placeholder={tr('Середній FPS')}
                            min={5}
                            max={1000}
                            className={cn(select, 'h-10')}
                        />
                        <button
                            type="submit"
                            disabled={form.gpu.trim().length < 3 || !form.fps}
                            className="btn-glow h-10 rounded-xl text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Надіслати')}
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="text-sm font-medium text-gc-lilac-300 hover:text-white"
                    >
                        {data.mine
                            ? tr('Оновити свій FPS ({fps})', {
                                  fps: data.mine.fps,
                              })
                            : tr('Додати свій FPS')}
                    </button>
                ))}
        </div>
    );
}
