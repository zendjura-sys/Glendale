import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Season = { number: number; episodes: number[] };
export type EpisodePick = { season: number; episode: number };

/** Плеєри, які вміють відкрити конкретну серію за параметрами адреси. */
export function supportsEpisodes(provider: string | undefined): boolean {
    return provider === 'kodik' || provider === 'videoseed';
}

/**
 * Адреса плеєра без власних перемикачів: сезони, серії й озвучки обираються на сайті.
 * Kodik — hide_selectors + translations=false (лише коли серію обрано на сайті або це фільм —
 * інакше серіал без списку серій лишився б без вибору серії);
 * з серією — season/episode + only_season/only_episode.
 * Videoseed — video=sXvY&only=true (одна серія без перемикачів сезонів і серій).
 */
export function episodeLink(
    provider: string,
    link: string,
    pick: EpisodePick | null,
    bare = pick !== null,
): string {
    try {
        const url = new URL(link);
        if (provider === 'kodik' && bare) {
            url.searchParams.set('hide_selectors', 'true');
            url.searchParams.set('translations', 'false');
        }
        if (!pick) return url.toString();
        if (provider === 'kodik') {
            url.searchParams.set('season', String(pick.season));
            url.searchParams.set('episode', String(pick.episode));
            url.searchParams.set('only_season', 'true');
            url.searchParams.set('only_episode', 'true');
        } else if (provider === 'videoseed') {
            url.searchParams.set('video', `s${pick.season}v${pick.episode}`);
            url.searchParams.set('only', 'true');
        }

        return url.toString();
    } catch {
        return link;
    }
}

/** Усі серії по порядку (для «Попередня / Наступна»). */
export function episodeList(seasons: Season[]): EpisodePick[] {
    return seasons.flatMap((s) =>
        s.episodes.map((episode) => ({ season: s.number, episode })),
    );
}

/** З якої серії почати: наступна після останньої переглянутої, інакше перша. */
export function firstPick(
    seasons: Season[],
    watched: string[] = [],
): EpisodePick | null {
    const all = episodeList(seasons);
    let last = -1;
    all.forEach((p, i) => {
        if (watched.includes(`${p.season}:${p.episode}`)) last = i;
    });

    return all[Math.min(last + 1, all.length - 1)] ?? null;
}

/** Сезони й серії під плеєром: вибір серії відкриває її окремо в поточному плеєрі. */
export function EpisodePicker({
    seasons,
    value,
    onChange,
    supported,
    watched = [],
}: {
    seasons: Season[];
    value: EpisodePick | null;
    onChange: (pick: EpisodePick | null) => void;
    supported: boolean;
    watched?: string[];
}) {
    const [season, setSeason] = useState(
        value?.season ?? seasons[0]?.number ?? 1,
    );
    // Перехід «Наступна» в інший сезон перемикає й вкладку сезону.
    useEffect(() => {
        if (value) setSeason(value.season);
    }, [value]);
    const current = seasons.find((s) => s.number === season) ?? seasons[0];
    if (!current) return null;
    const all = episodeList(seasons);
    const index = value
        ? all.findIndex(
              (p) => p.season === value.season && p.episode === value.episode,
          )
        : -1;
    const prev = index > 0 ? all[index - 1] : null;
    const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;
    const step =
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-30';

    return (
        <div className="space-y-3 border-t border-white/[0.06] p-3 sm:p-4">
            <div className="flex items-center gap-2">
                <div className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    {seasons.length > 1 &&
                        seasons.map((s) => (
                            <button
                                key={s.number}
                                type="button"
                                onClick={() => setSeason(s.number)}
                                className={cn(
                                    'shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition',
                                    s.number === current.number
                                        ? 'nav-active text-white'
                                        : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                                )}
                            >
                                {tr('{n} сезон', { n: s.number })}
                            </button>
                        ))}
                    {seasons.length === 1 && (
                        <span className="text-sm font-semibold text-white/70">
                            {tr('Серії')} · {current.episodes.length}
                        </span>
                    )}
                </div>
                {supported && value && (
                    <>
                        <button
                            type="button"
                            disabled={!prev}
                            onClick={() => prev && onChange(prev)}
                            className={step}
                            aria-label={tr('Попередня серія')}
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <span className="shrink-0 text-xs text-white/55 tabular-nums">
                            {seasons.length > 1
                                ? tr('{s} сезон · {e} серія', {
                                      s: value.season,
                                      e: value.episode,
                                  })
                                : tr('{n} серія', { n: value.episode })}
                        </span>
                        <button
                            type="button"
                            disabled={!next}
                            onClick={() => next && onChange(next)}
                            className={step}
                        >
                            {tr('Наступна')}
                            <ChevronRight className="size-4" />
                        </button>
                    </>
                )}
            </div>
            {!supported && (
                <p className="text-xs text-white/40">
                    {tr(
                        'Цей плеєр показує серії всередині — оберіть Плеєр 1 або Плеєр 2, щоб відкривати серію окремо.',
                    )}
                </p>
            )}
            <div className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-10">
                {current.episodes.map((episode) => {
                    const active =
                        value?.season === current.number &&
                        value.episode === episode;
                    const seen = watched.includes(
                        `${current.number}:${episode}`,
                    );

                    return (
                        <button
                            key={episode}
                            type="button"
                            disabled={!supported}
                            onClick={() =>
                                onChange({ season: current.number, episode })
                            }
                            title={tr('{n} серія', { n: episode })}
                            className={cn(
                                'h-9 rounded-lg text-sm tabular-nums transition disabled:opacity-40',
                                active
                                    ? 'bg-primary font-semibold text-white'
                                    : seen
                                      ? 'bg-white/[0.04] text-white/40 hover:bg-white/10'
                                      : 'bg-white/[0.06] text-white/80 hover:bg-white/10',
                            )}
                        >
                            {episode}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
