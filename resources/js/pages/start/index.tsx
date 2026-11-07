import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { GameCard, GtaServerCard } from '@/types';
import { tr } from '@/lib/i18n';

export default function Start({
    games,
    servers,
}: {
    games: GameCard[];
    servers: GtaServerCard[];
}) {
    const [pickedGames, setPickedGames] = useState<number[]>([]);
    const [pickedServers, setPickedServers] = useState<number[]>([]);
    const [sending, setSending] = useState(false);

    const toggle = (
        list: number[],
        id: number,
        set: (value: number[]) => void,
    ) => {
        set(
            list.includes(id)
                ? list.filter((item) => item !== id)
                : list.length >= 8
                  ? list
                  : [...list, id],
        );
    };

    const save = () => {
        setSending(true);
        router.post(
            '/start',
            { games: pickedGames, servers: pickedServers },
            {
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <>
            <Head title={tr('З чого почати')} />
            <div className="mx-auto max-w-3xl space-y-8">
                <div>
                    <h1 className="font-display text-3xl font-semibold text-white">
                        {tr('Обери, у що граєш')}
                    </h1>
                    <p className="mt-2 text-sm text-white/55">
                        {games.length > 0 && servers.length > 0
                            ? tr(
                                  'Ми скажемо, коли друг зайде в цю гру чи на цей сервер.',
                              )
                            : servers.length > 0
                              ? tr('Ми скажемо, коли друг зайде на цей сервер.')
                              : tr('Ми скажемо, коли друг зайде в цю гру.')}
                    </p>
                </div>
                {games.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-white/70">
                            {tr('Ігри')}
                        </h2>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {games.map((game) => (
                                <button
                                    key={game.id}
                                    type="button"
                                    onClick={() =>
                                        toggle(
                                            pickedGames,
                                            game.id,
                                            setPickedGames,
                                        )
                                    }
                                    className={cn(
                                        'rounded-2xl border px-3 py-3 text-left text-sm font-medium text-white transition',
                                        pickedGames.includes(game.id)
                                            ? 'border-gc-lilac-400/60 bg-gc-indigo/20'
                                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                                    )}
                                >
                                    {game.name}
                                </button>
                            ))}
                        </div>
                    </section>
                )}
                {servers.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-white/70">
                            {tr('Сервери')}
                        </h2>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {servers.map((server) => (
                                <button
                                    key={server.id}
                                    type="button"
                                    onClick={() =>
                                        toggle(
                                            pickedServers,
                                            server.id,
                                            setPickedServers,
                                        )
                                    }
                                    className={cn(
                                        'rounded-2xl border px-3 py-3 text-left text-sm font-medium text-white transition',
                                        pickedServers.includes(server.id)
                                            ? 'border-gc-lilac-400/60 bg-gc-indigo/20'
                                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                                    )}
                                >
                                    {server.name}
                                </button>
                            ))}
                        </div>
                    </section>
                )}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={sending}
                        onClick={save}
                        className="btn-glow inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
                    >
                        {tr('Далі')}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.post('/start/skip')}
                        className="text-sm text-white/50 hover:text-white"
                    >
                        {tr('Пропустити')}
                    </button>
                </div>
            </div>
        </>
    );
}
