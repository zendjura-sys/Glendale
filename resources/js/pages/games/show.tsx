import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ExternalLink,
    Plus,
    Star,
    Swords,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';
import { GameCover } from './index';

type ClanCard = {
    id: number;
    slug: string;
    name: string;
    display_name: string;
    tag: string;
    type: 'clan' | 'guild';
    logo_url: string | null;
    members_count: number;
    is_recruiting: boolean;
};

type Props = {
    game: GameCard & {
        genres: string[];
        released: string | null;
        rating: number | null;
        links: { store: string; label: string; url: string }[];
    };
    clans: ClanCard[];
};

const STORE_STYLE: Record<string, string> = {
    steam: 'bg-[#1b2838] hover:bg-[#2a475e]',
    gplay: 'bg-[#01875f] hover:bg-[#03a374]',
    appstore: 'bg-[#0a84ff] hover:bg-[#3a9bff]',
    epic: 'bg-[#2a2a2a] hover:bg-[#3a3a3a]',
};

/** Сторінка гри: платформи, жанри, прямі посилання на магазини й клани цієї гри. */
export default function GameShow({ game, clans }: Props) {
    return (
        <>
            <Head title={game.name} />
            <Link
                href="/games"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
            >
                <ArrowLeft className="size-4" /> Каталог ігор
            </Link>
            <div className="glass overflow-hidden rounded-3xl">
                <div className="relative aspect-[21/8] max-h-[320px] w-full overflow-hidden bg-black/40">
                    <GameCover game={game} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                            {game.name}
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                            <span>
                                {game.platforms.map((p) => p.label).join(' · ')}
                            </span>
                            {game.released && (
                                <span>{game.released.slice(0, 4)}</span>
                            )}
                            {game.rating ? (
                                <span className="inline-flex items-center gap-1">
                                    <Star className="size-3.5 fill-amber-300 text-amber-300" />{' '}
                                    {game.rating.toFixed(1)}
                                </span>
                            ) : null}
                        </p>
                    </div>
                </div>
                <div className="space-y-4 p-4 sm:p-5">
                    {game.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {game.genres.map((g) => (
                                <span
                                    key={g}
                                    className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/70"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                    {game.links.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {game.links.map((l) => (
                                <a
                                    key={l.store + l.url}
                                    href={l.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                        'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition',
                                        STORE_STYLE[l.store] ??
                                            'bg-white/[0.08] hover:bg-white/15',
                                    )}
                                >
                                    {l.label}{' '}
                                    <ExternalLink className="size-4 opacity-70" />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/45">
                            Посилання на магазини з’являться після наступного
                            оновлення каталогу.
                        </p>
                    )}
                </div>
            </div>

            <section className="glass mt-4 rounded-3xl p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                    <Swords className="size-4 text-[#a5b4fc]" />
                    <h2 className="flex-1 font-display text-base font-semibold text-white">
                        Клани й гільдії
                    </h2>
                    <Link
                        href={`/clans/create?game=${game.slug}`}
                        className="btn-glow inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold"
                    >
                        <Plus className="size-4" /> Створити
                    </Link>
                </div>
                {clans.length === 0 ? (
                    <p className="text-sm text-white/45">
                        Ще немає жодного клану для цієї гри — створіть перший.
                    </p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {clans.map((c) => (
                            <Link
                                key={c.id}
                                href={`/clans/${c.slug}`}
                                className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
                            >
                                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-sm font-bold text-white">
                                    {c.logo_url ? (
                                        <img
                                            src={c.logo_url}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        c.tag
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">
                                        {c.display_name}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-white/45">
                                        <Users className="size-3.5" />{' '}
                                        {c.members_count}
                                        {c.is_recruiting && (
                                            <span className="ml-2 text-emerald-300">
                                                набір відкрито
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
