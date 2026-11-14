import { Head, InfiniteScroll, router, useForm } from '@inertiajs/react';
import { BookOpen, Clock, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { GameSearch } from '@/components/gc/game-search';
import { ListSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard, ScrollData, UserCard } from '@/types';

type Mood = 'great' | 'good' | 'meh' | 'bad';
type Entry = {
    id: number;
    body: string;
    mood: Mood;
    minutes: number | null;
    played_on: string;
    is_public: boolean;
    game: GameCard | null;
};

function moodLabel(mood: Mood): string {
    return {
        great: tr('Чудово'),
        good: tr('Добре'),
        meh: tr('Так собі'),
        bad: tr('Погано'),
    }[mood];
}

const moodDot: Record<Mood, string> = {
    great: 'bg-emerald-400',
    good: 'bg-sky-400',
    meh: 'bg-amber-300',
    bad: 'bg-red-400',
};

function hours(minutes: number): string {
    return minutes >= 60
        ? tr('{h} год {m} хв', {
              h: Math.floor(minutes / 60),
              m: minutes % 60,
          })
        : tr('{m} хв', { m: minutes });
}

/** Ігровий щоденник: свій — з формою, чужий — лише відкриті записи. */
export default function Journal({
    owner,
    mine,
    entries,
    stats,
    moods,
}: {
    owner: UserCard;
    mine: boolean;
    entries: ScrollData<Entry>;
    stats: { entries: number; minutes: number; games: number };
    moods: Mood[];
}) {
    const form = useForm<{
        game_id: number | null;
        body: string;
        mood: Mood;
        minutes: string;
        is_public: boolean;
    }>({
        game_id: null,
        body: '',
        mood: 'good',
        minutes: '',
        is_public: false,
    });
    const [game, setGame] = useState<GameCard | null>(null);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            minutes: data.minutes ? Number(data.minutes) : null,
        }));
        form.post('/journal', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setGame(null);
            },
        });
    };

    return (
        <>
            <Head
                title={
                    mine
                        ? tr('Ігровий щоденник')
                        : tr('Щоденник · {name}', { name: owner.name })
                }
            />
            <div className="mx-auto max-w-2xl space-y-4">
                <header>
                    <h1 className="font-display text-2xl font-bold text-white">
                        {mine
                            ? tr('Ігровий щоденник')
                            : tr('Щоденник · {name}', { name: owner.name })}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr('{entries} записів · {games} ігор · {time} у грі', {
                            entries: stats.entries,
                            games: stats.games,
                            time: hours(stats.minutes),
                        })}
                    </p>
                </header>

                {mine && (
                    <form
                        onSubmit={submit}
                        className="gc-solid space-y-3 rounded-2xl p-4"
                    >
                        <GameSearch
                            value={game}
                            onChange={(picked) => {
                                setGame(picked);
                                form.setData('game_id', picked?.id ?? null);
                            }}
                            placeholder={tr('Гра (необов’язково)')}
                        />
                        <textarea
                            value={form.data.body}
                            onChange={(e) =>
                                form.setData('body', e.target.value)
                            }
                            placeholder={tr(
                                'Що сьогодні було в грі? Бос, якого нарешті пройшли, нова збірка, смішний момент…',
                            )}
                            maxLength={3000}
                            className="input-glass min-h-24 w-full rounded-xl px-3 py-2 text-sm text-white"
                        />
                        {form.errors.body && (
                            <p className="text-xs text-red-400">
                                {form.errors.body}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                            {moods.map((mood) => (
                                <button
                                    key={mood}
                                    type="button"
                                    onClick={() => form.setData('mood', mood)}
                                    className={cn(
                                        'flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition',
                                        form.data.mood === mood
                                            ? 'bg-primary text-white'
                                            : 'gc-solid-2 text-white/70 hover:text-white',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-2 rounded-full',
                                            moodDot[mood],
                                        )}
                                    />
                                    {moodLabel(mood)}
                                </button>
                            ))}
                            <input
                                type="number"
                                min={1}
                                max={1440}
                                value={form.data.minutes}
                                onChange={(e) =>
                                    form.setData('minutes', e.target.value)
                                }
                                placeholder={tr('Хвилин у грі')}
                                className="input-glass h-9 w-32 rounded-xl px-3 text-sm text-white"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-white/70">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_public}
                                    onChange={(e) =>
                                        form.setData(
                                            'is_public',
                                            e.target.checked,
                                        )
                                    }
                                    className="size-4"
                                />
                                {tr('Показувати іншим')}
                            </label>
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    form.data.body.trim().length < 2
                                }
                                className="ml-auto h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {tr('Записати')}
                            </button>
                        </div>
                    </form>
                )}

                {entries.data.length === 0 ? (
                    <EmptyState
                        icon={BookOpen}
                        title={
                            mine
                                ? tr('Щоденник порожній')
                                : tr('Відкритих записів немає')
                        }
                        text={
                            mine
                                ? tr(
                                      'Записуйте, що відбувалося в грі, — за рік вийде ціла історія.',
                                  )
                                : undefined
                        }
                    />
                ) : (
                    <InfiniteScroll
                        data="entries"
                        loading={<ListSkeleton rows={2} />}
                        className="space-y-3"
                    >
                        {entries.data.map((entry) => (
                            <article
                                key={entry.id}
                                className="gc-solid rounded-2xl p-4"
                            >
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                                    <span className="flex items-center gap-1.5">
                                        <span
                                            className={cn(
                                                'size-2 rounded-full',
                                                moodDot[entry.mood],
                                            )}
                                        />
                                        {moodLabel(entry.mood)}
                                    </span>
                                    <span>{formatDate(entry.played_on)}</span>
                                    {entry.game && (
                                        <span className="text-white/75">
                                            {entry.game.name}
                                        </span>
                                    )}
                                    {entry.minutes && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {hours(entry.minutes)}
                                        </span>
                                    )}
                                    {mine && !entry.is_public && (
                                        <Lock
                                            className="size-3"
                                            aria-label={tr('Лише ви')}
                                        />
                                    )}
                                    {mine && (
                                        <button
                                            type="button"
                                            aria-label={tr('Видалити')}
                                            onClick={() => {
                                                if (
                                                    confirm(
                                                        tr(
                                                            'Видалити запис зі щоденника?',
                                                        ),
                                                    )
                                                ) {
                                                    router.delete(
                                                        `/journal/${entry.id}`,
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    );
                                                }
                                            }}
                                            className="ml-auto rounded-lg p-1 text-white/40 hover:text-red-400"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-white/85">
                                    {entry.body}
                                </p>
                            </article>
                        ))}
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}
