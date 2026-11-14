import { Head, Link, router } from '@inertiajs/react';
import { Download, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BACKLOG_META, BACKLOG_STATUSES } from '@/components/games/backlog';
import type { BacklogStatus } from '@/components/games/backlog';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Match = {
    id: number;
    slug: string;
    name: string;
    cover: string | null;
    hours: number;
    recent: boolean;
    suggested: BacklogStatus;
    current: BacklogStatus | null;
};

type Props = {
    connected: boolean;
    matched: Match[];
    unmatched: number;
    total: number;
};

export default function SteamImport({
    connected,
    matched,
    unmatched,
    total,
}: Props) {
    // Обране: гра → стан (ігри, що вже в беклозі, не імпортуємо).
    const [picked, setPicked] = useState<Record<number, BacklogStatus | null>>(
        () =>
            Object.fromEntries(
                matched.map((m) => [m.id, m.current ? null : m.suggested]),
            ),
    );
    const [busy, setBusy] = useState(false);
    const count = useMemo(
        () => Object.values(picked).filter(Boolean).length,
        [picked],
    );

    const submit = () => {
        setBusy(true);
        router.post(
            '/games/steam-import',
            {
                games: Object.fromEntries(
                    Object.entries(picked).filter(([, v]) => v),
                ),
            },
            { onFinish: () => setBusy(false) },
        );
    };

    return (
        <>
            <Head title={tr('Імпорт бібліотеки Steam')} />
            <div className="mx-auto max-w-4xl space-y-5">
                <section className="gc-solid rounded-2xl p-5">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <Download className="size-6 text-sky-400" />
                        {tr('Імпорт бібліотеки Steam')}
                    </h1>
                    <p className="mt-1 text-sm text-white/60">
                        {tr(
                            'Ігри з вашого Steam, які є в каталозі GameCon, — одразу в беклог. Стан підказуємо за годинами: грали останні два тижні — «Граю», є години — «Пройшов», без годин — «Хочу». Ігри, що вже в беклозі, не змінюємо.',
                        )}
                    </p>
                    {connected && (
                        <p className="mt-2 text-sm text-white/75">
                            {tr(
                                'У Steam: {total} ігор · знайдено в каталозі: {n} · поки немає в каталозі: {u}',
                                { total, n: matched.length, u: unmatched },
                            )}
                        </p>
                    )}
                </section>

                {!connected ? (
                    <section className="gc-solid space-y-3 rounded-2xl p-5 text-sm text-white/70">
                        <p>
                            {tr(
                                'Підключіть Steam у налаштуваннях (і зробіть бібліотеку відкритою в приватності Steam), щоб імпортувати ігри.',
                            )}
                        </p>
                        <Button asChild variant="secondary">
                            <Link href="/me/playing">
                                <Link2 className="size-4" />
                                {tr('Підключити Steam')}
                            </Link>
                        </Button>
                    </section>
                ) : matched.length === 0 ? (
                    <p className="text-sm text-white/55">
                        {tr(
                            'Жодної гри з вашої бібліотеки ще немає в каталозі.',
                        )}
                    </p>
                ) : (
                    <>
                        <ul className="space-y-2">
                            {matched.map((m) => (
                                <li
                                    key={m.id}
                                    className={cn(
                                        'gc-solid flex flex-wrap items-center gap-3 rounded-xl p-2.5',
                                        m.current && 'opacity-60',
                                    )}
                                >
                                    {m.cover ? (
                                        <img
                                            src={m.cover}
                                            alt=""
                                            className="h-12 w-24 shrink-0 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <span className="h-12 w-24 shrink-0 rounded-lg bg-white/10" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-white">
                                            {m.name}
                                        </div>
                                        <div className="text-xs text-white/50">
                                            {tr('{h} год у Steam', {
                                                h: m.hours,
                                            })}
                                            {m.recent &&
                                                ` · ${tr('грали нещодавно')}`}
                                            {m.current &&
                                                ` · ${tr('вже в беклозі: {s}', { s: BACKLOG_META[m.current].label() })}`}
                                        </div>
                                    </div>
                                    {!m.current && (
                                        <div className="flex flex-wrap gap-1">
                                            {BACKLOG_STATUSES.map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() =>
                                                        setPicked((p) => ({
                                                            ...p,
                                                            [m.id]:
                                                                p[m.id] === s
                                                                    ? null
                                                                    : s,
                                                        }))
                                                    }
                                                    className={cn(
                                                        'rounded-lg px-2 py-1 text-xs',
                                                        picked[m.id] === s
                                                            ? 'bg-primary text-white'
                                                            : 'bg-white/5 text-white/60',
                                                    )}
                                                >
                                                    {BACKLOG_META[s].label()}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <div className="sticky bottom-4 flex justify-end">
                            <Button
                                disabled={count === 0 || busy}
                                onClick={submit}
                            >
                                {tr('Додати в беклог ({n})', { n: count })}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
