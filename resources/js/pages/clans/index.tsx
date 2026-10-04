import { Head, Link, router } from '@inertiajs/react';
import { Plus, Search, Swords, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import type { ClanCard, GameCard, Paginated } from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    mine: ClanCard[];
    clans: Paginated<ClanCard>;
    filters: {
        q: string;
        type: 'clan' | 'guild' | null;
        game: GameCard | null;
    };
    types: Record<'clan' | 'guild', string>;
};

export function ClanLogo({
    clan,
    size = 'md',
}: {
    clan: Pick<ClanCard, 'logo_url' | 'tag'>;
    size?: 'sm' | 'md' | 'lg';
}) {
    const box = {
        sm: 'size-9 text-[11px] rounded-lg',
        md: 'size-12 text-xs rounded-xl',
        lg: 'size-20 text-lg rounded-2xl',
    }[size];

    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#4F8BFF]/40 to-[#8B6BFF]/40 font-bold text-white',
                box,
            )}
        >
            {clan.logo_url ? (
                <img
                    src={clan.logo_url}
                    alt=""
                    className="size-full object-cover"
                />
            ) : (
                clan.tag
            )}
        </span>
    );
}

export function ClanRow({ clan }: { clan: ClanCard }) {
    return (
        <Link
            href={`/clans/${clan.slug}`}
            className="glass flex items-center gap-3 rounded-2xl p-3 transition hover:border-white/15"
        >
            <ClanLogo clan={clan} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                    {clan.display_name}
                </span>
                <span className="block truncate text-xs text-white/50">
                    {clan.game?.name ?? '—'}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" /> {clan.members_count}
                    </span>
                    {clan.pending ? (
                        <span className="text-amber-300">
                            {tr('заявка на розгляді')}
                        </span>
                    ) : (
                        clan.is_recruiting && (
                            <span className="text-emerald-300">
                                {tr('набір відкрито')}
                            </span>
                        )
                    )}
                </span>
            </span>
        </Link>
    );
}

/** Клани й гільдії: мої, пошук за назвою, типом і грою. */
export default function ClansIndex({ mine, clans, filters, types }: Props) {
    const [q, setQ] = useState(filters.q);

    const visit = (patch: Record<string, string | null>) =>
        router.get(
            '/clans',
            Object.fromEntries(
                Object.entries({
                    q,
                    type: filters.type,
                    game: filters.game?.slug ?? null,
                    ...patch,
                }).filter(([, v]) => v !== null && v !== ''),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <>
            <Head title={tr('Клани й гільдії')} />
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <h1 className="flex flex-1 items-center gap-2 font-display text-2xl font-semibold text-white">
                    <Swords className="size-6 text-[#a5b4fc]" />{' '}
                    {tr('Клани й гільдії')}
                </h1>
                <Link
                    href="/clans/create"
                    className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                >
                    <Plus className="size-4" /> {tr('Створити')}
                </Link>
            </div>

            {mine.length > 0 && (
                <section className="mb-5">
                    <h2 className="mb-2 text-sm font-semibold text-white/70">
                        {tr('Мої')}
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {mine.map((c) => (
                            <ClanRow key={c.id} clan={c} />
                        ))}
                    </div>
                </section>
            )}

            <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <label className="input-glass flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/35" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Назва або тег')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>
                <div className="flex rounded-xl bg-white/[0.04] p-1 text-sm">
                    {([null, 'clan', 'guild'] as const).map((t) => (
                        <button
                            key={t ?? 'all'}
                            type="button"
                            onClick={() => visit({ type: t })}
                            className={cn(
                                'rounded-lg px-3 py-1.5 transition',
                                filters.type === t
                                    ? 'bg-gradient-brand text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {t ? types[t] : tr('Усі')}
                        </button>
                    ))}
                </div>
                {filters.game && (
                    <button
                        type="button"
                        onClick={() => visit({ game: null })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80"
                    >
                        {filters.game.name} <X className="size-4" />
                    </button>
                )}
            </div>

            {clans.data.length === 0 ? (
                <EmptyState
                    icon={Swords}
                    title={tr('Кланів не знайдено')}
                    text={tr('Створіть свій — оберіть гру й потрібні розділи.')}
                />
            ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {clans.data.map((c) => (
                        <ClanRow key={c.id} clan={c} />
                    ))}
                </div>
            )}
            <Pagination data={clans} />
        </>
    );
}
