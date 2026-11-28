import { Link } from '@inertiajs/react';
import { IdCard } from 'lucide-react';
import type { RailData } from '@/components/gc/rail-widgets';
import { tr } from '@/lib/i18n';
import { uahShort } from '@/lib/money';
import { cn } from '@/lib/utils';

type Family = NonNullable<NonNullable<RailData['me']>['family']>;

/**
 * RP-досьє персонажа: нік [static], сервер і три плитки — ранг, баланс у сім'ї, догани з ліміту.
 * Показується в картці гравця (ліва колонка) і в меню на телефоні.
 */
export function RpDossier({ family }: { family: Family }) {
    if (family.rank === undefined) return null;
    const warns = family.warns ?? 0;

    return (
        <Link
            href={family.href}
            className="gc-solid-2 mt-3 block rounded-2xl p-3 transition hover:bg-[var(--gc-l3)]"
        >
            <div className="flex items-center gap-2">
                <IdCard className="size-4 shrink-0 text-sky-400" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                    {tr('RP-досьє')}
                </span>
                {family.server && (
                    <span className="max-w-[45%] shrink-0 truncate text-[11px] font-bold text-sky-400">
                        {family.server}
                    </span>
                )}
            </div>
            {family.nickname && (
                <p className="mt-1 truncate font-mono text-xs text-white/60">
                    {family.nickname}
                </p>
            )}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {[
                    {
                        label: tr('Ранг'),
                        value: family.rank_title ?? String(family.rank),
                        tone: 'text-white',
                    },
                    {
                        label: tr('Баланс'),
                        value: uahShort(family.balance ?? 0),
                        tone: 'text-emerald-400',
                    },
                    {
                        label: tr('Догани'),
                        value: `${warns} / ${family.warn_limit ?? 3}`,
                        tone: warns > 0 ? 'text-red-400' : 'text-sky-400',
                    },
                ].map((tile) => (
                    <span
                        key={tile.label}
                        className="flex min-w-0 flex-col items-center rounded-xl bg-[var(--gc-page)] px-1 py-2 text-center"
                    >
                        <span className="text-[11px] text-white/55">
                            {tile.label}
                        </span>
                        <span
                            className={cn(
                                'w-full truncate text-[13px] font-bold tabular-nums',
                                tile.tone,
                            )}
                        >
                            {tile.value}
                        </span>
                    </span>
                ))}
            </div>
        </Link>
    );
}
