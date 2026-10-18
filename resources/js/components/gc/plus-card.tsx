import { Link } from '@inertiajs/react';
import { ChevronRight, CreditCard, Sparkles } from 'lucide-react';
import { PlusBadge } from '@/components/gc/plus';
import { usePrice } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const PERKS = (): string[] => [
    tr('Значок і колір ніку'),
    tr('GIF-аватар і рамка'),
    tr('Більше місця'),
];

/**
 * Картка GameCon+ у меню: статус (до коли, скільки днів лишилось) або коротко про бонуси,
 * кнопка оформлення й оплата. Плоска: скло, тонка рамка, один акцент — без світіння й 3D.
 */
export function PlusMenuCard({
    until,
    className,
}: {
    until: string | null | undefined;
    className?: string;
}) {
    const monthly = usePrice('plus_month');
    const ends = until ? new Date(until).getTime() : 0;
    const active = ends > Date.now();
    const daysLeft = active ? Math.ceil((ends - Date.now()) / 86_400_000) : 0;
    const progress = Math.min(1, daysLeft / 30);

    return (
        <section
            className={cn(
                'relative overflow-hidden rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.16] via-violet-500/[0.07] to-transparent p-4',
                className,
            )}
        >
            <Sparkles
                aria-hidden
                className="pointer-events-none absolute -top-3 -right-3 size-24 text-indigo-300/[0.07]"
            />

            <div className="relative flex items-center gap-2.5">
                <PlusBadge className="size-7 rounded-lg [&_svg]:size-4" />
                <span className="font-display text-base font-bold text-white">
                    GameCon+
                </span>
                <span
                    className={cn(
                        'ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        active
                            ? 'bg-emerald-400/15 text-emerald-200'
                            : 'bg-white/[0.07] text-white/60',
                    )}
                >
                    {active ? tr('Активний') : tr('Не активний')}
                </span>
            </div>

            {active ? (
                <div className="relative mt-3">
                    <p className="text-sm text-white/80">
                        {tr('До {date}', { date: formatDate(until!) })}
                        <span className="text-white/45">
                            {' · '}
                            {tr('ще {n} дн.', { n: daysLeft })}
                        </span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                            className="h-full rounded-full bg-[var(--btn-primary,#6366f1)] transition-[width] duration-700 ease-out"
                            style={{ width: `${Math.max(4, progress * 100)}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="relative mt-3">
                    <ul className="flex flex-wrap gap-1.5">
                        {PERKS().map((perk) => (
                            <li
                                key={perk}
                                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/75"
                            >
                                {perk}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2.5 text-sm text-white/60">
                        {tr('від {price} ₴ на місяць', {
                            price: monthly,
                        })}
                    </p>
                </div>
            )}

            <div className="relative mt-4 flex gap-2">
                <Link
                    href="/plus"
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--btn-primary,#6366f1)] px-3 text-sm font-semibold text-white transition hover:opacity-90 active:opacity-80"
                >
                    {active ? tr('Продовжити') : tr('Оформити')}
                    <ChevronRight className="size-4" />
                </Link>
                <Link
                    href="/plus/billing"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 active:bg-white/[0.12]"
                    aria-label={tr('Оплата й підписки')}
                >
                    <CreditCard className="size-4 text-white/60" />
                    {tr('Оплата')}
                </Link>
            </div>
        </section>
    );
}
