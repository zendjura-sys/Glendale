import { cn } from '@/lib/utils';
import type { NowPlaying } from '@/types';
import { MusicCard } from './music-card';
import { Equalizer, SpotifyLogo } from './track-cover';
import { tr } from '@/lib/i18n';

export function NowPlayingCard({
    track,
    className,
}: {
    track: NowPlaying;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'glass relative overflow-hidden rounded-3xl p-3',
                className,
            )}
        >
            <div className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-gc-indigo/25 blur-3xl" />
            <h3 className="relative mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-white/55">
                <Equalizer paused={!track.is_playing} />
                {track.is_playing
                    ? tr('Зараз грає')
                    : tr('Нещодавно слухав(ла)')}
                {track.via === 'spotify' && (
                    <span className="ml-auto inline-flex items-center gap-1 text-spotify normal-case">
                        <SpotifyLogo className="size-3.5" />{' '}
                        {tr('через Spotify')}
                    </span>
                )}
            </h3>
            <MusicCard track={track} compact className="relative" />
        </section>
    );
}
