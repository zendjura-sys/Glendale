import { Head, Link, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    Check,
    Gamepad2,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { GameSearch } from '@/components/gc/game-search';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import { clockTime, formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard, UserCard } from '@/types';

export type NightSummary = {
    id: number;
    title: string;
    status: 'planning' | 'set' | 'cancelled';
    starts_at: string | null;
    game: GameCard | null;
    host: UserCard | null;
    members_count: number;
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Найближча п’ятниця о 20:00 у форматі поля datetime-local — перший варіант за замовчуванням. */
function defaultTime(): string {
    const date = new Date();
    date.setDate(date.getDate() + ((5 - date.getDay() + 7) % 7 || 7));
    date.setHours(20, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T20:00`;
}

/** Ігровий вечір: покликати друзів, запропонувати час і гру — усі голосують, організатор призначає. */
export default function GameNightsIndex({
    upcoming,
    past,
    friends,
}: {
    upcoming: NightSummary[];
    past: NightSummary[];
    friends: UserCard[];
}) {
    const [adding, setAdding] = useState(upcoming.length === 0);
    const [games, setGames] = useState<GameCard[]>([]);
    const form = useForm({
        title: '',
        note: '',
        friends: [] as number[],
        times: [defaultTime()],
        games: [] as number[],
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            times: data.times
                .filter(Boolean)
                .map((t) => new Date(t).toISOString()),
        }));
        form.post('/game-nights');
    };
    const toggleFriend = (id: number) =>
        form.setData(
            'friends',
            form.data.friends.includes(id)
                ? form.data.friends.filter((f) => f !== id)
                : [...form.data.friends, id],
        );

    return (
        <>
            <Head title={tr('Ігровий вечір')} />
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                            <CalendarClock className="size-6 text-sky-300" />
                            {tr('Ігровий вечір')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Покличте друзів, запропонуйте кілька варіантів часу й гри — оберіть те, що зручно всім.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAdding(!adding)}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <Plus className="size-4" />
                        {tr('Запланувати')}
                    </button>
                </div>

                {adding && (
                    <form
                        onSubmit={submit}
                        className="glass mt-4 space-y-4 rounded-2xl p-4"
                    >
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Назва, напр. «П’ятниця в CS»')}
                            maxLength={80}
                            className={cn(field, 'h-11')}
                        />
                        <div>
                            <p className="mb-2 text-sm text-white/60">
                                {tr('Коли (до 6 варіантів)')}
                            </p>
                            <div className="space-y-2">
                                {form.data.times.map((time, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="datetime-local"
                                            value={time}
                                            onChange={(e) =>
                                                form.setData(
                                                    'times',
                                                    form.data.times.map(
                                                        (t, i) =>
                                                            i === index
                                                                ? e.target.value
                                                                : t,
                                                    ),
                                                )
                                            }
                                            className={cn(field, 'h-11')}
                                        />
                                        {form.data.times.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    form.setData(
                                                        'times',
                                                        form.data.times.filter(
                                                            (_, i) =>
                                                                i !== index,
                                                        ),
                                                    )
                                                }
                                                aria-label={tr('Прибрати')}
                                                className="rounded-xl px-3 text-white/45 hover:text-rose-300"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {form.data.times.length < 6 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            form.setData('times', [
                                                ...form.data.times,
                                                '',
                                            ])
                                        }
                                        className="text-sm font-medium text-sky-300 hover:text-sky-200"
                                    >
                                        + {tr('Ще варіант часу')}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="mb-2 text-sm text-white/60">
                                {tr('У що граємо (необовʼязково)')}
                            </p>
                            <div className="mb-2 flex flex-wrap gap-2">
                                {games.map((game) => (
                                    <span
                                        key={game.id}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-chip bg-white/[0.08] px-3 text-[13px] text-white"
                                    >
                                        <Gamepad2 className="size-3.5 text-sky-300" />
                                        {game.name}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = games.filter(
                                                    (g) => g.id !== game.id,
                                                );
                                                setGames(next);
                                                form.setData(
                                                    'games',
                                                    next.map((g) => g.id),
                                                );
                                            }}
                                            aria-label={tr('Прибрати')}
                                            className="text-white/45 hover:text-white"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            {games.length < 6 && (
                                <GameSearch
                                    value={null}
                                    onChange={(game) => {
                                        if (
                                            !game ||
                                            games.some((g) => g.id === game.id)
                                        ) {
                                            return;
                                        }
                                        const next = [...games, game];
                                        setGames(next);
                                        form.setData(
                                            'games',
                                            next.map((g) => g.id),
                                        );
                                    }}
                                    placeholder={tr('Додати гру')}
                                />
                            )}
                        </div>
                        <div>
                            <p className="mb-2 text-sm text-white/60">
                                {tr('Кого кличемо')}
                            </p>
                            {friends.length === 0 ? (
                                <p className="text-sm text-white/45">
                                    {tr(
                                        'Спершу додайте друзів — кликати можна лише їх.',
                                    )}
                                </p>
                            ) : (
                                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                                    {friends.map((friend) => {
                                        const on = form.data.friends.includes(
                                            friend.id,
                                        );

                                        return (
                                            <button
                                                key={friend.id}
                                                type="button"
                                                onClick={() =>
                                                    toggleFriend(friend.id)
                                                }
                                                aria-pressed={on}
                                                className={cn(
                                                    'inline-flex h-9 items-center gap-2 rounded-chip pr-3 pl-1 text-[13px] transition',
                                                    on
                                                        ? 'bg-primary text-white'
                                                        : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.1]',
                                                )}
                                            >
                                                <UserAvatar
                                                    user={friend}
                                                    size="xs"
                                                    showOnline={false}
                                                />
                                                {friend.name}
                                                {on && (
                                                    <Check className="size-3.5" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <textarea
                            value={form.data.note}
                            onChange={(e) =>
                                form.setData('note', e.target.value)
                            }
                            placeholder={tr(
                                'Примітка: голосовий канал, режим… (необовʼязково)',
                            )}
                            rows={2}
                            maxLength={500}
                            className={cn(field, 'resize-y py-2.5')}
                        />
                        {Object.values(form.errors)[0] && (
                            <p className="text-xs text-rose-300">
                                {Object.values(form.errors)[0]}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    form.data.title.trim().length < 3 ||
                                    form.data.friends.length === 0 ||
                                    !form.data.times.some(Boolean)
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Покликати друзів')}
                            </button>
                        </div>
                    </form>
                )}

                <section className="mt-6">
                    <h2 className="mb-2 text-sm font-medium text-white/55">
                        {tr('Найближчі')}
                    </h2>
                    {upcoming.length === 0 ? (
                        <EmptyState
                            icon={CalendarClock}
                            title={tr('Поки нічого не заплановано')}
                            text={tr(
                                'Створіть вечір — друзі проголосують за час і гру.',
                            )}
                        />
                    ) : (
                        <ul className="space-y-2">
                            {upcoming.map((night) => (
                                <NightRow key={night.id} night={night} />
                            ))}
                        </ul>
                    )}
                </section>
                {past.length > 0 && (
                    <section className="mt-6">
                        <h2 className="mb-2 text-sm font-medium text-white/55">
                            {tr('Минулі')}
                        </h2>
                        <ul className="space-y-2">
                            {past.map((night) => (
                                <NightRow key={night.id} night={night} />
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
}

function NightRow({ night }: { night: NightSummary }) {
    return (
        <li>
            <Link
                href={`/game-nights/${night.id}`}
                className="glass flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/[0.04]"
            >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200">
                    <CalendarClock className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">
                        {night.title}
                    </span>
                    <span className="block truncate text-xs text-white/50">
                        {night.status === 'set' && night.starts_at
                            ? `${formatDate(night.starts_at, false)} · ${clockTime(night.starts_at)}`
                            : tr('Голосування за час')}
                        {night.game && ` · ${night.game.name}`}
                    </span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-white/45">
                    <Users className="size-3.5" />
                    {night.members_count + 1}
                </span>
            </Link>
        </li>
    );
}
