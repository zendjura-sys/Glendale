import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Crown,
    Clapperboard,
    BookOpen,
    Trophy,
    Gift,
    ListChecks,
    Gamepad2,
    Monitor,
    SearchX,
    Smartphone,
    Tv,
    LayoutList,
    Swords,
    WandSparkles,
    CalendarClock,
    Crosshair,
    Newspaper,
    Check,
    Ellipsis,
    LayoutGrid,
    RotateCcw,
    Search,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pagination } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { GameCard, Paginated } from '@/types';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

type Category = GameCard['category'];

type Props = {
    games: Paginated<GameCard>;
    filters: {
        q: string;
        category: Category | null;
        platform: string | null;
        letter: string | null;
        genre: string | null;
        mode: string | null;
        collection: string | null;
        sort: string;
    };
    categories: Record<Category, string>;
    modes: Record<string, string>;
    sorts: Record<string, string>;
    genres: string[];
    platforms: Record<string, string>;
    letters: string[];
    total: number;
};

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
const CATEGORY_ICONS = {
    pc: Monitor,
    mobile: Smartphone,
    console: Tv,
} as const;

export function GameCover({
    game,
    className,
}: {
    game: GameCard;
    className?: string;
}) {
    // Обкладинка не завантажилась — показуємо ту саму заглушку з ініціалами, а не биту картинку.
    const [broken, setBroken] = useState(false);

    return game.cover && !broken ? (
        <img
            src={game.cover}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn('size-full object-cover', className)}
        />
    ) : (
        <span
            className={cn(
                'flex size-full items-center justify-center bg-gradient-to-br from-gc-blue/30 via-gc-violet-400/25 to-gc-pink/25 font-display text-xl font-bold text-white/80 sm:text-2xl',
                className,
            )}
        >
            {game.name.slice(0, 2).toUpperCase()}
        </span>
    );
}

type Tool = { href: string; label: string; icon: LucideIcon };

/** Кнопка-інструмент у шапці каталогу. */
function ToolLink({ tool }: { tool: Tool }) {
    return (
        <Link
            href={tool.href}
            className="gc-solid-2 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white/80 transition hover:bg-[var(--gc-l3)] hover:text-white"
        >
            <tool.icon className="size-4 text-primary" />
            {tool.label}
        </Link>
    );
}

/** Сегмент перемикача платформ. */
function Segment({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onClick}
            className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition',
                active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-white/60 hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

/** Фільтр-перемикач: підбірка чи режим гри. */
function Toggle({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium whitespace-nowrap ring-1 transition',
                active
                    ? 'bg-primary/15 text-white ring-primary/60'
                    : 'text-white/60 ring-white/10 hover:text-white hover:ring-white/20',
            )}
        >
            {active && <Check className="size-3.5 text-primary" />}
            {children}
        </button>
    );
}

