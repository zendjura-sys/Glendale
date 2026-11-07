import { Head } from '@inertiajs/react';
import { mixTitle } from '@/components/am/cards';
import { SongList } from '@/components/am/song-list';
import { LargeTitle, MixArt, PlayShuffle } from '@/components/am/ui';
import { tr } from '@/lib/i18n';
import { playQueue, shuffled } from '@/lib/player';
import type { LocalTrack, MixCard } from '@/types';

/** Мікс «Створено для тебе» — як плейлист Apple Music: обкладинка-градієнт, «Слухати / Перемішати». */
export default function MusicMix({
    mix,
    tracks,
}: {
    mix: MixCard;
    tracks: LocalTrack[];
}) {
    const { title, subtitle } = mixTitle(mix.key);

    return (
        <>
            <Head title={title} />
            <LargeTitle
                title=""
                back={{ href: '/music', label: tr('Головна') }}
                className="pb-0"
            />
            <div className="px-[var(--am-gutter)] text-center lg:flex lg:items-end lg:gap-8 lg:text-left">
                <div className="mx-auto w-[min(70vw,300px)] lg:mx-0 lg:w-[270px]">
                    <MixArt
                        colors={mix.colors}
                        covers={mix.covers}
                        label={title}
                        className="rounded-[10px] shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)]"
                    />
                </div>
                <div className="mt-4 lg:mt-0">
                    <h1 className="am-title2 lg:text-[30px] lg:leading-9">
                        {title}
                    </h1>
                    <p className="am-subhead text-[var(--am-label2)]">
                        {subtitle}
                    </p>
                    <p className="am-footnote mt-1 text-[var(--am-label3)]">
                        {tr('Оновлюється щопонеділка')}
                    </p>
                    <div className="mt-4 lg:w-[420px]">
                        <PlayShuffle
                            onPlay={() => playQueue(tracks, 0)}
                            onShuffle={() => playQueue(shuffled(tracks), 0)}
                            disabled={!tracks.length}
                        />
                    </div>
                </div>
            </div>
            <SongList
                tracks={tracks}
                className="mt-5"
                extra={(t) => t.album ?? undefined}
            />
        </>
    );
}
