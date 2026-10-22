import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { tr } from '@/lib/i18n';

type Side = {
    slug: string;
    name: string;
    platform_label: string;
    multiplayer_label: string;
    language_label: string;
    players_online: number | null;
    players_max: number | null;
    players_peak: number | null;
    discord_online: number | null;
    discord_members: number | null;
    families_count: number;
    rating: number | null;
    reviews: number;
};

type Props = {
    left: Side | null;
    right: Side | null;
    servers: { slug: string; name: string }[];
};

const rows: { key: keyof Side; label: string }[] = [
    { key: 'platform_label', label: 'Платформа' },
    { key: 'multiplayer_label', label: 'Клієнт' },
    { key: 'language_label', label: 'Мова' },
    { key: 'players_online', label: 'Зараз онлайн' },
    { key: 'players_max', label: 'Максимум' },
    { key: 'players_peak', label: 'Пік' },
    { key: 'discord_online', label: 'Discord онлайн' },
    { key: 'discord_members', label: 'Discord учасники' },
    { key: 'families_count', label: 'Сім’ї' },
    { key: 'rating', label: 'Оцінка' },
    { key: 'reviews', label: 'Відгуки' },
];

function cell(side: Side | null, key: keyof Side): string {
    if (!side) return '—';
    const value = side[key];
    if (value === null || value === '') return '—';
    if (key === 'rating') return `${value} ★`;

    return String(value);
}

export default function CompareServers({ left, right, servers }: Props) {
    const pick = (side: 'a' | 'b', slug: string) => {
        const params = new URLSearchParams();
        const current = {
            a: left?.slug ?? '',
            b: right?.slug ?? '',
            [side]: slug,
        };
        if (current.a) params.set('a', current.a);
        if (current.b) params.set('b', current.b);
        router.get(`/servers/compare?${params.toString()}`);
    };

    return (
        <>
            <Head title={tr('Порівняння серверів')} />
            <div className="space-y-5">
                <Link
                    href="/servers"
                    className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> {tr('Усі сервери')}
                </Link>
                <h1 className="font-display text-3xl font-bold text-white">
                    {tr('Порівняння серверів')}
                </h1>
                <div className="grid gap-4 sm:grid-cols-2">
                    {(['a', 'b'] as const).map((side) => {
                        const chosen = side === 'a' ? left : right;

                        return (
                            <label key={side} className="text-sm text-white/70">
                                {side === 'a' ? tr('Перший') : tr('Другий')}
                                <select
                                    value={chosen?.slug ?? ''}
                                    onChange={(event) =>
                                        pick(side, event.target.value)
                                    }
                                    className="input-glass mt-1.5 h-11 w-full rounded-xl px-3 text-sm text-white"
                                >
                                    <option value="">
                                        {tr('Оберіть сервер')}
                                    </option>
                                    {servers.map((server) => (
                                        <option
                                            key={server.slug}
                                            value={server.slug}
                                        >
                                            {server.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        );
                    })}
                </div>
                <section className="glass overflow-hidden rounded-2xl">
                    <div className="grid grid-cols-[8rem_1fr_1fr] gap-2 border-b border-white/10 px-4 py-3 text-sm font-semibold text-white sm:grid-cols-[12rem_1fr_1fr]">
                        <span />
                        <span>{left?.name ?? '—'}</span>
                        <span>{right?.name ?? '—'}</span>
                    </div>
                    {rows.map((row) => (
                        <div
                            key={row.key}
                            className="grid grid-cols-[8rem_1fr_1fr] gap-2 px-4 py-2.5 text-sm text-white/75 sm:grid-cols-[12rem_1fr_1fr]"
                        >
                            <span className="text-white/45">
                                {tr(row.label)}
                            </span>
                            <span>{cell(left, row.key)}</span>
                            <span>{cell(right, row.key)}</span>
                        </div>
                    ))}
                </section>
            </div>
        </>
    );
}