/** Каталог мультиплеєрних ігор: пошук, розділи від ПК до мобільних, покажчик A–Z. */
export default function GamesIndex({
    games,
    filters,
    categories,
    modes,
    sorts,
    genres,
    letters,
    total,
}: Props) {
    const [q, setQ] = useState(filters.q);
    const collectionsOn = usePlugin('game_collections');
    const giveawaysOn = usePlugin('game_giveaways');
    const dealsOn = usePlugin('game_deals');
    const backlogOn = usePlugin('game_backlog');
    const tierOn = usePlugin('tier_lists');
    const nickOn = usePlugin('nick_generator');
    const duelsOn = usePlugin('duels');
    const configsOn = usePlugin('game_configs');
    const nightsOn = usePlugin('game_nights');
    const triviaOn = usePlugin('game_trivia');
    const trailersOn = usePlugin('game_trailers');
    const awardsOn = usePlugin('game_awards');
    const journalOn = usePlugin('game_journal');
    const signedIn = !!usePage().props.auth.user;

    const visit = (patch: Partial<Props['filters']>) =>
        router.get(
            '/games',
            Object.fromEntries(
                Object.entries({ ...filters, q, ...patch }).filter(
                    ([, v]) => v !== null && v !== '',
                ),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );

    // Інструменти для гравців: перші три — кнопками, решта — у меню «Ще», щоб шапка не розросталась.
    const tools: Tool[] = [
        backlogOn &&
            signedIn && {
                href: '/games/backlog',
                label: tr('Мій беклог'),
                icon: ListChecks,
            },
        signedIn && {
            href: '/games/news',
            label: tr('Новини моїх ігор'),
            icon: Newspaper,
        },
        (giveawaysOn || dealsOn) && {
            href: '/games/deals',
            label: tr('Роздачі й знижки'),
            icon: Gift,
        },
        tierOn &&
            signedIn && {
                href: '/tierlists',
                label: tr('Тір-листи'),
                icon: LayoutList,
            },
        duelsOn &&
            signedIn && { href: '/duels', label: tr('Дуелі'), icon: Swords },
        configsOn &&
            signedIn && {
                href: '/configs',
                label: tr('Конфіги й приціли'),
                icon: Crosshair,
            },
        nightsOn &&
            signedIn && {
                href: '/game-nights',
                label: tr('Ігровий вечір'),
                icon: CalendarClock,
            },
        awardsOn &&
            signedIn && {
                href: '/games/awards',
                label: tr('Гра року'),
                icon: Crown,
            },
        trailersOn &&
            signedIn && {
                href: '/games/trailers',
                label: tr('Трейлери'),
                icon: Clapperboard,
            },
        triviaOn &&
            signedIn && {
                href: '/games/trivia',
                label: tr('Вікторина дня'),
                icon: Trophy,
            },
        journalOn &&
            signedIn && {
                href: '/journal',
                label: tr('Ігровий щоденник'),
                icon: BookOpen,
            },
        nickOn &&
            signedIn && {
                href: '/tools/nicknames',
                label: tr('Генератор ніків'),
                icon: WandSparkles,
            },
    ].filter((tool): tool is Tool => Boolean(tool));

    const modeList = Object.entries(modes).filter(([key]) => key !== 'single');
    const active = [
        filters.q,
        filters.category,
        filters.letter,
        filters.genre,
        filters.mode,
        filters.collection,
    ].filter(Boolean).length;
    const reset = () => {
        setQ('');
        router.get('/games', filters.sort ? { sort: filters.sort } : {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q, letter: null }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <>
            <Head title={tr('Каталог ігор')} />
            <header className="gc-solid mb-3 space-y-4 rounded-2xl p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <Gamepad2 className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-2xl leading-tight font-bold text-white">
                            {tr('Каталог ігор')}
                        </h1>
                        <p className="text-sm text-white/50">
                            {tr(
                                '{n} мультиплеєрних ігор — від ПК до телефонів',
                                { n: total },
                            )}
                        </p>
                    </div>
                    <label className="input-glass flex h-11 w-full items-center gap-2 rounded-xl px-3 sm:w-72">
                        <Search className="size-4 shrink-0 text-white/40" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={tr('Знайти гру')}
                            aria-label={tr('Знайти гру')}
                            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                        />
                        {q && (
                            <button
                                type="button"
                                onClick={() => setQ('')}
                                aria-label={tr('Скинути пошук')}
                                className="grid size-6 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </label>
                </div>

                {tools.length > 0 && (
                    <nav
                        aria-label={tr('Інструменти для гравців')}
                        className="flex flex-wrap items-center gap-2"
                    >
                        {tools.slice(0, 3).map((tool) => (
                            <ToolLink key={tool.href} tool={tool} />
                        ))}
                        {tools.length > 3 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white"
                                    >
                                        <Ellipsis className="size-4" />
                                        {tr('Ще {n}', { n: tools.length - 3 })}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="w-60 rounded-xl p-1.5"
                                >
                                    {tools.slice(3).map((tool) => (
                                        <DropdownMenuItem
                                            key={tool.href}
                                            asChild
                                            className="rounded-lg focus:bg-white/[0.06]"
                                        >
                                            <Link
                                                href={tool.href}
                                                className="flex items-center gap-2.5"
                                            >
                                                <tool.icon className="size-4 text-white/55" />
                                                {tool.label}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </nav>
                )}
            </header>

            <section
                aria-label={tr('Фільтри')}
                className="gc-solid mb-4 space-y-3 rounded-2xl p-3 sm:p-4"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        role="radiogroup"
                        aria-label={tr('Платформа')}
                        className="flex max-w-full min-w-0 [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-xl bg-white/[0.04] p-1"
                    >
                        <Segment
                            active={!filters.category}
                            onClick={() => visit({ category: null })}
                        >
                            <LayoutGrid className="size-4" />
                            {tr('Усі')}
                        </Segment>
                        {(Object.keys(categories) as Category[]).map((c) => {
                            const Icon = CATEGORY_ICONS[c];

                            return (
                                <Segment
                                    key={c}
                                    active={filters.category === c}
                                    onClick={() =>
                                        visit({ category: c, letter: null })
                                    }
                                >
                                    <Icon className="size-4" />
                                    {categories[c]}
                                </Segment>
                            );
                        })}
                    </div>
                    <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:w-auto">
                        {genres.length > 0 && (
                            <select
                                value={filters.genre ?? ''}
                                onChange={(e) =>
                                    visit({ genre: e.target.value || null })
                                }
                                className="input-glass h-10 min-w-0 rounded-xl px-3 text-sm text-white sm:w-44"
                                aria-label={tr('Жанр')}
                            >
                                <option value="">{tr('Усі жанри')}</option>
                                {genres.map((g) => (
                                    <option key={g} value={g}>
                                        {g}
                                    </option>
                                ))}
                            </select>
                        )}
                        {Object.keys(sorts).length > 0 && (
                            <select
                                value={filters.sort}
                                onChange={(e) =>
                                    visit({ sort: e.target.value })
                                }
                                className={cn(
                                    'input-glass h-10 min-w-0 rounded-xl px-3 text-sm text-white sm:w-44',
                                    genres.length === 0 && 'col-span-2',
                                )}
                                aria-label={tr('Сортування')}
                            >
                                {Object.entries(sorts).map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {(collectionsOn || modeList.length > 0) && (
                    <div className="-mx-1 flex [scrollbar-width:none] items-center gap-1.5 overflow-x-auto px-1">
                        {collectionsOn &&
                            (
                                [
                                    ['duo', tr('На двох')],
                                    ['evening', tr('На вечір')],
                                ] as const
                            ).map(([key, label]) => (
                                <Toggle
                                    key={key}
                                    active={filters.collection === key}
                                    onClick={() =>
                                        visit({
                                            collection:
                                                filters.collection === key
                                                    ? null
                                                    : key,
                                        })
                                    }
                                >
                                    {label}
                                </Toggle>
                            ))}
                        {collectionsOn && modeList.length > 0 && (
                            <span
                                aria-hidden
                                className="mx-1 h-5 w-px shrink-0 bg-white/10"
                            />
                        )}
                        {modeList.map(([key, label]) => (
                            <Toggle
                                key={key}
                                active={filters.mode === key}
                                onClick={() =>
                                    visit({
                                        mode: filters.mode === key ? null : key,
                                    })
                                }
                            >
                                {label}
                            </Toggle>
                        ))}
                    </div>
                )}

                {/* A–Z: на ширших екранах — рівна смуга на всю ширину, на телефоні — прокрутка. Літери без ігор неактивні. */}
                <div
                    role="group"
                    aria-label={tr('Перша літера назви')}
                    className="flex [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-xl bg-white/[0.03] p-1 lg:grid lg:grid-cols-[auto_repeat(27,minmax(0,1fr))]"
                >
                    <button
                        type="button"
                        onClick={() => visit({ letter: null })}
                        aria-pressed={!filters.letter}
                        className={cn(
                            'h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold transition',
                            !filters.letter
                                ? 'bg-primary text-white'
                                : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                        )}
                    >
                        {tr('Усі')}
                    </button>
                    {ALPHABET.map((l) => {
                        const has = letters.includes(l);

                        return (
                            <button
                                key={l}
                                type="button"
                                disabled={!has}
                                aria-pressed={filters.letter === l}
                                onClick={() => {
                                    setQ('');
                                    visit({ letter: l, q: '' });
                                }}
                                className={cn(
                                    'h-8 min-w-8 shrink-0 rounded-lg text-xs font-semibold tabular-nums transition disabled:cursor-default disabled:text-white/20',
                                    filters.letter === l
                                        ? 'bg-primary text-white'
                                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                                )}
                            >
                                {l}
                            </button>
                        );
                    })}
                </div>

                {active > 0 && (
                    <div className="flex items-center justify-between gap-3 px-1 text-xs text-white/50">
                        <span>{tr('Знайдено: {n}', { n: games.total })}</span>
                        <button
                            type="button"
                            onClick={reset}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-primary hover:bg-white/[0.06]"
                        >
                            <RotateCcw className="size-3.5" />
                            {tr('Скинути фільтри')}
                        </button>
                    </div>
                )}
            </section>

            {games.data.length === 0 ? (
                <EmptyState
                    icon={SearchX}
                    title={tr('Нічого не знайшли')}
                    text={tr('Спробуйте іншу назву або розділ.')}
                />
            ) : (
                <div className="gc-compact-grid">
                    {games.data.map((g) => {
                        const Icon = CATEGORY_ICONS[g.category];

                        return (
                            <Link
                                key={g.id}
                                href={`/games/${g.slug}`}
                                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-black/30 transition hover:border-white/20 sm:aspect-[4/3]"
                            >
                                <GameCover
                                    game={g}
                                    className="absolute inset-0 transition duration-300 group-hover:opacity-90"
                                />
                                <div className="absolute inset-x-1.5 bottom-1.5 rounded-xl bg-black/35 px-2.5 py-2 backdrop-blur-xl backdrop-saturate-150">
                                    <p className="line-clamp-2 text-[13px] leading-tight font-semibold text-white sm:text-sm">
                                        {g.name}
                                    </p>
                                    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-white/70">
                                        <Icon className="size-3.5 shrink-0" />
                                        <span className="break-words">
                                            {g.platforms
                                                .map((p) => p.label)
                                                .slice(0, 3)
                                                .join(' · ') ||
                                                g.category_label}
                                        </span>
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
            <Pagination data={games} />
            <p className="mt-6 text-center text-xs text-white/30">
                {tr('Дані каталогу —')}{' '}
                <a
                    href="https://www.igdb.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white/60"
                >
                    IGDB
                </a>{' '}
                {tr('і')}{' '}
                <a
                    href="https://rawg.io"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white/60"
                >
                    RAWG
                </a>
            </p>
        </>
    );
}
