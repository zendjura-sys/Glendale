import { Link } from '@inertiajs/react';
import {
    BadgePercent,
    BellRing,
    ExternalLink,
    Gift,
    Heart,
    Loader2,
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
};

export const usd = (value: number) =>
    value === 0 ? tr('Безкоштовно') : `$${value.toFixed(2)}`;

/**
 * Ціни на сторінці гри: Steam (регіон UA) і найкращі пропозиції інших магазинів (CheapShark),
 * роздача, якщо гру зараз віддають, і кнопка «У бажане» з бажаною ціною.
 */
export function GamePrices({ slug }: { slug: string }) {
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
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, [slug]);

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
            <div className="flex items-center gap-2 text-sm text-white/45">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                {tr('Шукаємо ціни…')}
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

            {data.lowest_ever !== null && (
                <p className="text-xs text-white/45">
                    {tr('Найнижча ціна за весь час: {price}', {
                        price: usd(data.lowest_ever),
                    })}
                </p>
            )}

            {!data.free && (
                <div className="rounded-2xl bg-white/[0.03] p-3">
                    <div className="flex items-start gap-2">
                        <Heart
                            className={cn(
                                'mt-0.5 size-4 shrink-0',
                                data.wished
                                    ? 'fill-rose-400 text-rose-400'
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
            className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.07]"
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
