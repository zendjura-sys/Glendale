import { router } from '@inertiajs/react';
import { BarChart3, Trophy } from 'lucide-react';
import { FamilyShell } from '@/components/families/family-shell';
import { Empty, Panel, RankBadge, Segmented } from '@/components/families/ui';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyShellProps, LeaderboardRow } from '@/types';
import { tr } from '@/lib/i18n';

type Props = FamilyShellProps & {
    period: 'week' | 'month' | 'all';
    periods: Record<'week' | 'month' | 'all', string>;
    leaderboard: LeaderboardRow[];
    config: {
        bizwar: boolean;
        contracts: boolean;
        investments: boolean;
        events: boolean;
    };
};

const podium = [
    'from-amber-300/30 to-amber-500/10 ring-amber-300/40',
    'from-slate-200/20 to-slate-400/10 ring-slate-200/30',
    'from-orange-400/25 to-orange-700/10 ring-orange-400/30',
];

export default function FamilyRating(props: Props) {
    const { family, me, period, periods, leaderboard, config } = props;
    const top = leaderboard.slice(0, 3);

    return (
        <FamilyShell {...props} title={tr('Рейтинг')}>
            <div className="flex flex-wrap items-center gap-2">
                <Segmented
                    value={period}
                    onChange={(v) =>
                        router.get(
                            `/f/${family.slug}/rating`,
                            { period: v === 'week' ? undefined : v },
                            {
                                preserveScroll: true,
                                preserveState: true,
                                replace: true,
                            },
                        )
                    }
                    options={(Object.keys(periods) as Props['period'][]).map(
                        (k) => ({
                            value: k,
                            label: periods[k],
                        }),
                    )}
                />
                <span className="ml-auto text-xs text-white/40">
                    {tr('Враховується:')}{' '}
                    {[
                        config.bizwar && tr('бізвари'),
                        config.contracts && tr('контракти'),
                        config.investments && tr('інвестиції'),
                        config.events && tr('події'),
                    ]
                        .filter(Boolean)
                        .join(', ')}
                </span>
            </div>

            {leaderboard.length === 0 ? (
                <Panel>
                    <Empty
                        icon={BarChart3}
                        text={tr('За цей період балів ще ніхто не заробив')}
                    />
                </Panel>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {top.map((row, i) => (
                            <div
                                key={row.id}
                                className={cn(
                                    'glass relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-center ring-1',
                                    podium[i],
                                    i === 0 && 'sm:order-2 sm:-mt-2',
                                    i === 1 && 'sm:order-1 sm:mt-4',
                                    i === 2 && 'sm:order-3 sm:mt-6',
                                )}
                            >
                                <Trophy
                                    className={cn(
                                        'mx-auto size-8',
                                        i === 0
                                            ? 'text-amber-300'
                                            : i === 1
                                              ? 'text-slate-200'
                                              : 'text-orange-300',
                                    )}
                                />
                                <div className="mt-2 truncate font-mono text-sm font-semibold text-white">
                                    {row.display}
                                </div>
                                <RankBadge
                                    rank={row.rank}
                                    title={row.rank_title}
                                    className="mt-1"
                                />
                                <div className="mt-3 font-display text-3xl font-bold text-white">
                                    {row.points}
                                </div>
                                <div className="text-xs text-white/45">
                                    {tr('балів ·')} {uah(row.earned)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Panel padded={false} className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead className="text-left text-xs tracking-wide text-white/35 uppercase">
                                    <tr className="border-b border-white/[0.06]">
                                        <th className="px-4 py-3 font-medium">
                                            #
                                        </th>
                                        <th className="py-3 font-medium">
                                            {tr('Учасник')}
                                        </th>
                                        <th className="py-3 text-center font-medium">
                                            {tr('Бізвари')}
                                        </th>
                                        <th className="py-3 text-center font-medium">
                                            {tr('Контракти')}
                                        </th>
                                        <th className="py-3 text-right font-medium">
                                            {tr('Інвестиції')}
                                        </th>
                                        <th className="py-3 text-center font-medium">
                                            {tr('Події')}
                                        </th>
                                        <th className="py-3 text-right font-medium">
                                            {tr('Заробіток')}
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            {tr('Бали')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {leaderboard.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={cn(
                                                row.id === me.id &&
                                                    'bg-gc-indigo/10',
                                            )}
                                        >
                                            <td className="px-4 py-2.5 text-white/45">
                                                {row.place}
                                            </td>
                                            <td className="py-2.5">
                                                <div className="font-mono text-xs text-white">
                                                    {row.display}
                                                </div>
                                                <div className="text-xs text-white/35">
                                                    {row.rank_title}
                                                </div>
                                            </td>
                                            <td className="py-2.5 text-center text-white/70">
                                                <span className="text-emerald-300">
                                                    {row.bizwar_wins}
                                                </span>
                                                <span className="text-white/25">
                                                    {' '}
                                                    /{' '}
                                                </span>
                                                <span className="text-rose-300">
                                                    {row.bizwar_losses}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-center text-white/70">
                                                {row.contracts}
                                            </td>
                                            <td className="py-2.5 text-right text-white/70">
                                                {uah(row.invested)}
                                            </td>
                                            <td className="py-2.5 text-center text-white/70">
                                                {row.events}
                                            </td>
                                            <td className="py-2.5 text-right text-emerald-300">
                                                {uah(row.earned)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-display font-bold text-amber-200">
                                                {row.points}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </>
            )}
        </FamilyShell>
    );
}
