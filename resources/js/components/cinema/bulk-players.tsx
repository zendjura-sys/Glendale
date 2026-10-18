import { Link, router } from '@inertiajs/react';
import { Layers, Loader2, Plus, RefreshCw, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { selectClass } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieOption, MovieType } from '@/types';

export type BulkState = {
    status: 'running' | 'finished' | 'cancelled';
    replace: boolean;
    type: MovieType | null;
    total: number;
    done: number;
    changed: number;
    added: number;
    replaced: number;
    removed: number;
    not_found: number;
    errors: string[];
    report?: BulkReportRow[];
    started_at: string;
    finished_at: string | null;
};

type ProviderChange = { added: number; replaced: number; removed: number };

export type BulkReportRow = {
    id: number;
    title: string;
    year: number | null;
    type: string;
    providers: Record<string, ProviderChange>;
};

export type BulkData = {
    state: BulkState | null;
    running: boolean;
};

const PROVIDER_NAMES: Record<string, string> = {
    kodik: 'Kodik',
    flixcdn: 'FlixCDN',
    videoseed: 'Videoseed',
};

/**
 * Масова проставка плеєрів на всі тайтли. Перед запуском — питання, чи замінювати наявні плеєри:
 * «Так» — плеєри оновлюються; «Ні» — лише додаються нові озвучки. На тайтлах позначок немає —
 * що й де змінено, видно у звіті.
 */
export function BulkPlayersPanel({
    data,
    types,
}: {
    data: BulkData;
    types: MovieOption<MovieType>[];
}) {
    const [type, setType] = useState<MovieType | ''>('');
    const [asking, setAsking] = useState(false);
    const state = data.state;
    const running = data.running;

    // Поки йде проставка — оновлюємо стан кожні 5 секунд.
    useEffect(() => {
        if (!running) return;
        const timer = window.setInterval(
            () =>
                router.reload({
                    only: ['bulk', 'stats', 'movies'],
                }),
            5000,
        );

        return () => window.clearInterval(timer);
    }, [running]);

    const start = (replace: boolean) => {
        setAsking(false);
        router.post(
            '/admin/cinema/players/bulk',
            { replace, type: type || null },
            { preserveScroll: true },
        );
    };

    const stop = () =>
        router.delete('/admin/cinema/players/bulk', { preserveScroll: true });

    const percent =
        state && state.total > 0
            ? Math.min(100, Math.round((state.done / state.total) * 100))
            : 0;

    return (
        <section className="glass mb-5 rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <Layers className="size-5 text-gc-sky" />
                        {tr('Проставка плеєрів')}
                    </h2>
                    <p className="mt-1 max-w-xl text-sm text-white/50">
                        {tr(
                            'Шукає плеєри Kodik, Videoseed і FlixCDN для всіх фільмів, серіалів, аніме й мультфільмів. Нові озвучки додаються до тайтлу, наявні плеєри можна замінити. Що саме змінено — у звіті нижче.',
                        )}
                    </p>
                </div>
            </div>

            {running && state ? (
                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex items-center gap-2 text-white/75">
                            <Loader2 className="size-4 animate-spin" />
                            {state.replace
                                ? tr('Заміна плеєрів')
                                : tr('Додавання нових озвучок')}
                            <span className="text-white/45 tabular-nums">
                                {state.done} / {state.total}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={stop}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/10"
                        >
                            <Square className="size-3" />
                            {tr('Зупинити')}
                        </button>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="h-full rounded-full bg-[var(--btn-primary,#6366f1)] transition-[width] duration-500"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <Summary state={state} />
                </div>
            ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <select
                        value={type}
                        onChange={(e) =>
                            setType(e.target.value as MovieType | '')
                        }
                        className={cn(selectClass, 'h-10')}
                        aria-label={tr('Тип')}
                    >
                        <option value="">{tr('Усі тайтли')}</option>
                        {types.map((t) => (
                            <option key={t.key} value={t.key}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setAsking(true)}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <RefreshCw className="size-4" />
                        {tr('Проставити плеєри')}
                    </button>
                </div>
            )}

            {!running && state && (
                <div className="mt-4 rounded-2xl border border-white/[0.06] p-3">
                    <p className="text-xs font-semibold text-white/60">
                        {state.status === 'cancelled'
                            ? tr('Останню проставку зупинено')
                            : tr('Остання проставка')}
                        {' · '}
                        {state.replace
                            ? tr('із заміною')
                            : tr('лише нові озвучки')}
                        {' · '}
                        <span className="tabular-nums">
                            {state.done} / {state.total}
                        </span>
                    </p>
                    <Summary state={state} />
                    <Report rows={state.report ?? []} />
                </div>
            )}

            <Dialog open={asking} onOpenChange={setAsking}>
                <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-md">
                    <DialogTitle className="font-display text-xl">
                        {tr('Замінювати наявні плеєри?')}
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-sm text-white/55">
                        {tr(
                            'Нові озвучки додаються в будь-якому разі. Якщо замінити — посилання наявних плеєрів оновляться, а зниклі в провайдера озвучки приберуться. Власні плеєри не зачіпаються. Що змінено — у звіті.',
                        )}
                    </DialogDescription>
                    <div className="mt-5 grid gap-2">
                        <button
                            type="button"
                            onClick={() => start(true)}
                            className="btn-glow inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <RefreshCw className="size-4" />
                            {tr('Так, замінити й додати нові')}
                        </button>
                        <button
                            type="button"
                            onClick={() => start(false)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
                        >
                            <Plus className="size-4" />
                            {tr('Ні, лише додати нові озвучки')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAsking(false)}
                            className="h-10 rounded-xl text-sm text-white/50 transition hover:text-white"
                        >
                            {tr('Скасувати')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function Summary({ state }: { state: BulkState }) {
    return (
        <>
            <p className="mt-1 text-xs text-white/50">
                {tr(
                    'Змінено тайтлів: {changed} · нових озвучок: {added} · замінено: {replaced} · прибрано: {removed} · не знайдено: {missing}',
                    {
                        changed: state.changed,
                        added: state.added,
                        replaced: state.replaced,
                        removed: state.removed,
                        missing: state.not_found,
                    },
                )}
            </p>
            {state.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-rose-200/80">
                    {state.errors.slice(0, 5).map((error) => (
                        <li key={error} className="truncate">
                            {error}
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/** Звіт: які тайтли змінено й що саме (за провайдерами). */
function Report({ rows }: { rows: BulkReportRow[] }) {
    if (rows.length === 0) return null;

    return (
        <details className="group mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-white/65 transition hover:text-white">
                {tr('Що змінено ({n})', { n: rows.length })}
            </summary>
            <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-1">
                {rows.map((row) => (
                    <li
                        key={row.id}
                        className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs"
                    >
                        <Link
                            href={`/admin/cinema/${row.id}/edit`}
                            className="font-semibold text-white/85 hover:text-white"
                        >
                            {row.title}
                            {row.year ? ` (${row.year})` : ''}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-white/50">
                            {Object.entries(row.providers).map(
                                ([provider, change]) => (
                                    <span key={provider}>
                                        <b className="font-semibold text-white/65">
                                            {PROVIDER_NAMES[provider] ??
                                                provider}
                                        </b>
                                        {change.added > 0 &&
                                            tr(' · додано {n}', {
                                                n: change.added,
                                            })}
                                        {change.replaced > 0 &&
                                            tr(' · замінено {n}', {
                                                n: change.replaced,
                                            })}
                                        {change.removed > 0 &&
                                            tr(' · прибрано {n}', {
                                                n: change.removed,
                                            })}
                                    </span>
                                ),
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </details>
    );
}
