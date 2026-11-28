import { Link } from '@inertiajs/react';
import { Sk } from '@/components/gc/skeletons';
import {
    BadgePercent,
    BellRing,
    ExternalLink,
    Gift,
    Heart,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Deal = {
    store: string;
    price: number;
    retail: number;
    savings: number;
    url: string;
};

type Prices = {
    free: boolean;
    steam: { final: string; initial: string; discount: number } | null;
    steam_url: string | null;
    deals: Deal[];
    lowest_ever: number | null;
    giveaway: {
        title: string;
        store_label: string;
        url: string;
        ends_at: string | null;
    } | null;
    wished: boolean;
    target_price: number | null;
    history?: { points: { day: string; price: number }[]; low: number | null };
};

/**
 * Графік найкращої ціни по днях (сходинками, як змінюється ціна в магазині) з лінією мінімуму.
 * Наведення показує ціну й дату.
 */
function PriceHistory({
    points,
    low,
}: {
    points: { day: string; price: number }[];
    low: number | null;
}) {
    const [hover, setHover] = useState<number | null>(null);
    if (points.length < 2) {
        return (
            <p className="text-xs text-white/45">
                {tr(
                    'Історію ціни почали збирати — графік з’явиться за кілька днів.',
                )}
            </p>
        );
    }
    const W = 600;
    const H = 120;
    const max = Math.max(...points.map((p) => p.price));
    const min = Math.min(...points.map((p) => p.price));
    const span = Math.max(0.01, max - min);
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => 10 + (1 - (v - min) / span) * (H - 20);
    let path = `M0 ${y(points[0].price)}`;
    points.forEach((p, i) => {
        if (i > 0) path += ` H${x(i)} V${y(p.price)}`;
    });
    const area = `${path} V${H} H0 Z`;
    const active = hover !== null ? points[hover] : points[points.length - 1];

    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-white/55">
                    {tr('Історія найкращої ціни')}
                </span>
                <span className="text-white/70 tabular-nums">
                    {usd(active.price)} · {formatDate(active.day, false)}
                </span>
            </div>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-28 w-full touch-none"
                role="img"
                aria-label={tr('Графік ціни')}
                onPointerMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setHover(
                        Math.round(
                            ((e.clientX - r.left) / r.width) *
                                (points.length - 1),
                        ),
                    );
                }}
                onPointerLeave={() => setHover(null)}
            >
                <defs>
                    <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop
                            offset="0"
                            stopColor="rgb(56 189 248)"
                            stopOpacity="0.28"
                        />
                        <stop
                            offset="1"
                            stopColor="rgb(56 189 248)"
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>
                <path d={area} fill="url(#price-fill)" />
                <path
                    d={path}
                    fill="none"
                    stroke="rgb(56 189 248)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />
                {low !== null && (
                    <line
                        x1="0"
                        x2={W}
                        y1={y(low)}
                        y2={y(low)}
                        stroke="rgb(52 211 153)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                {hover !== null && (
                    <line
                        x1={x(hover)}
                        x2={x(hover)}
                        y1="0"
                        y2={H}
                        stroke="white"
                        strokeOpacity="0.25"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
            </svg>
            <div className="mt-1 flex justify-between text-[11px] text-white/40">
                <span>{formatDate(points[0].day, false)}</span>
                {low !== null && (
                    <span className="text-emerald-300">
                        {tr('Мінімум за рік: {price}', { price: usd(low) })}
                    </span>
                )}
                <span>{tr('сьогодні')}</span>
            </div>
        </div>
    );
}

export const usd = (value: number) =>
    value === 0 ? tr('Безкоштовно') : `$${value.toFixed(2)}`;

/**
 * Ціни на сторінці гри: Steam (регіон UA) і найкращі пропозиції інших магазинів (CheapShark),
 * роздача, якщо гру зараз віддають, і кнопка «У бажане» з бажаною ціною.
 */
