import { Head, Link, router } from '@inertiajs/react';
import { CalendarClock, Check, Crown, Search, Trophy, X } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate, plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';

type Ranked = GameCard & { votes: number; percent: number };

type Category = {
    key: string;
    label: string;
    hint: string;
    mine: GameCard | null;
    results: { total: number; top: Ranked[] } | null;
};

type Props = {
    year: number;
    phase: 'soon' | 'voting' | 'results';
    opens_on: string;
    closes_on: string;
    voters: number;
    categories: Category[];
    archive: number[];
    next_year: number | null;
    next_opens_on: string;
};

function daysUntil(iso: string): number {
    return Math.max(
        0,
        Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000),
    );
}

function Cover({ game, size = 'size-12' }: { game: GameCard; size?: string }) {
    const [broken, setBroken] = useState(false);
    return game.cover && !broken ? (
        <img
            src={game.cover}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn(size, 'shrink-0 rounded-xl object-cover')}
        />
    ) : (
        <span
            className={cn(
                size,
                'flex shrink-0 items-center justify-center rounded-xl bg-primary/20 font-display text-sm font-bold text-white/85',
            )}
        >
            {game.name.slice(0, 2).toUpperCase()}
        </span>
    );
}

/** Вибір гри в номінації: пошук серед ігор, що їй підходять. */
function Picker({
    category,
    onClose,
    onPicked,
}: {
    category: Category | null;
    onClose: () => void;
    onPicked: (key: string, game: GameCard | null) => void;
}) {
    const [q, setQ] = useState('');
    const [games, setGames] = useState<GameCard[] | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!category) return;
        const t = setTimeout(() => {
            api<{ games: GameCard[] }>(
                'GET',
                `/games/awards/candidates?category=${category.key}&q=${encodeURIComponent(q)}`,
            )
                .then((d) => setGames(d.games))
                .catch(() => setGames([]));
        }, 250);
        return () => clearTimeout(t);
    }, [category, q]);

    const vote = (game: GameCard | null) => {
        if (!category) return;
        setBusy(true);
        api<{ mine: GameCard | null; message: string }>(
            'POST',
            '/games/awards/vote',
            { category: category.key, game: game?.slug ?? null },
        )
            .then((d) => {
                toast.success(tr(d.message));
                onPicked(category.key, d.mine);
            })
            .catch((e: Error) => toast.error(e.message))
            .finally(() => setBusy(false));
    };

    return (
        <Dialog
            open={category !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto sm:max-w-lg">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {category?.label}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {category?.hint}
                    </DialogDescription>
                </div>
                <label className="relative block">
                    <Search className="pointer-events-none absolute top-3 left-3 size-4 text-white/35" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Пошук гри')}
                        className="input-glass h-10 w-full rounded-xl pr-3 pl-9 text-sm text-white placeholder:text-white/30"
                    />
                </label>
                <div className="space-y-1">
                    {games?.length === 0 && (
                        <p className="py-6 text-center text-sm text-white/45">
                            {tr('Нічого не знайдено.')}
                        </p>
                    )}
                    {games?.map((game) => {
                        const picked = category?.mine?.slug === game.slug;
                        return (
                            <button
                                key={game.id}
                                type="button"
                                disabled={busy}
                                onClick={() => vote(game)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[var(--gc-l3)]',
                                    picked && 'bg-primary/15',
                                )}
                            >
                                <Cover game={game} size="size-10" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">
                                        {game.name}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        {[game.year, game.genres.join(', ')]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                                {picked && (
                                    <Check className="size-4 text-primary" />
                                )}
                            </button>
                        );
                    })}
                </div>
                {category?.mine && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => vote(null)}
                        className="inline-flex items-center gap-1.5 self-start text-xs text-white/50 hover:text-white"
                    >
                        <X className="size-3.5" />
                        {tr('Прибрати мій голос')}
                    </button>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** «Гра року» спільноти: голосування в грудні, підсумки з 1 січня. */
export default function Awards(props: Props) {
    const { year, phase, voters, archive } = props;
    const reduce = useReducedMotion();
    const [categories, setCategories] = useState(props.categories);
    const [picking, setPicking] = useState<Category | null>(null);
    useEffect(() => setCategories(props.categories), [props.categories]);
    const votedIn = categories.filter((c) => c.mine).length;

    const subtitle =
        phase === 'voting'
            ? tr(
                  'Голосування до {date}. Оберіть гру в кожній номінації — голос можна змінити.',
                  {
                      date: formatDate(`${props.closes_on}T12:00:00`),
                  },
              )
            : phase === 'soon'
              ? tr('Голосування стартує {date} — через {days}.', {
                    date: formatDate(`${props.opens_on}T12:00:00`),
                    days: `${daysUntil(`${props.opens_on}T00:00:00`)} ${plural(daysUntil(`${props.opens_on}T00:00:00`), ['день', 'дні', 'днів'])}`,
                })
              : tr('Підсумки премії спільноти GameCon.');

    return (
        <>
            <Head title={tr('Гра року {year}', { year })} />
            <div className="space-y-4">
                <header className="gc-solid rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                            <Trophy className="size-6 text-primary" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-display text-2xl font-bold text-white">
                                {tr('Гра року {year}', { year })}
                            </h1>
                            <p className="mt-1 text-sm text-white/55">
                                {subtitle}
                            </p>
                            <p className="mt-2 text-xs text-white/40">
                                {phase === 'voting'
                                    ? tr(
                                          'Ви проголосували в {n} з {total} номінацій · голосів: {voters}',
                                          {
                                              n: votedIn,
                                              total: categories.length,
                                              voters,
                                          },
                                      )
                                    : voters > 0
                                      ? tr('Проголосували: {voters}', {
                                            voters,
                                        })
                                      : null}
                            </p>
                        </div>
                    </div>
                    {archive.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {archive.map((y) => (
                                <Link
                                    key={y}
                                    href={`/games/awards/${y}`}
                                    className={cn(
                                        'rounded-chip px-3 py-1 text-xs font-semibold transition',
                                        y === year
                                            ? 'bg-primary text-white'
                                            : 'gc-solid-2 text-white/70 hover:text-white',
                                    )}
                                >
                                    {y}
                                </Link>
                            ))}
                        </div>
                    )}
                    {props.next_year && (
                        <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
                            <CalendarClock className="size-4 text-primary" />
                            {tr('Голосування за {year} рік стартує {date}.', {
                                year: props.next_year,
                                date: formatDate(
                                    `${props.next_opens_on}T12:00:00`,
                                ),
                            })}
                        </p>
                    )}
                </header>

                <div className="grid gap-3 sm:grid-cols-2">
                    {categories.map((category, i) => (
                        <m.section
                            key={category.key}
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reduce ? 0 : i * 0.03 }}
                            className="gc-solid rounded-2xl p-4"
                        >
                            <h2 className="font-display text-base font-semibold text-white">
                                {category.label}
                            </h2>
                            <p className="mt-0.5 text-xs text-white/45">
                                {category.hint}
                            </p>

                            {phase === 'results' && category.results && (
                                <ol className="mt-3 space-y-2">
                                    {category.results.top.length === 0 && (
                                        <li className="text-sm text-white/45">
                                            {tr('Голосів не було.')}
                                        </li>
                                    )}
                                    {category.results.top.map((game, rank) => (
                                        <li key={game.id}>
                                            <Link
                                                href={`/games/${game.slug}`}
                                                className="flex items-center gap-3"
                                            >
                                                <Cover
                                                    game={game}
                                                    size={
                                                        rank === 0
                                                            ? 'size-12'
                                                            : 'size-9'
                                                    }
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                                                        {rank === 0 && (
                                                            <Crown className="size-4 shrink-0 text-amber-300" />
                                                        )}
                                                        <span className="truncate">
                                                            {game.name}
                                                        </span>
                                                    </span>
                                                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                                                        <span
                                                            className="block h-full rounded-full bg-primary"
                                                            style={{
                                                                width: `${game.percent}%`,
                                                            }}
                                                        />
                                                    </span>
                                                </span>
                                                <span className="w-10 text-right text-xs text-white/55 tabular-nums">
                                                    {game.percent}%
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            {phase !== 'results' && (
                                <div className="mt-3">
                                    {category.mine ? (
                                        <div className="flex items-center gap-3">
                                            <Cover game={category.mine} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-white/45">
                                                    {tr('Ваш вибір')}
                                                </p>
                                                <p className="truncate text-sm font-semibold text-white">
                                                    {category.mine.name}
                                                </p>
                                            </div>
                                            {phase === 'voting' && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPicking(category)
                                                    }
                                                    className="text-xs font-medium text-primary hover:text-white"
                                                >
                                                    {tr('Змінити')}
                                                </button>
                                            )}
                                        </div>
                                    ) : phase === 'voting' ? (
                                        <button
                                            type="button"
                                            onClick={() => setPicking(category)}
                                            className="btn-glow h-10 w-full rounded-xl text-sm font-semibold"
                                        >
                                            {tr('Обрати гру')}
                                        </button>
                                    ) : (
                                        <p className="text-sm text-white/40">
                                            {tr(
                                                'Вибір відкриється з голосуванням.',
                                            )}
                                        </p>
                                    )}
                                </div>
                            )}
                        </m.section>
                    ))}
                </div>
            </div>
            <Picker
                category={picking}
                onClose={() => setPicking(null)}
                onPicked={(key, game) => {
                    setCategories((list) =>
                        list.map((c) =>
                            c.key === key ? { ...c, mine: game } : c,
                        ),
                    );
                    setPicking(null);
                    router.reload({ only: ['voters'] });
                }}
            />
        </>
    );
}
