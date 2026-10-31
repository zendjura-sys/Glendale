import { Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RowSkeleton } from '@/components/gc/skeletons';
import { Widget } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

export type AchievementGame = {
    app_id: string;
    game: string | null;
    unlocked: number;
    total: number;
    hours?: number;
    rarest: {
        name: string;
        description: string | null;
        icon: string | null;
        percent: number;
    }[];
};

/** Прогрес і найрідкісніші відкриті досягнення гри. */
export function AchievementProgress({ data }: { data: AchievementGame }) {
    const percent = Math.round((data.unlocked / Math.max(1, data.total)) * 100);

    return (
        <div>
            <div className="flex items-baseline gap-2 text-sm">
                <span className="truncate font-medium text-white">
                    {data.game}
                </span>
                <span className="ml-auto shrink-0 text-xs text-white/50 tabular-nums">
                    {data.unlocked}/{data.total}
                </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                    className="h-full rounded-full bg-amber-300/80"
                    style={{ width: `${percent}%` }}
                />
            </div>
            {data.rarest.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                    {data.rarest.slice(0, 5).map((a) => (
                        <span
                            key={a.name}
                            title={`${a.name} — ${tr('є у {percent}% гравців', { percent: a.percent })}`}
                            className="relative"
                        >
                            {a.icon ? (
                                <img
                                    src={a.icon}
                                    alt={a.name}
                                    className="size-9 rounded-lg"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.06]">
                                    <Trophy className="size-4 text-amber-300" />
                                </span>
                            )}
                            {a.percent < 10 && (
                                <span className="absolute -right-1 -bottom-1 rounded bg-amber-400 px-1 text-[9px] font-bold text-black">
                                    {a.percent}%
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Віджет профілю «Досягнення Steam» — вантажиться окремо (Steam буває повільним). */
export function SteamAchievements({ username }: { username: string }) {
    const [games, setGames] = useState<AchievementGame[] | null>(null);

    useEffect(() => {
        let alive = true;
        api<{ games: AchievementGame[] }>('GET', `/u/${username}/achievements`)
            .then((data) => alive && setGames(data.games))
            .catch(() => alive && setGames([]));

        return () => {
            alive = false;
        };
    }, [username]);

    if (games !== null && games.length === 0) return null;

    return (
        <Widget title={tr('Досягнення Steam')}>
            <div className="space-y-4 px-1">
                {games === null ? (
                    <>
                        <RowSkeleton avatar="none" />
                        <RowSkeleton avatar="none" />
                    </>
                ) : (
                    games.map((game) => (
                        <AchievementProgress key={game.app_id} data={game} />
                    ))
                )}
            </div>
        </Widget>
    );
}
