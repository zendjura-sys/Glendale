import { EyeOff, Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import type { EpisodePick } from '@/components/cinema/episode-picker';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Talk = {
    avg: number | null;
    votes: number;
    mine: number | null;
    seen: boolean;
    count: number;
    comments:
        | {
              id: number;
              body: string;
              user: UserCard;
              created_at: string;
              mine: boolean;
          }[]
        | null;
};

/**
 * Оцінка й обговорення обраної серії (№271). Без спойлерів: поки серію не відмічено
 * переглянутою, коментарі сховані — відкрити можна вручну.
 */
export function EpisodeTalk({
    slug,
    pick,
}: {
    slug: string;
    pick: EpisodePick;
}) {
    const base = `/cinema/${slug}/episodes/${pick.season}/${pick.episode}`;
    const [talk, setTalk] = useState<Talk | null>(null);
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(
        (reveal = false) =>
            void api<Talk>('GET', `${base}/talk${reveal ? '?reveal=1' : ''}`)
                .then(setTalk)
                .catch(() => setTalk(null)),
        [base],
    );
    useEffect(() => {
        setTalk(null);
        load();
    }, [load]);

    if (!talk) return null;

    const send = (
        method: 'POST' | 'DELETE',
        url: string,
        data?: Record<string, unknown>,
    ) => {
        setBusy(true);
        api<Talk>(method, url, data)
            .then((next) => {
                setTalk(next);
                setBody('');
            })
            .catch((e: { message?: string }) =>
                toast.error(e.message ?? tr('Не вдалося.')),
            )
            .finally(() => setBusy(false));
    };
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (body.trim().length >= 2) send('POST', `${base}/comments`, { body });
    };

    return (
        <section
            className="glass rounded-2xl p-3.5"
            aria-label={tr('Серія {e}', { e: pick.episode })}
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h2 className="font-display text-lg font-semibold text-white">
                    {tr('Сезон {s}, серія {e}', {
                        s: pick.season,
                        e: pick.episode,
                    })}
                </h2>
                <span className="text-sm text-white/55 tabular-nums">
                    {talk.avg !== null
                        ? tr('★ {avg} · {n} оцінок', {
                              avg: talk.avg.toLocaleString('uk-UA'),
                              n: talk.votes,
                          })
                        : tr('Ще без оцінок')}
                </span>
                <div
                    className="ml-auto flex gap-0.5"
                    role="radiogroup"
                    aria-label={tr('Ваша оцінка серії')}
                >
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={talk.mine === n}
                            aria-label={tr('{n} з 5', { n })}
                            disabled={busy}
                            onClick={() =>
                                send('POST', `${base}/rate`, { score: n })
                            }
                            className="rounded-md p-1 text-amber-300 transition hover:scale-110"
                        >
                            <Star
                                className={cn(
                                    'size-5',
                                    (talk.mine ?? 0) >= n
                                        ? 'fill-current'
                                        : 'opacity-40',
                                )}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {talk.comments === null ? (
                <button
                    type="button"
                    onClick={() => load(true)}
                    className="gc-spoiler-gate mt-3"
                >
                    <EyeOff className="size-4 shrink-0" />
                    <span className="min-w-0 text-left">
                        {tr(
                            'Коментарів: {n}. Ви ще не відмітили цю серію переглянутою — можливі спойлери. Показати?',
                            { n: talk.count },
                        )}
                    </span>
                </button>
            ) : (
                <>
                    <form onSubmit={submit} className="mt-3 flex gap-2">
                        <input
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            maxLength={1000}
                            placeholder={tr('Що думаєте про серію?')}
                            aria-label={tr('Коментар до серії')}
                            className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/35"
                        />
                        <button
                            type="submit"
                            disabled={busy || body.trim().length < 2}
                            className="gc-pill-primary"
                        >
                            {tr('Надіслати')}
                        </button>
                    </form>
                    {talk.comments.length > 0 && (
                        <ul className="mt-3 space-y-3">
                            {talk.comments.map((c) => (
                                <li key={c.id} className="flex gap-2.5">
                                    <UserAvatar user={c.user} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-white/80">
                                            {c.user.name}
                                        </p>
                                        <p className="text-sm break-words whitespace-pre-line text-white/75">
                                            {c.body}
                                        </p>
                                    </div>
                                    {c.mine && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                send(
                                                    'DELETE',
                                                    `${base}/comments/${c.id}`,
                                                )
                                            }
                                            aria-label={tr('Видалити коментар')}
                                            className="self-start p-1 text-white/35 hover:text-red-300"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}
