import { Gamepad2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { GameCard } from '@/types';

/** Вибір гри з каталогу: пошук як у каталозі ігор, обрана гра — плашкою з хрестиком. */
export function GameSearch({
    value,
    onChange,
    placeholder,
}: {
    value: GameCard | null;
    onChange: (game: GameCard | null) => void;
    placeholder?: string;
}) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<GameCard[]>([]);

    useEffect(() => {
        if (q.trim().length < 2) {
            setResults([]);

            return;
        }
        const timer = setTimeout(() => {
            api<{ games: GameCard[] }>(
                'GET',
                `/games/search?q=${encodeURIComponent(q.trim())}`,
            )
                .then((r) => setResults(r.games.slice(0, 6)))
                .catch(() => setResults([]));
        }, 250);

        return () => clearTimeout(timer);
    }, [q]);

    if (value) {
        return (
            <div className="flex h-11 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm text-white">
                <Gamepad2 className="size-4 text-sky-300" />
                <span className="min-w-0 flex-1 truncate">{value.name}</span>
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    aria-label={tr('Прибрати гру')}
                    className="rounded-full p-1 text-white/50 hover:text-white"
                >
                    <X className="size-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder ?? tr('Знайти гру')}
                className="input-glass h-11 w-full rounded-xl pr-3 pl-9 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
            {results.length > 0 && (
                <ul className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground">
                    {results.map((game) => (
                        <li key={game.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(game);
                                    setQ('');
                                    setResults([]);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/[0.08]"
                            >
                                <Gamepad2 className="size-4 text-white/40" />
                                {game.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
