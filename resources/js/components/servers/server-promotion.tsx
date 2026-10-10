import { LayoutTemplate, Megaphone, Sparkle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { PLUS_PRICES, startCheckout } from '@/lib/plus';
import type { PlusProduct } from '@/lib/plus';

export type ServerPromotionData = {
    active: { kind: string; starts_at: string; ends_at: string }[];
    free_at: Record<string, string>;
    available: boolean;
};

const KINDS = (): {
    kind: 'top' | 'highlight' | 'banner';
    icon: LucideIcon;
    title: string;
    text: string;
    products: PlusProduct[];
}[] => [
    {
        kind: 'top',
        icon: Megaphone,
        title: tr('Місце в топі каталогу'),
        text: tr(
            'Сервер стоїть першим у каталозі. Одночасно — до трьох серверів.',
        ),
        products: ['promo_top_7', 'promo_top_30'],
    },
    {
        kind: 'highlight',
        icon: Sparkle,
        title: tr('Виділена картка'),
        text: tr(
            'Рамка в кольорі сайту й позначка — картку помітно серед інших.',
        ),
        products: ['promo_highlight_7', 'promo_highlight_30'],
    },
    {
        kind: 'banner',
        icon: LayoutTemplate,
        title: tr('Банер над каталогом'),
        text: tr('Великий банер над списком серверів на 30 днів. Одне місце.'),
        products: ['promo_banner_30'],
    },
];

/** Платне просування сервера для власника. Позначка «Реклама» — завжди. */
export function ServerPromotion({
    serverId,
    data,
}: {
    serverId: number;
    data: ServerPromotionData;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const buy = (product: PlusProduct) => {
        setBusy(product);
        void startCheckout(product, { server_id: serverId }).finally(() =>
            setBusy(null),
        );
    };

    return (
        <section className="glass rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Просування сервера')}
            </h2>
            <p className="mt-1 text-sm text-white/50">
                {tr(
                    'Платні місця позначаються «Реклама» і не впливають на голоси та рейтинг.',
                )}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
                {KINDS().map(({ kind, icon: Icon, title, text, products }) => {
                    const mine = data.active.filter((p) => p.kind === kind);
                    const freeAt = data.free_at[kind];
                    const waits =
                        freeAt &&
                        new Date(freeAt).getTime() > Date.now() + 60_000;

                    return (
                        <div
                            key={kind}
                            className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-4"
                        >
                            <span className="flex items-center gap-2 font-semibold text-white">
                                <Icon className="size-4 text-indigo-300" />
                                {title}
                            </span>
                            <p className="text-xs text-white/50">{text}</p>
                            {mine.map((p) => (
                                <p
                                    key={p.starts_at}
                                    className="text-xs text-emerald-200"
                                >
                                    {new Date(p.starts_at).getTime() >
                                    Date.now()
                                        ? tr('Заплановано з {from} до {to}', {
                                              from: formatDate(p.starts_at),
                                              to: formatDate(p.ends_at),
                                          })
                                        : tr('Діє до {date}', {
                                              date: formatDate(p.ends_at),
                                          })}
                                </p>
                            ))}
                            {waits && (
                                <p className="text-xs text-amber-200/80">
                                    {tr(
                                        'Усі місця зайняті — оплачений період почнеться {date}.',
                                        { date: formatDate(freeAt) },
                                    )}
                                </p>
                            )}
                            <div className="mt-auto flex flex-wrap gap-2 pt-1">
                                {products.map((product) => (
                                    <button
                                        key={product}
                                        type="button"
                                        disabled={
                                            !data.available || busy !== null
                                        }
                                        onClick={() => buy(product)}
                                        className="inline-flex h-9 items-center rounded-xl bg-[var(--btn-primary,#6366f1)] px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                                    >
                                        {product.endsWith('_7')
                                            ? tr('7 днів · {price} ₴', {
                                                  price: PLUS_PRICES[product],
                                              })
                                            : tr('30 днів · {price} ₴', {
                                                  price: PLUS_PRICES[product],
                                              })}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {!data.available && (
                <p className="mt-3 text-xs text-white/40">
                    {tr(
                        'Оплату ще не підключено — зверніться до адміністрації.',
                    )}
                </p>
            )}
        </section>
    );
}
