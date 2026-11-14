import { Head, Link } from "@inertiajs/react";
import {
    CalendarDays,
    Flame,
    Layers,
    MessageSquare,
    Shuffle,
    SlidersHorizontal,
} from "lucide-react";
import { CinemaNav } from "@/components/cinema/cinema-nav";
import { CinemaShell } from "@/components/cinema/cinema-side";
import type { CinemaSideData } from "@/components/cinema/cinema-side";
import { ForYouRow } from "@/components/cinema/for-you-row";
import { Hero } from "@/components/cinema/hero";
import { ListCard } from "@/components/cinema/list-card";
import type { MovieListCard } from "@/components/cinema/list-card";
import { MovieRow } from "@/components/cinema/movie-row";
import type { MovieRowItem } from "@/components/cinema/movie-row";
import { PosterRow } from "@/components/cinema/movie-tile";
import { UserAvatar } from "@/components/gc/user-avatar";
import { formatDate } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { usePlugin } from "@/lib/plugins";
import type { MovieCard, MovieFeatured, UserCard } from "@/types";

type WeekComment = {
    id: number;
    body: string;
    likes: number;
    created_at: string | null;
    user: UserCard | null;
    movie: { title: string; href: string };
};

type Props = {
    featured: MovieFeatured[];
    recommended: MovieCard[];
    discussed: (MovieRowItem & { comments_count: number })[];
    watchingNow: MovieCard[];
    collections: MovieListCard[];
    comments: WeekComment[];
    side?: CinemaSideData;
};

function SectionTitle({
    title,
    subtitle,
    href,
}: {
    title: string;
    subtitle?: string;
    href?: string;
}) {
    return (
        <div className="mb-3 flex items-end justify-between gap-3">
            <div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                {subtitle && (
                    <p className="text-sm text-white/50">{subtitle}</p>
                )}
            </div>
            {href && (
                <Link
                    href={href}
                    className="shrink-0 text-sm font-medium text-white/80 hover:text-white"
                >
                    {tr("Показати все")}
                </Link>
            )}
        </div>
    );
}

/** «Огляд» кінопорталу: банер, швидкі плитки, рекомендації, обговорюване, колекції й коментарі тижня. */
export default function CinemaOverview({
    featured,
    recommended,
    discussed,
    watchingNow,
    collections,
    comments,
    side,
}: Props) {
    const listsOn = usePlugin("movie_lists");
    const tiles = [
        { href: "/cinema?sort=popular", label: tr("Популярне"), icon: Flame },
        { href: "/cinema/schedule", label: tr("Розклад"), icon: CalendarDays },
        ...(listsOn
            ? [{ href: "/cinema/lists", label: tr("Колекції"), icon: Layers }]
            : []),
        {
            href: "/cinema?sort=rating",
            label: tr("Фільтр"),
            icon: SlidersHorizontal,
        },
        { href: "/cinema/random", label: tr("Рандом"), icon: Shuffle },
    ];

    return (
        <>
            <Head title={tr("Огляд кіно")} />
            <CinemaShell side={side}>
                <CinemaNav active="overview" />
                {featured.length > 0 && <Hero items={featured} />}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {tiles.map((tile) => (
                        <Link
                            key={tile.href}
                            href={tile.href}
                            className="glass flex h-16 items-center gap-3 rounded-2xl px-5 text-[15px] font-semibold text-white transition hover:brightness-110"
                        >
                            <tile.icon className="size-6 shrink-0 text-[var(--vkui--color_icon_accent)]" />
                            {tile.label}
                        </Link>
                    ))}
                </div>

                <section>
                    <SectionTitle
                        title={tr("Вам сподобається")}
                        subtitle={tr(
                            "За вашими оцінками й смаком глядачів, схожих на вас",
                        )}
                    />
                    {recommended.length > 0 ? (
                        <ForYouRow movies={recommended} />
                    ) : (
                        <div className="glass rounded-2xl p-5 text-[15px] text-white/55">
                            {tr(
                                "Продовжуйте дивитися й оцінювати. Чим чесніше виставлені оцінки, тим точніше будуть підібрані рекомендації.",
                            )}
                        </div>
                    )}
                </section>

                {discussed.length > 0 && (
                    <section className="glass rounded-2xl p-5">
                        <SectionTitle title={tr("Обговорюване сьогодні")} />
                        <div className="grid gap-5 lg:grid-cols-2">
                            {discussed.map((movie) => (
                                <MovieRow
                                    key={movie.id}
                                    movie={movie}
                                    variant="compact"
                                    extra={
                                        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-white/55">
                                            <MessageSquare className="size-4" />
                                            {tr("{n} коментарів", {
                                                n: movie.comments_count,
                                            })}
                                        </p>
                                    }
                                />
                            ))}
                        </div>
                    </section>
                )}

                {watchingNow.length > 0 && (
                    <PosterRow
                        title={tr("Дивляться зараз")}
                        movies={watchingNow}
                    />
                )}

                {listsOn && collections.length > 0 && (
                    <section>
                        <SectionTitle
                            title={tr("Колекції тижня")}
                            href="/cinema/lists"
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            {collections.map((list) => (
                                <ListCard key={list.id} list={list} />
                            ))}
                        </div>
                    </section>
                )}

                {comments.length > 0 && (
                    <section>
                        <SectionTitle title={tr("Коментарі тижня")} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            {comments.map((c) => (
                                <div
                                    key={c.id}
                                    className="glass flex gap-3 rounded-2xl p-4"
                                >
                                    {c.user && (
                                        <UserAvatar user={c.user} size="sm" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-white/55">
                                            <span className="font-semibold text-white">
                                                {c.user?.first_name}
                                            </span>{" "}
                                            {tr("до релізу")}{" "}
                                            <Link
                                                href={c.movie.href}
                                                className="text-white/80 hover:underline"
                                            >
                                                {c.movie.title}
                                            </Link>
                                        </p>
                                        <p className="mt-1 line-clamp-3 text-[15px] text-white">
                                            {c.body}
                                        </p>
                                        <p className="mt-2 flex items-center justify-between text-xs text-white/45">
                                            {c.created_at &&
                                                formatDate(c.created_at)}
                                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-400 tabular-nums">
                                                {c.likes}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </CinemaShell>
        </>
    );
}
