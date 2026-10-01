import { cn } from '@/lib/utils';
import type { NowPlaying } from '@/types';
import { MusicCard } from './music-card';
import { Equalizer, SpotifyLogo } from './track-cover';

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
            <div className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-[#6d5dfc]/25 blur-3xl" />
            <h3 className="relative mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold tracking-wider text-white/55 uppercase">
                <Equalizer paused={!track.is_playing} />
                {track.is_playing ? 'Зараз грає' : 'Нещодавно слухав(ла)'}
                {track.via === 'spotify' && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[#1ed760] normal-case">
                        <SpotifyLogo className="size-3.5" /> через Spotify
                    </span>
                )}
            </h3>
            <MusicCard track={track} compact className="relative" />
        </section>
    );
}
