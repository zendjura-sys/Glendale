import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { SongList } from '@/components/am/song-list';
import { LargeTitle, PlayShuffle, Segmented } from '@/components/am/ui';
import { tr } from '@/lib/i18n';
import { playQueue, shuffled } from '@/lib/player';
import type { LocalTrack } from '@/types';

/** Чарти: топ-100 тижня по всьому GameCon і топ-50 твоєї країни. */
export default function MusicCharts({
    charts,
}: {
    charts: {
        week: LocalTrack[];
        country: LocalTrack[];
        country_name: string | null;
    };
}) {
    const [tab, setTab] = useState<'week' | 'country'>('week');
    const list = tab === 'week' ? charts.week : charts.country;

    return (
        <>
            <Head title={tr('Чарти')} />
            <LargeTitle
                title={tr('Чарти')}
                back={{ href: '/music/new', label: tr('Нове') }}
            />
            {charts.country_name && (
                <Segmented
                    className="mx-[var(--am-gutter)] mb-3 lg:max-w-md"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'week', label: tr('Топ-100: GameCon') },
                        {
                            value: 'country',
                            label: tr('Топ-50: {country}', {
                                country: charts.country_name,
                            }),
                        },
                    ]}
                />
            )}
            <div className="px-[var(--am-gutter)] pb-3">
                <PlayShuffle
                    onPlay={() => playQueue(list, 0)}
                    onShuffle={() => playQueue(shuffled(list), 0)}
                    disabled={!list.length}
                />
            </div>
            {list.length === 0 ? (
                <p className="am-subhead px-[var(--am-gutter)] pt-6 text-[var(--am-label2)]">
                    {tr(
                        'Чарт з’явиться, коли в країні почнуть слухати музику в GameCon.',
                    )}
                </p>
            ) : (
                <SongList tracks={list} variant="chart" />
            )}
        </>
    );
}
