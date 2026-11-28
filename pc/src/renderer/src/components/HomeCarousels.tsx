import { ChevronLeft, ChevronRight, Clapperboard, Gamepad2, Music, Play, Star } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { Cover } from '@/components/kit';
import { useLive } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useNav } from '@/lib/nav';
import { player, type Track } from '@/lib/player';
import { hasPage } from '@/pages';

type Movie = { id: number; slug: string; title: string; year: number | null; poster: string | null; type_label: string; rating: number | null };
type Game = { id: number; slug: string; name: string; cover: string | null; category_label: string; rating: number | null };

/** Рядок-карусель: заголовок, стрілки й горизонтальна стрічка карток (колесом миші теж гортається). */
function Row({ title, icon, more, children }: { title: string; icon: ReactNode; more?: () => void; children: ReactNode }) {
    const strip = useRef<HTMLDivElement>(null);
    const scroll = (dir: number): void => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });
    return (
        <section className="min-w-0">
            <div className="mb-2 flex items-center gap-2 px-1">
                <span className="text-neon-cyan">{icon}</span>
                <h2 className="text-[15px] font-semibold">{title}</h2>
                {more && (
                    <button type="button" onClick={more} className="ml-2 text-xs text-white/45 hover:text-white">
                        Усі →
                    </button>
                )}
                <div className="flex-1" />
                <button type="button" aria-label="Назад" onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-white/60 ring-1 ring-white/10 hover:bg-white/10">
                    <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Далі" onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-lg text-white/60 ring-1 ring-white/10 hover:bg-white/10">
                    <ChevronRight size={16} />
                </button>
            </div>
            <div
                ref={strip}
                onWheel={(e) => {
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && strip.current) strip.current.scrollLeft += e.deltaY;
                }}
                className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {children}
            </div>
        </section>
    );
}

/**
 * Головна програми: угорі каруселі — кіно, нижче ігри, ще нижче музика (лише розділи, увімкнені людині).
 * Трек — одразу грає, гра й фільм — відкривають сторінку в програмі.
 */
export function HomeCarousels() {
    const { sections } = useMe();
    const nav = useNav();
    const on = (s: string): boolean => sections === null || sections.includes(s);
    const movies = useLive<{ popular: Movie[]; movies: { data: Movie[] } }>(on('cinema') ? '/api/v1/cinema' : null, 300_000);
    const games = useLive<{ games: { data: Game[] } }>(on('games') ? '/api/v1/games?sort=popular' : null, 300_000);
    const music = useLive<{ charts: { week: Track[] } }>(on('music') ? '/api/v1/site/music/charts' : null, 300_000);
    const filmList = movies.data ? (movies.data.popular.length ? movies.data.popular : movies.data.movies.data) : [];
    const tracks = music.data?.charts.week ?? [];
    return (
        <div className="mb-4 space-y-4">
            {filmList.length > 0 && (
                <Row title="Кіно, серіали й аніме" icon={<Clapperboard size={17} />} more={hasPage('/cinema') ? () => nav.go('/cinema') : undefined}>
                    {filmList.slice(0, 20).map((m) => (
                        <button key={m.id} type="button" onClick={() => hasPage(`/cinema/${m.slug}`) && nav.go(`/cinema/${m.slug}`)} className="group w-[132px] shrink-0 snap-start text-left">
                            <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10 transition group-hover:-translate-y-0.5 group-hover:ring-neon-cyan/40">
                                <Cover src={m.poster} className="aspect-[2/3] w-full" fallback={<Clapperboard size={24} />} />
                                {m.rating ? (
                                    <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur">
                                        <Star size={10} fill="currentColor" /> {m.rating}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1.5 truncate text-[13px] font-medium">{m.title}</p>
                            <p className="truncate text-[11px] text-white/45">
                                {m.type_label}
                                {m.year ? ` · ${m.year}` : ''}
                            </p>
                        </button>
                    ))}
                </Row>
            )}
            {(games.data?.games.data.length ?? 0) > 0 && (
                <Row title="Ігри" icon={<Gamepad2 size={17} />} more={() => nav.go('/games')}>
                    {games.data!.games.data.slice(0, 20).map((g) => (
                        <button key={g.id} type="button" onClick={() => nav.go(`/games/${g.slug}`)} className="group w-[220px] shrink-0 snap-start text-left">
                            <div className="overflow-hidden rounded-xl ring-1 ring-white/10 transition group-hover:-translate-y-0.5 group-hover:ring-neon-cyan/40">
                                <Cover src={g.cover} className="aspect-[460/215] w-full" fallback={<Gamepad2 size={24} />} />
                            </div>
                            <p className="mt-1.5 truncate text-[13px] font-medium">{g.name}</p>
                            <p className="truncate text-[11px] text-white/45">{g.category_label}</p>
                        </button>
                    ))}
                </Row>
            )}
            {tracks.length > 0 && (
                <Row title="Музика · топ тижня" icon={<Music size={17} />} more={() => nav.go('/music')}>
                    {tracks.slice(0, 20).map((t, i) => (
                        <button key={t.key} type="button" onClick={() => player.play(tracks, i)} className="group w-[150px] shrink-0 snap-start text-left">
                            <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10 transition group-hover:-translate-y-0.5 group-hover:ring-neon-violet/50">
                                <Cover src={t.cover_url} className="aspect-square w-full" fallback={<Music size={26} />} />
                                <span className="absolute right-2 bottom-2 grid h-9 w-9 translate-y-1 place-items-center rounded-full bg-white text-black opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
                                    <Play size={15} fill="currentColor" className="ml-0.5" />
                                </span>
                                <span className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 text-[11px] font-bold backdrop-blur">#{i + 1}</span>
                            </div>
                            <p className="mt-1.5 truncate text-[13px] font-medium">{t.title}</p>
                            <p className="truncate text-[11px] text-white/45">{t.artist}</p>
                        </button>
                    ))}
                </Row>
            )}
        </div>
    );
}
