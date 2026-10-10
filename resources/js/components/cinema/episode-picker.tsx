import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Season = { number: number; episodes: number[] };
export type EpisodePick = { season: number; episode: number };

/** Плеєри, які вміють відкрити конкретну серію за параметрами адреси. */
export function supportsEpisodes(provider: string | undefined): boolean {
    return provider === 'kodik' || provider === 'videoseed';
}

/**
 * Адреса плеєра з однією серією:
 * Kodik — season/episode + only_season/only_episode; Videoseed — video=sXvY&only=true.
 */
export function episodeLink(
    provider: string,
    link: string,
    pick: EpisodePick,
): string {
    try {
        const url = new URL(link);
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
    const current = seasons.find((s) => s.number === season) ?? seasons[0];
    if (!current) return null;

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
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                    >
                        {tr('Усі серії')}
                    </button>
                )}
            </div>
            {!supported && (
                <p className="text-xs text-white/40">
                    {tr(
                        'Цей плеєр показує серії всередині — оберіть Kodik або Videoseed, щоб відкривати серію окремо.',
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
                                    ? 'bg-[var(--btn-primary,#6366f1)] font-semibold text-white'
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
