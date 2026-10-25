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
                        <Gift className="size-6 shrink-0 text-gc-lilac-200" />{' '}
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
                                : 'bg-white/[0.06] text-white/75 hover:bg-white/10',
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
                        <p className="glass rounded-2xl p-5 text-sm text-white/50">
                            {tr(
                                'Зараз роздач немає — увімкніть сповіщення, і ми напишемо, щойно з’явиться нова.',
                            )}
                        </p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                                    className="glass flex flex-col overflow-hidden rounded-2xl"
                                >
                                    {g.image && (
                                        <img
                                            src={g.image}
                                            alt=""
                                            loading="lazy"
                                            className="aspect-[16/9] w-full object-cover"
                                        />
                                    )}
                                    <div className="flex flex-1 flex-col gap-2 p-4">
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                            <span className="rounded-chip bg-white/10 px-2 py-0.5 font-semibold text-white/85">
                                                {g.store_label}
                                            </span>
                                            {g.ends_at && (
                                                <span className="inline-flex items-center gap-1 rounded-chip bg-amber-500/12 px-2 py-0.5 text-amber-200">
                                                    <Clock3 className="size-3" />
                                                    {timeLeft(g.ends_at)} ·{' '}
                                                    {tr('до {date}', {
                                                        date: formatDate(
                                                            g.ends_at,
                                                            false,
                                                        ),
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="font-display text-base font-semibold break-words text-white">
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
                                            <p className="line-clamp-3 text-sm text-white/55">
                                                {g.description}
                                            </p>
                                        )}
                                        <div className="mt-auto flex items-center gap-2 pt-2">
                                            {g.worth && (
                                                <span className="text-sm text-white/40 line-through">
                                                    {g.worth}
                                                </span>
                                            )}
                                            <span className="text-sm font-semibold text-emerald-300">
                                                {tr('Безкоштовно')}
                                            </span>
                                            <a
                                                href={g.url}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow"
                                                className="btn-glow ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold"
                                            >
                                                {tr('Забрати')}{' '}
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        </div>
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
                <section className="glass rounded-2xl p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Heart className="size-4 text-gc-lilac-200" />
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
                        <ul className="divide-y divide-white/[0.06]">
                            {wishlist.map((w) => (
                                <li
                                    key={w.game.id}
                                    className="flex items-center gap-3 py-2.5"
                                >
                                    <Link
                                        href={`/games/${w.game.slug}`}
                                        className="size-12 shrink-0 overflow-hidden rounded-control"
                                    >
                                        <GameCover game={w.game} />
                                    </Link>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/games/${w.game.slug}`}
                                            className="block text-sm font-semibold break-words text-white hover:underline"
                                        >
                                            {w.game.name}
                                        </Link>
                                        <p className="text-xs break-words text-white/50">
                                            {[
                                                w.best
                                                    ? `${usd(w.best.price)} · ${w.best.store}${w.best.savings > 0 ? ` · −${w.best.savings}%` : ''}`
                                                    : tr(
                                                          'Ціну перевіримо найближчим часом',
                                                      ),
                                                w.target_price !== null
                                                    ? tr('чекаємо {price}', {
                                                          price: usd(
                                                              w.target_price,
                                                          ),
                                                      })
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            api(
                                                'POST',
                                                `/games/${w.game.slug}/wish`,
                                                { on: false },
                                            ).then(() =>
                                                router.reload({
                                                    only: ['wishlist'],
                                                }),
                                            )
                                        }
                                        className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                                        aria-label={tr('Прибрати з бажаного')}
                                        title={tr('Прибрати з бажаного')}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </>
    );
}
