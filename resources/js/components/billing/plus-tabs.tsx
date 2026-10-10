import { Link } from '@inertiajs/react';
import { Wallet } from 'lucide-react';
import { PlusBadge } from '@/components/gc/plus';
import { money } from '@/lib/billing';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Вкладки розділу GameCon+: тарифи й рахунок (білінг живе всередині GameCon+, окремого пункту меню немає). */
export function PlusTabs({
    current,
    balance,
}: {
    current: 'plus' | 'billing';
    balance: number;
}) {
    const tab =
        'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition sm:flex-none';

    return (
        <nav className="glass flex gap-1 rounded-2xl p-1" aria-label="GameCon+">
            <Link
                href="/plus"
                className={cn(
                    tab,
                    current === 'plus'
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/60 hover:text-white',
                )}
            >
                <PlusBadge className="size-5 rounded-md [&_svg]:size-3.5" />
                GameCon+
            </Link>
            <Link
                href="/plus/billing"
                className={cn(
                    tab,
                    current === 'billing'
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/60 hover:text-white',
                )}
            >
                <Wallet className="size-4" />
                {tr('Рахунок')}
                <span className="text-xs font-medium text-white/45 tabular-nums">
                    {money(balance)}
                </span>
            </Link>
        </nav>
    );
}
