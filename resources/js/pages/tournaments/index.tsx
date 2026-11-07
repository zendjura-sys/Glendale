import { Head, Link } from '@inertiajs/react';
import { Trophy } from 'lucide-react';
import { EmptyState } from '@/components/gc/widget';
import { TournamentRow } from '@/components/tournaments/tournament-ui';
import type { TournamentCard } from '@/components/tournaments/tournament-ui';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    status: 'active' | 'finished';
    tournaments: TournamentCard[];
};

export default function TournamentsIndex({ status, tournaments }: Props) {
    const tabs = [
        ['active', tr('Активні'), '/tournaments'],
        ['finished', tr('Завершені'), '/tournaments?status=finished'],
    ] as const;

    return (
        <>
            <Head title={tr('Турніри')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <header>
                    <h1 className="font-display text-3xl font-bold text-white">
                        {tr('Турніри')}
                    </h1>
                    <p className="mt-1 text-sm text-white/55">
                        {tr(
                            'Сітки на вибування й челенджі серверів. Турнір проводить власник сервера — на сторінці сервера.',
                        )}
                    </p>
                </header>
                <nav className="flex gap-1">
                    {tabs.map(([key, label, href]) => (
                        <Link
                            key={key}
                            href={href}
                            preserveScroll
                            className={cn(
                                'rounded-control px-3.5 py-2 text-sm font-medium transition',
                                status === key
                                    ? 'bg-white/[0.1] text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                {tournaments.length === 0 ? (
                    <EmptyState
                        icon={Trophy}
                        title={
                            status === 'active'
                                ? tr('Зараз турнірів немає')
                                : tr('Завершених турнірів ще немає')
                        }
                        text={tr(
                            'Коли сервер оголосить турнір чи челендж, він з’явиться тут.',
                        )}
                    />
                ) : (
                    <section className="glass divide-y divide-white/[0.06] rounded-xl p-2">
                        {tournaments.map((tournament) => (
                            <TournamentRow
                                key={tournament.id}
                                tournament={tournament}
                            />
                        ))}
                    </section>
                )}
            </div>
        </>
    );
}
