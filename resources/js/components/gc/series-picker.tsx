import { router } from '@inertiajs/react';
import { Check, ListOrdered, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Series = { id: number; title: string; count: number };

/** Вибір серії для запису: серії автора + «Нова серія»; «Без серії» прибирає запис із серії. */
export function SeriesPicker({
    postId,
    current,
    onDone,
}: {
    postId: number;
    current: number | null;
    onDone: () => void;
}) {
    const [series, setSeries] = useState<Series[] | null>(null);
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api<{ series: Series[] }>('GET', '/series/mine')
            .then((r) => setSeries(r.series))
            .catch(() => setSeries([]));
    }, []);

    const attach = (seriesId: number | null) =>
        router.post(
            `/posts/${postId}/series`,
            { series_id: seriesId },
            { preserveScroll: true, onSuccess: onDone },
        );
    const create = async () => {
        if (title.trim().length < 3) return;
        setBusy(true);
        try {
            const r = await api<{ series: Series }>('POST', '/series', {
                title: title.trim(),
            });
            attach(r.series.id);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="gc-solid-2 mt-3 space-y-2 rounded-2xl p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-white/70">
                <ListOrdered className="size-4 text-sky-400" />
                {tr('Серія записів')}
            </p>
            {series === null ? (
                <p className="text-xs text-white/40">{tr('Завантаження…')}</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {series.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => attach(s.id)}
                            className={cn(
                                'inline-flex h-8 items-center gap-1.5 rounded-chip px-3 text-[13px] font-medium transition',
                                current === s.id
                                    ? 'bg-primary text-white'
                                    : 'bg-white/[0.07] text-white/75 hover:bg-white/[0.12]',
                            )}
                        >
                            {current === s.id && <Check className="size-3.5" />}
                            {s.title}
                            <span className="text-white/45">· {s.count}</span>
                        </button>
                    ))}
                    {current !== null && (
                        <button
                            type="button"
                            onClick={() => attach(null)}
                            className="h-8 rounded-chip px-3 text-[13px] font-medium text-white/50 hover:text-red-400"
                        >
                            {tr('Прибрати із серії')}
                        </button>
                    )}
                </div>
            )}
            <div className="flex gap-2">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={tr('Нова серія, напр. «Гайд по CS2»')}
                    maxLength={80}
                    className="input-glass h-9 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <button
                    type="button"
                    disabled={busy || title.trim().length < 3}
                    onClick={create}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus className="size-4" />
                    {tr('Створити')}
                </button>
            </div>
        </div>
    );
}
