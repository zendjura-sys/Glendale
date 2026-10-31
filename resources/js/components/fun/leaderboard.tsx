import { Link } from '@inertiajs/react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type TopRow = { user: UserCard; score: number; total: number };

/** Найкращі за сьогодні — для вікторини дня й «Вгадай пісню». */
export function Leaderboard({ rows }: { rows: TopRow[] }) {
    return (
        <section className="glass rounded-2xl p-4">
            <h2 className="mb-2 text-sm font-semibold text-white">
                {tr('Найкращі сьогодні')}
            </h2>
            {rows.length === 0 ? (
                <p className="text-sm text-white/45">
                    {tr('Ще ніхто не зіграв — будьте першими.')}
                </p>
            ) : (
                <ol className="space-y-1">
                    {rows.map((row, i) => (
                        <li key={row.user.id}>
                            <Link
                                href={`/${row.user.username}`}
                                className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.05]"
                            >
                                <span className="w-5 text-right text-xs text-white/40 tabular-nums">
                                    {i + 1}
                                </span>
                                <UserAvatar
                                    user={row.user}
                                    size="sm"
                                    showOnline={false}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                                    {row.user.name}
                                </span>
                                <span className="text-sm font-semibold text-white tabular-nums">
                                    {row.score}/{row.total}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
