import { Head, Link, router } from '@inertiajs/react';
import { BellRing, ExternalLink, Newspaper, Wrench } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Item = {
    id: number;
    title: string;
    url: string;
    excerpt: string | null;
    is_patch: boolean;
    published_at: string;
    game: { id: number; slug: string; name: string; cover: string | null };
};

type Props = {
    items: Item[];
    next: number | null;
    games: number;
    mode: 'playing' | 'library' | 'off';
    patches: boolean;
};

const MODES = [
    ['playing', 'Лише ігри «Граю»'],
    ['library', 'Уся бібліотека'],
    ['off', 'Не надсилати'],
] as const;

/** Новини й патчі ігор з моєї бібліотеки (Steam-імпорт, «Хочу/Граю/Пройдено») і підписок. */
export default function GameNews({ items, next, games, mode, patches }: Props) {
    const [list, setList] = useState(items);
    const [cursor, setCursor] = useState(next);
    const [loading, setLoading] = useState(false);

    const more = () => {
        if (!cursor) return;
        setLoading(true);
        void api<{ items: Item[]; next: number | null }>(
            'GET',
            `/games/news?before=${cursor}${patches ? '&patches=1' : ''}`,
        )
            .then((d) => {
                setList((l) => [...l, ...d.items]);
                setCursor(d.next);
            })
            .finally(() => setLoading(false));
    };

    return (
        <>
            <Head title={tr('Новини моїх ігор')} />
            <div className="mx-auto max-w-3xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Новини моїх ігор')}
                    </h1>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Патчі й анонси розробників у Steam для {n} ігор з вашої бібліотеки й підписок.',
                            { n: games },
                        )}
                    </p>
                </header>

                <div className="gc-solid flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                    <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                        {[
                            [false, 'Усе'],
                            [true, 'Лише патчі'],
                        ].map(([value, label]) => (
                            <button
                                key={String(value)}
                                type="button"
                                onClick={() =>
                                    router.get(
                                        '/games/news',
                                        value ? { patches: 1 } : {},
                                        { preserveScroll: true },
                                    )
                                }
                                className={cn(
                                    'rounded-lg px-3 py-1.5 font-medium transition',
                                    patches === value
                                        ? 'bg-primary text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tr(label as string)}
                            </button>
                        ))}
                    </div>
                    <label className="ml-auto flex items-center gap-2 text-sm text-white/65">
                        <BellRing className="size-4" />
                        {tr('Сповіщати про патчі')}
                        <select
                            value={mode}
                            onChange={(e) =>
                                router.put(
                                    '/games/news/prefs',
                                    { mode: e.target.value },
                                    { preserveScroll: true },
                                )
                            }
                            className="input-glass rounded-lg px-2 py-1 text-sm text-white"
                        >
                            {MODES.map(([key, label]) => (
                                <option key={key} value={key}>
                                    {tr(label)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {list.length === 0 ? (
                    <EmptyState
                        icon={Newspaper}
                        title={tr('Новин поки немає')}
                        text={tr(
                            'Імпортуйте бібліотеку Steam або додайте ігри в «Хочу / Граю», щоб бачити їхні патчі.',
                        )}
                    />
                ) : (
                    <ul className="grid gap-2">
                        {list.map((n) => (
                            <li
                                key={n.id}
                                className="gc-solid flex gap-3 rounded-2xl p-3"
                            >
                                <Link
                                    href={`/games/${n.game.slug}`}
                                    className="size-14 shrink-0 overflow-hidden rounded-xl bg-white/5"
                                >
                                    {n.game.cover && (
                                        <img
                                            src={n.game.cover}
                                            alt=""
                                            loading="lazy"
                                            className="size-full object-cover"
                                        />
                                    )}
                                </Link>
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                                        <Link
                                            href={`/games/${n.game.slug}`}
                                            className="font-semibold text-white/75 hover:underline"
                                        >
                                            {n.game.name}
                                        </Link>
                                        {n.is_patch && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                                                <Wrench className="size-3" />
                                                {tr('Патч')}
                                            </span>
                                        )}
                                        {timeAgo(n.published_at)}
                                    </p>
                                    <a
                                        href={n.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-0.5 flex items-start gap-1 text-sm font-semibold text-white hover:underline"
                                    >
                                        {n.title}
                                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-white/40" />
                                    </a>
                                    {n.excerpt && (
                                        <p className="mt-1 line-clamp-2 text-sm text-white/60">
                                            {n.excerpt}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                {cursor && (
                    <button
                        type="button"
                        onClick={more}
                        disabled={loading}
                        className="gc-solid-2 w-full rounded-xl py-2.5 text-sm font-medium text-white/75 hover:text-white disabled:opacity-50"
                    >
                        {loading ? tr('Завантаження…') : tr('Показати ще')}
                    </button>
                )}
            </div>
        </>
    );
}
