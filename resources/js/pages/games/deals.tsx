import { Head, Link, router } from '@inertiajs/react';
import {
    BellRing,
    Clock3,
    ExternalLink,
    Gift,
    Heart,
    Trash2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';
import { usd } from '@/components/games/game-prices';
import type { Deal } from '@/components/games/game-prices';
import { GameCover } from './index';

type Giveaway = {
    id: number;
    title: string;
    store: 'epic' | 'steam' | 'gog' | 'other';
    store_label: string;
    worth: string | null;
    image: string | null;
    description: string | null;
    url: string;
    ends_at: string | null;
    game: GameCard | null;
};

type Wish = {
    game: GameCard;
    target_price: number | null;
    best: Deal | null;
};

type Props = {
    giveaways: Giveaway[];
    subscribed: boolean;
    wishlist: Wish[];
};

/** Скільки лишилось до кінця роздачі: «ще 3 дні», «ще 5 год». */
function timeLeft(iso: string): string {
    const hours = Math.max(
        0,
        Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000),
    );
    if (hours < 48) return tr('ще {n} год', { n: Math.max(1, hours) });

    return tr('ще {n} дн.', { n: Math.round(hours / 24) });
}

/** Безкоштовні ігри зараз і мій список бажаного зі знижками. */
export default function GameDeals({ giveaways, subscribed, wishlist }: Props) {
    const giveawaysOn = usePlugin('game_giveaways');
    const dealsOn = usePlugin('game_deals');
    const reduce = useReducedMotion();

    return (
        <>
            <Head title={tr('Роздачі й знижки')} />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                        <Gift className="size-6 shrink-0 text-sky-400" />{' '}
                        {tr('Роздачі й знижки')}
                    </h1>
                    <p className="text-sm text-white/50">
                        {tr(
                            'Ігри, які зараз віддають безкоштовно в Epic Games, Steam і GOG, і ваш список бажаного.',
                        )}
                    </p>
                </div>
                {giveawaysOn && (
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                '/games/deals/subscribe',
                                { on: !subscribed },
                                { preserveScroll: true },
                            )
                        }
                        className={cn(
                            'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition',
                            subscribed
                                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                                : 'gc-solid-2 text-white/75 hover:bg-white/10',
                        )}
                    >
                        <BellRing className="size-4" />
                        {subscribed
                            ? tr('Сповіщаємо про роздачі')
                            : tr('Сповіщати про роздачі')}
                    </button>
                )}
            </div>

            {giveawaysOn && (
                <section className="mb-6">
                    {giveaways.length === 0 ? (
                        <p className="gc-solid rounded-2xl p-5 text-sm text-white/50">
                            {tr(
                                'Зараз роздач немає — увімкніть сповіщення, і ми напишемо, щойно з’явиться нова.',
                            )}
                        </p>
                    ) : (
                        <div className="grid gap-3 min-[1920px]:grid-cols-4 min-[2400px]:grid-cols-5 sm:grid-cols-2 xl:grid-cols-3">
                            {giveaways.map((g, i) => (
                                <motion.article
                                    key={g.id}
                                    initial={
                                        reduce ? false : { opacity: 0, y: 8 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        duration: 0.25,
                                        delay: reduce
                                            ? 0
                                            : Math.min(i, 8) * 0.03,
                                    }}
                                    className="gc-solid group flex flex-col overflow-hidden rounded-2xl"
                                >
                                    <div className="relative aspect-[16/9] overflow-hidden bg-white/[0.04]">
                                        {g.image ? (
                                            <img
                                                src={g.image}
                                                alt=""
                                                loading="lazy"
                                                className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                            />
                                        ) : (
                                            <Gift className="absolute inset-0 m-auto size-10 text-white/25" />
                                        )}
                                        <span className="absolute top-2 left-2 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-semibold text-white">
                                            {g.store_label}
                                        </span>
                                        <span className="absolute top-2 right-2 rounded-lg bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white">
                                            −100%
                                        </span>
                                    </div>
                                    <div className="flex flex-1 flex-col gap-2 p-4">
                                        <h2 className="line-clamp-2 font-display text-base leading-snug font-semibold break-words text-white">
                                            {g.game ? (
                                                <Link
                                                    href={`/games/${g.game.slug}`}
                                                    className="hover:underline"
                                                >
                                                    {g.title}
                                                </Link>
                                            ) : (
                                                g.title
                                            )}
                                        </h2>
                                        {g.description && (
                                            <p className="line-clamp-2 text-sm text-white/55">
                                                {g.description}
                                            </p>
                                        )}
                                        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                                            <div>
                                                {g.worth && (
                                                    <p className="text-xs text-white/40 line-through">
                                                        {g.worth}
                                                    </p>
                                                )}
                                                <p className="font-display text-2xl leading-none font-bold text-emerald-300">
                                                    {tr('0 ₴')}
                                                </p>
                                            </div>
                                            {g.ends_at && (
                                                <span
                                                    title={tr('до {date}', {
                                                        date: formatDate(
                                                            g.ends_at,
                                                            false,
                                                        ),
                                                    })}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/12 px-2 py-1 text-xs font-medium text-amber-200"
                                                >
                                                    <Clock3 className="size-3.5" />
                                                    {timeLeft(g.ends_at)}
                                                </span>
                                            )}
                                        </div>
                                        <a
                                            href={g.url}
                                            target="_blank"
                                            rel="noopener noreferrer nofollow"
                                            className="btn-glow mt-1 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold"
                                        >
                                            {tr('Забрати безкоштовно')}
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </div>
                                </motion.article>
                            ))}
                        </div>
                    )}
                    <p className="mt-2 text-[11px] text-white/35">
                        {tr('Дані про роздачі — GamerPower.')}
                    </p>
                </section>
            )}

            {dealsOn && (
                <section className="gc-solid rounded-2xl p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Heart className="size-4 text-sky-400" />
                        <h2 className="font-display text-base font-semibold text-white">
                            {tr('Мій список бажаного')}
                        </h2>
                    </div>
                    {wishlist.length === 0 ? (
                        <p className="text-sm text-white/50">
                            {tr(
                                'Порожньо. На сторінці гри натисніть «У бажане» — сповістимо про знижку або роздачу.',
                            )}
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {wishlist.map((w) => {
                                const hit =
                                    w.best !== null &&
                                    w.target_price !== null &&
                                    w.best.price <= w.target_price;

                                return (
                                    <article
                                        key={w.game.id}
                                        className="group flex flex-col overflow-hidden rounded-2xl bg-white/[0.04]"
                                    >
                                        <Link
                                            href={`/games/${w.game.slug}`}
                                            className="relative block aspect-[3/4] overflow-hidden"
                                        >
                                            <GameCover game={w.game} />
                                            {w.best && w.best.savings > 0 && (
                                                <span className="absolute top-2 right-2 rounded-lg bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white">
                                                    −{w.best.savings}%
                                                </span>
                                            )}
                                            {hit && (
                                                <span className="absolute top-2 left-2 rounded-lg bg-sky-500 px-2 py-1 text-[11px] font-bold text-white">
                                                    {tr('Ваша ціна')}
                                                </span>
                                            )}
                                        </Link>
                                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                                            <Link
                                                href={`/games/${w.game.slug}`}
                                                className="line-clamp-2 text-sm font-semibold break-words text-white hover:underline"
                                            >
                                                {w.game.name}
                                            </Link>
                                            {w.best ? (
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="font-display text-lg font-bold text-white">
                                                        {usd(w.best.price)}
                                                    </span>
                                                    {w.best.savings > 0 && (
                                                        <span className="text-xs text-white/40 line-through">
                                                            {usd(w.best.retail)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-white/45">
                                                    {tr(
                                                        'Ціну перевіримо найближчим часом',
                                                    )}
                                                </p>
                                            )}
                                            <p className="text-[11px] text-white/45">
                                                {[
                                                    w.best?.store,
                                                    w.target_price !== null
                                                        ? tr(
                                                              'чекаємо {price}',
                                                              {
                                                                  price: usd(
                                                                      w.target_price,
                                                                  ),
                                                              },
                                                          )
                                                        : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                            <div className="mt-auto flex gap-1.5 pt-1.5">
                                                {w.best && (
                                                    <a
                                                        href={w.best.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer nofollow"
                                                        className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-xs font-semibold text-white"
                                                    >
                                                        {tr('До магазину')}
                                                        <ExternalLink className="size-3" />
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        api(
                                                            'POST',
                                                            `/games/${w.game.slug}/wish`,
                                                            { on: false },
                                                        ).then(() =>
                                                            router.reload({
                                                                only: [
                                                                    'wishlist',
                                                                ],
                                                            }),
                                                        )
                                                    }
                                                    className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-white/50 transition hover:bg-white/10 hover:text-white"
                                                    aria-label={tr(
                                                        'Прибрати з бажаного',
                                                    )}
                                                    title={tr(
                                                        'Прибрати з бажаного',
                                                    )}
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </>
    );
}
