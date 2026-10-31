import { router } from '@inertiajs/react';
import { Gamepad2, Loader2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { GameCard } from '@/types';

export type GameThemeValue = { game: GameCard; colors: string[] | null } | null;

/**
 * Тема профілю за улюбленою грою: шапка й акценти сторінки — кольорами обкладинки.
 * Пошук — той самий, що в каталозі ігор.
 */
export function GameThemePicker({ value }: { value: GameThemeValue }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<GameCard[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const save = (gameId: number | null) => {
        setBusy(true);
        setError(null);
        router.put(
            '/settings/game-theme',
            { game_id: gameId },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setQ('');
                    setResults([]);
                },
                onError: (e) =>
                    setError(e.game_id ?? tr('Не вдалося зберегти.')),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <div className="space-y-3 px-4 py-3">
            {value && (
                <div className="flex items-center gap-3 rounded-control bg-white/[0.04] p-2.5">
                    {value.game.cover ? (
                        <img
                            src={value.game.cover}
                            alt=""
                            className="size-11 shrink-0 rounded-lg object-cover"
                        />
                    ) : (
                        <Gamepad2 className="size-6 shrink-0 text-white/50" />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold break-words text-white">
                            {value.game.name}
                        </p>
                        {value.colors && (
                            <div className="mt-1 flex gap-1">
                                {value.colors.map((c) => (
                                    <span
                                        key={c}
                                        className="size-4 rounded-full ring-1 ring-white/20"
                                        style={{ background: c }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => save(null)}
                        className="rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Прибрати тему')}
                        title={tr('Прибрати тему')}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}
            <label className="input-glass flex h-11 items-center gap-2 rounded-control px-3">
                {busy ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-white/40 motion-reduce:animate-none" />
                ) : (
                    <Search className="size-4 shrink-0 text-white/35" />
                )}
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={
                        value ? tr('Змінити гру') : tr('Знайдіть улюблену гру')
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
            </label>
            {results.length > 0 && (
                <div className="grid gap-1">
                    {results.map((game) => (
                        <button
                            key={game.id}
                            type="button"
                            disabled={busy}
                            onClick={() => save(game.id)}
                            className="flex items-center gap-3 rounded-control px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                        >
                            {game.cover ? (
                                <img
                                    src={game.cover}
                                    alt=""
                                    className="size-9 shrink-0 rounded-md object-cover"
                                />
                            ) : (
                                <Gamepad2 className="size-5 shrink-0 text-white/50" />
                            )}
                            <span className="min-w-0 flex-1 text-sm break-words text-white/85">
                                {game.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
    );
}