export function GamePrices({
    slug,
    onFail,
}: {
    slug: string;
    onFail?: () => void;
}) {
    const [data, setData] = useState<Prices | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [target, setTarget] = useState('');

    useEffect(() => {
        let alive = true;
        api<Prices>('GET', `/games/${slug}/prices`)
            .then((d) => {
                if (!alive) return;
                setData(d);
                setTarget(
                    d.target_price !== null ? String(d.target_price) : '',
                );
            })
            .catch(() => {
                if (!alive) return;
                setFailed(true);
                onFail?.();
            });

        return () => {
            alive = false;
        };
    }, [slug, onFail]);

    const wish = async (on: boolean) => {
        setBusy(true);
        try {
            const res = await api<{
                wished: boolean;
                target_price: number | null;
            }>('POST', `/games/${slug}/wish`, {
                on,
                target_price:
                    on && target.trim() !== '' ? Number(target) : null,
            });
            setData((d) => (d ? { ...d, ...res } : d));
            toast.success(
                res.wished
                    ? tr('Додано в бажане — повідомимо про знижку.')
                    : tr('Прибрано з бажаного.'),
            );
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : tr('Не вдалося зберегти.'),
            );
        } finally {
            setBusy(false);
        }
    };

    if (failed) return null;
    if (data === null) {
        return (
            <div className="space-y-2.5" aria-label={tr('Шукаємо ціни…')}>
                <Sk className="h-10 w-full rounded-xl" />
                <Sk className="h-10 w-4/5 rounded-xl" />
            </div>
        );
    }

    const known = data.steam !== null || data.deals.length > 0 || data.free;

    return (
        <div className="space-y-3">
            {data.giveaway && (
                <a
                    href={data.giveaway.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-3 rounded-2xl bg-emerald-500/12 p-3 text-sm text-emerald-100 transition hover:bg-emerald-500/18"
                >
                    <Gift className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 break-words">
                        {tr('Зараз безкоштовно в {store}', {
                            store: data.giveaway.store_label,
                        })}
                        {data.giveaway.ends_at &&
                            ` · ${tr('до {date}', { date: formatDate(data.giveaway.ends_at, false) })}`}
                    </span>
                    <ExternalLink className="size-4 shrink-0" />
                </a>
            )}

            {!known ? (
                <p className="text-sm text-white/45">
                    {tr(
                        'Цін для цієї гри не знайшли — можливо, вона безкоштовна або продається лише в одному магазині.',
                    )}
                </p>
            ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                    {(data.steam || data.free) && data.steam_url && (
                        <PriceRow
                            store="Steam"
                            url={data.steam_url}
                            price={
                                data.free
                                    ? tr('Безкоштовно')
                                    : data.steam!.final
                            }
                            old={
                                data.steam && data.steam.discount > 0
                                    ? data.steam.initial
                                    : null
                            }
                            savings={data.steam?.discount ?? 0}
                        />
                    )}
                    {data.deals
                        .filter((d) => !(data.steam && d.store === 'Steam'))
                        .slice(0, 5)
                        .map((d) => (
                            <PriceRow
                                key={d.url}
                                store={d.store}
                                url={d.url}
                                price={usd(d.price)}
                                old={d.savings > 0 ? usd(d.retail) : null}
                                savings={d.savings}
                            />
                        ))}
                </div>
            )}

            {data.history && !data.free && known && (
                <PriceHistory
                    points={data.history.points}
                    low={data.history.low}
                />
            )}

            {data.lowest_ever !== null && (
                <p className="text-xs text-white/45">
                    {tr('Найнижча ціна за весь час: {price}', {
                        price: usd(data.lowest_ever),
                    })}
                </p>
            )}

            {!data.free && (
                <div className="gc-solid-2 rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                        <Heart
                            className={cn(
                                'mt-0.5 size-4 shrink-0',
                                data.wished
                                    ? 'fill-red-400 text-red-400'
                                    : 'text-white/50',
                            )}
                        />
                        <p className="min-w-0 flex-1 text-sm text-white/70">
                            {data.wished
                                ? tr(
                                      'У бажаному. Сповістимо про знижку або роздачу.',
                                  )
                                : tr(
                                      'Додайте в бажане — сповістимо про знижку або роздачу.',
                                  )}
                        </p>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <label className="input-glass flex h-9 w-36 items-center gap-1 rounded-xl px-2 text-sm">
                            <span className="text-white/40">$</span>
                            <input
                                value={target}
                                onChange={(e) =>
                                    setTarget(
                                        e.target.value.replace(/[^0-9.]/g, ''),
                                    )
                                }
                                inputMode="decimal"
                                placeholder={tr('бажана ціна')}
                                aria-label={tr('Бажана ціна, $')}
                                className="min-w-0 flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => wish(true)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary/15 px-3 text-sm font-semibold text-primary transition hover:bg-primary/25 disabled:opacity-50"
                        >
                            <BellRing className="size-4" />
                            {data.wished ? tr('Зберегти') : tr('У бажане')}
                        </button>
                        {data.wished && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => wish(false)}
                                className="h-9 rounded-xl px-3 text-sm text-white/55 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                            >
                                {tr('Прибрати')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <p className="text-[11px] text-white/35">
                {tr('Ціни магазинів у доларах США — дані CheapShark.')}{' '}
                <Link
                    href="/games/deals"
                    className="text-white/55 underline-offset-2 hover:underline"
                >
                    {tr('Роздачі й мій список бажаного')}
                </Link>
            </p>
        </div>
    );
}

function PriceRow({
    store,
    url,
    price,
    old,
    savings,
}: {
    store: string;
    url: string;
    price: string;
    old: string | null;
    savings: number;
}) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="gc-solid-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-[var(--gc-l3)]"
        >
            <span className="min-w-0 flex-1 text-sm break-words text-white/80">
                {store}
            </span>
            {savings > 0 && (
                <span className="inline-flex items-center gap-1 rounded-chip bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                    <BadgePercent className="size-3" />−{savings}%
                </span>
            )}
            <span className="text-right">
                {old && (
                    <span className="block text-[11px] text-white/35 line-through">
                        {old}
                    </span>
                )}
                <span className="block text-sm font-semibold text-white tabular-nums">
                    {price}
                </span>
            </span>
        </a>
    );
}
