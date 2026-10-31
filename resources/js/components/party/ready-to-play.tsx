import { Link, usePage } from '@inertiajs/react';
import { Gamepad2, Loader2, MessageCircle, Power, Zap } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { GameCard, UserCard } from '@/types';

type Ready = {
    user: UserCard;
    game: GameCard | null;
    note: string | null;
    until: string;
};

type State = {
    mine: Ready | null;
    friends: Ready[];
    games: GameCard[];
    durations: number[];
};

/** «ще 42 хв» / «ще 1 год 10 хв». */
function left(until: string, now: number): string {
    const minutes = Math.max(
        1,
        Math.round((new Date(until).getTime() - now) / 60_000),
    );
    if (minutes < 60) {
        return tr('ще {n} хв', { n: minutes });
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return rest > 0
        ? tr('ще {h} год {m} хв', { h: hours, m: rest })
        : tr('ще {h} год', { h: hours });
}

function durationLabel(minutes: number): string {
    return minutes < 60
        ? tr('{n} хв', { n: minutes })
        : tr('{n} год', { n: minutes / 60 });
}

/**
 * «Готовий грати зараз»: своя кнопка з вибором гри й часу та друзі, які теж вільні.
 * Порожній (без друзів і без свого стану) показує лише кнопку.
 */
export function ReadyToPlayCard({ className }: { className?: string }) {
    const on = usePlugin('ready_to_play');
    const { modules } = usePage().props;
    const reduce = useReducedMotion();
    const [state, setState] = useState<State | null>(null);
    const [open, setOpen] = useState(false);
    const [game, setGame] = useState<string | null>(null);
    const [minutes, setMinutes] = useState(60);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!on) {
            return;
        }
        void api<State>('GET', '/ready')
            .then(setState)
            .catch(() => {});
        const tick = window.setInterval(() => setNow(Date.now()), 30_000);

        return () => window.clearInterval(tick);
    }, [on]);

    if (!on || state === null) {
        return null;
    }

    // Час минув, поки сторінка відкрита, — ховаємо без перезавантаження.
    const mine =
        state.mine && new Date(state.mine.until).getTime() > now
            ? state.mine
            : null;
    const friends = state.friends.filter(
        (f) => new Date(f.until).getTime() > now,
    );

    const send = (method: 'PUT' | 'DELETE') => {
        setBusy(true);
        api<State>(
            method,
            '/ready',
            method === 'PUT' ? { game, minutes, note } : undefined,
        )
            .then((next) => {
                setState(next);
                setOpen(false);
                toast.success(
                    method === 'PUT'
                        ? tr('Друзі бачать, що ви готові грати.')
                        : tr('Готовність знято.'),
                );
            })
            .catch(() => toast.error(tr('Не вдалося оновити статус.')))
            .finally(() => setBusy(false));
    };

    return (
        <Widget
            title={tr('Готові грати зараз')}
            icon={Zap}
            className={className}
        >
            {mine ? (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-emerald-400/10 p-2.5 ring-1 ring-emerald-400/30">
                    <span className="relative flex size-2.5 shrink-0">
                        <span
                            className={cn(
                                'absolute inset-0 rounded-full bg-emerald-400',
                                !reduce && 'animate-ping opacity-60',
                            )}
                        />
                        <span className="relative size-2.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-semibold text-white">
                            {mine.game
                                ? tr('Готові грати в {game}', {
                                      game: mine.game.name,
                                  })
                                : tr('Готові грати')}
                        </span>
                        <span className="block text-xs text-white/55">
                            {left(mine.until, now)}
                        </span>
                    </span>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => send('DELETE')}
                        aria-label={tr('Зняти готовність')}
                        className="flex size-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
                    >
                        <Power className="size-4" />
                    </button>
                </div>
            ) : (
                !open && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="btn-glow mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white"
                    >
                        <Gamepad2 className="size-4" /> {tr('Я готовий грати')}
                    </button>
                )
            )}

            <AnimatePresence initial={false}>
                {open && !mine && (
                    <m.div
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reduce ? undefined : { opacity: 0, height: 0 }}
                        className="mb-3 overflow-hidden"
                    >
                        <div className="space-y-2.5 rounded-xl bg-white/[0.04] p-2.5">
                            <div className="flex flex-wrap gap-1">
                                <Chip
                                    active={game === null}
                                    onClick={() => setGame(null)}
                                >
                                    {tr('Будь-яка гра')}
                                </Chip>
                                {state.games.map((g) => (
                                    <Chip
                                        key={g.id}
                                        active={game === g.slug}
                                        onClick={() => setGame(g.slug)}
                                    >
                                        {g.name}
                                    </Chip>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {state.durations.map((d) => (
                                    <Chip
                                        key={d}
                                        active={minutes === d}
                                        onClick={() => setMinutes(d)}
                                    >
                                        {durationLabel(d)}
                                    </Chip>
                                ))}
                            </div>
                            <input
                                value={note}
                                maxLength={80}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={tr(
                                    'Примітка: «є мікро, граю спокійно»',
                                )}
                                aria-label={tr('Примітка')}
                                className="h-9 w-full rounded-lg bg-white/[0.05] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:ring-1 focus:ring-primary/60"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="h-9 rounded-lg px-3 text-sm text-white/60 hover:bg-white/[0.06] hover:text-white"
                                >
                                    {tr('Скасувати')}
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => send('PUT')}
                                    className="btn-glow ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {busy && (
                                        <Loader2 className="size-4 animate-spin" />
                                    )}
                                    {tr('Почати')}
                                </button>
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            {friends.length > 0 ? (
                <ul className="space-y-1">
                    {friends.map((f) => (
                        <li
                            key={f.user.id}
                            className="flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white/[0.04]"
                        >
                            <Link href={`/${f.user.username}`}>
                                <UserAvatar user={f.user} size="sm" />
                            </Link>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-white">
                                    {f.user.first_name}
                                    {f.game && (
                                        <span className="text-white/55">
                                            {' · '}
                                            {f.game.name}
                                        </span>
                                    )}
                                </span>
                                <span className="block truncate text-xs text-white/45">
                                    {f.note ? `${f.note} · ` : ''}
                                    {left(f.until, now)}
                                </span>
                            </span>
                            {modules.includes('messages') && (
                                <Link
                                    href={`/messages/with/${f.user.username}?text=${encodeURIComponent(
                                        f.game
                                            ? tr(
                                                  'Го в {game}? Я теж вільний.',
                                                  {
                                                      game: f.game.name,
                                                  },
                                              )
                                            : tr('Го пограємо? Я теж вільний.'),
                                    )}`}
                                    aria-label={tr('Написати {name}', {
                                        name: f.user.first_name,
                                    })}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gc-lilac-300 transition hover:bg-white/10 hover:text-white"
                                >
                                    <MessageCircle className="size-4" />
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="px-1 text-xs text-white/45">
                    {tr(
                        'Зараз ніхто з друзів не позначив, що вільний. Будьте першим.',
                    )}
                </p>
            )}
        </Widget>
    );
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'h-7 max-w-full truncate rounded-lg px-2.5 text-xs font-semibold transition',
                active
                    ? 'bg-white text-gc-ink'
                    : 'bg-white/[0.06] text-white/70 hover:bg-white/10',
            )}
        >
            {children}
        </button>
    );
}
