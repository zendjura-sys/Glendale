import { Clapperboard } from 'lucide-react';
import { Widget } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

export type CinemaStatsData = {
    watched: number;
    watching: number;
    episodes: number;
    hours: number;
    this_year: number;
    avg_rating: number | null;
    genres: { name: string; count: number }[];
};

/** Статистика перегляду (№272): переглянуто, серії, години, жанри й середня оцінка. */
export function CinemaStats({ data }: { data: CinemaStatsData }) {
    const tiles: [string, string][] = [
        [String(data.watched), tr('переглянуто')],
        [String(data.episodes), tr('серій')],
        [`≈${data.hours}`, tr('годин')],
    ];

    return (
        <Widget title={tr('Кіно')} icon={Clapperboard}>
            <div className="grid grid-cols-3 gap-1.5 px-1">
                {tiles.map(([value, label]) => (
                    <div key={label} className="gc-stat-tile">
                        <span className="text-lg font-bold text-[var(--gc-text)] tabular-nums">
                            {value}
                        </span>
                        <span className="text-[11px] text-[var(--gc-text-2)]">
                            {label}
                        </span>
                    </div>
                ))}
            </div>
            <dl className="mt-3 space-y-1 px-1 text-sm">
                {data.watching > 0 && (
                    <div className="flex justify-between gap-2">
                        <dt className="text-[var(--gc-text-2)]">
                            {tr('Дивиться зараз')}
                        </dt>
                        <dd className="text-[var(--gc-text)] tabular-nums">
                            {data.watching}
                        </dd>
                    </div>
                )}
                <div className="flex justify-between gap-2">
                    <dt className="text-[var(--gc-text-2)]">
                        {tr('Цього року')}
                    </dt>
                    <dd className="text-[var(--gc-text)] tabular-nums">
                        {data.this_year}
                    </dd>
                </div>
                {data.avg_rating !== null && (
                    <div className="flex justify-between gap-2">
                        <dt className="text-[var(--gc-text-2)]">
                            {tr('Середня оцінка')}
                        </dt>
                        <dd className="text-[var(--gc-text)] tabular-nums">
                            {data.avg_rating.toLocaleString('uk-UA')} / 10
                        </dd>
                    </div>
                )}
            </dl>
            {data.genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 px-1">
                    {data.genres.map((genre) => (
                        <span key={genre.name} className="gc-genre-chip">
                            {genre.name}
                        </span>
                    ))}
                </div>
            )}
        </Widget>
    );
}
