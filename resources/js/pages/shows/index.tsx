import { Head, Link, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    Headphones,
    Mic2,
    Radio,
    SlidersHorizontal,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ShowPerson } from '@/components/shows/show-person';
import { EmptyState } from '@/components/gc/widget';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type ShowCard = {
    id: number;
    title: string;
    topic: string | null;
    topics: string[];
    format: 'duo' | 'double' | 'custom';
    status: 'scheduled' | 'live' | 'ended';
    scheduled_at: string | null;
    started_at: string | null;
    listeners: number;
    host: UserCard | null;
    stage: UserCard[];
};

const FORMATS = [
    {
        key: 'duo',
        icon: Mic2,
        label: '1 на 1',
        hint: 'Ведучий і співрозмовник; гість питає хвилину.',
    },
    {
        key: 'double',
        icon: Users,
        label: '2 на 2',
        hint: 'Четверо на сцені, двоє гостей з питаннями.',
    },
    {
        key: 'custom',
        icon: SlidersHorizontal,
        label: 'Свій склад',
        hint: 'Скільки ведучих, гостей і секунд на питання — вирішуєте ви.',
    },
] as const;

type Trend = { tag: string; shows: number; live: number; listeners: number };

/** Подкасти наживо: тренди #тем, «Зараз в ефірі», розклад і кнопка «Створити кімнату». */
export default function ShowsIndex({
    live,
    upcoming,
    trends,
    topic,
    max_topics: maxTopics,
}: {
    live: ShowCard[];
    upcoming: ShowCard[];
    trends: Trend[];
    topic: string | null;
    max_topics: number;
}) {
    const [creating, setCreating] = useState(false);
    const reduce = useReducedMotion();

    return (
        <>
            <Head title={tr('Подкасти')} />
            <div className="mx-auto w-full max-w-5xl space-y-6 px-1 py-2">
                <header className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1 basis-full sm:basis-0">
                        <h1 className="font-display text-3xl font-bold text-white">
                            {tr('Подкасти')}
                        </h1>
                        <p className="mt-1 text-sm text-white/55">
                            {tr(
                                'Розмови наживо: ведучі на сцені, слухачі піднімають руку — і отримують хвилину на питання.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCreating((v) => !v)}
                        aria-expanded={creating}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white"
                    >
                        {creating ? (
                            <X className="size-4" />
                        ) : (
                            <Radio className="size-4" />
                        )}
                        {creating ? tr('Скасувати') : tr('Створити кімнату')}
                    </button>
                </header>

                <AnimatePresence initial={false}>
                    {creating && (
                        <motion.div
                            initial={
                                reduce
                                    ? { opacity: 0 }
                                    : { opacity: 0, height: 0 }
                            }
                            animate={
                                reduce
                                    ? { opacity: 1 }
                                    : { opacity: 1, height: 'auto' }
                            }
                            exit={
                                reduce
                                    ? { opacity: 0 }
                                    : { opacity: 0, height: 0 }
                            }
                            className="overflow-hidden"
                        >
                            <CreateShow maxTopics={maxTopics} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {(trends.length > 0 || topic) && (
                    <section aria-label={tr('Теми в тренді')}>
                        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/60">
                            <TrendingUp className="size-4 text-primary" />
                            {tr('У тренді')}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {topic && !trends.some((t) => t.tag === topic) && (
                                <TrendChip tag={topic} on />
                            )}
                            {trends.map((t) => (
                                <TrendChip
                                    key={t.tag}
                                    tag={t.tag}
                                    on={t.tag === topic}
                                    listeners={t.listeners}
                                    live={t.live > 0}
                                />
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="mb-3 font-display text-lg font-bold text-white">
                        {topic
                            ? tr('Зараз в ефірі · #{topic}', { topic })
                            : tr('Зараз в ефірі')}
                    </h2>
                    {live.length === 0 ? (
                        <EmptyState
                            icon={Radio}
                            title={tr('Зараз ніхто не в ефірі')}
                            text={tr(
                                'Почніть перше шоу — воно з’явиться тут для всіх.',
                            )}
                        />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {live.map((show, i) => (
                                <motion.div
                                    key={show.id}
                                    initial={
                                        reduce ? false : { opacity: 0, y: 8 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <LiveCard show={show} />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>

                {upcoming.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-display text-lg font-bold text-white">
                            {tr('Незабаром')}
                        </h2>
                        <ul className="gc-solid divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
                            {upcoming.map((show) => (
                                <li key={show.id}>
                                    <UpcomingRow show={show} />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
}

/** Теми кімнати в картці (картка сама є посиланням, тож теми тут — просто текст). */
function Topics({ topics }: { topics: string[] }) {
    if (topics.length === 0) return null;

    return (
        <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-sm font-medium text-primary">
            {topics.map((t) => (
                <span key={t}>#{t}</span>
            ))}
        </span>
    );
}

/** Тема в трендах: дотик — лише кімнати з цією темою, ще раз — усі. */
function TrendChip({
    tag,
    on,
    listeners,
    live,
}: {
    tag: string;
    on: boolean;
    listeners?: number;
    live?: boolean;
}) {
    return (
        <Link
            href={on ? '/shows' : `/shows?topic=${encodeURIComponent(tag)}`}
            preserveScroll
            aria-current={on ? 'true' : undefined}
            className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition',
                on
                    ? 'bg-primary text-white'
                    : 'gc-solid text-white/85 hover:text-white',
            )}
        >
            {live && (
                <span
                    aria-label={tr('В ефірі')}
                    className="size-1.5 rounded-full bg-rose-500"
                />
            )}
            #{tag}
            {listeners !== undefined && listeners > 0 && (
                <span
                    className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium',
                        on ? 'text-white/80' : 'text-white/45',
                    )}
                >
                    <Headphones className="size-3" />
                    {listeners}
                </span>
            )}
            {on && <X className="size-3.5" />}
        </Link>
    );
}

function LiveCard({ show }: { show: ShowCard }) {
    return (
        <Link
            href={`/shows/${show.id}`}
            className="gc-solid group block rounded-2xl p-4 transition hover:bg-white/[0.03]"
        >
            <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md bg-rose-500 px-1.5 py-0.5 font-bold text-white">
                    LIVE
                </span>
                <span className="inline-flex items-center gap-1 text-white/55">
                    <Headphones className="size-3.5" />
                    {show.listeners}
                </span>
            </div>
            <p className="mt-2 line-clamp-2 font-display text-lg font-bold text-white">
                {show.title}
            </p>
            <Topics topics={show.topics} />
            <div className="mt-4 flex flex-wrap justify-center gap-4">
                {show.stage.slice(0, 4).map((person) => (
                    <div
                        key={person.id}
                        className="flex w-24 flex-col items-center"
                    >
                        <ShowPerson person={person} size="md" />
                        <span className="mt-1.5 w-full truncate text-center text-xs font-medium text-white/80">
                            {person.name}
                        </span>
                    </div>
                ))}
            </div>
        </Link>
    );
}

/** Плитка дати: «Сьогодні 22:00», «Завтра 21:00» або число. */
function when(iso: string | null): { day: string; time: string } {
    if (!iso) return { day: '', time: '' };
    const d = new Date(iso);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const time = d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const day = same(d, now)
        ? tr('Сьогодні')
        : same(d, tomorrow)
          ? tr('Завтра')
          : d.toLocaleDateString([], { day: 'numeric', month: 'short' });

    return { day, time };
}

function UpcomingRow({ show }: { show: ShowCard }) {
    const { day, time } = when(show.scheduled_at);

    return (
        <Link
            href={`/shows/${show.id}`}
            className="flex items-center gap-3 p-3 transition hover:bg-white/[0.03]"
        >
            <span className="flex w-20 shrink-0 flex-col items-center rounded-xl bg-primary/12 px-2 py-2 text-center">
                <span className="text-[11px] font-bold text-primary">
                    {day}
                </span>
                <span className="text-sm font-semibold text-white">{time}</span>
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">
                    {show.title}
                    {show.topics.map((t) => (
                        <span key={t} className="text-primary">
                            {' '}
                            #{t}
                        </span>
                    ))}
                </span>
                <span className="block truncate text-xs text-white/50">
                    {show.stage.map((p) => p.name).join(' · ')}
                </span>
            </span>
            <CalendarClock className="size-4 shrink-0 text-white/40" />
        </Link>
    );
}

function CreateShow({ maxTopics }: { maxTopics: number }) {
    const [later, setLater] = useState(false);
    const form = useForm({
        title: '',
        topic: '',
        format: 'duo' as 'duo' | 'double' | 'custom',
        stage_seats: 3,
        guest_seats: 1,
        question_seconds: 60,
        scheduled_at: '',
    });
    // «#ігри #патч» → ['ігри', 'патч']: пробіли й коми розділяють теми.
    const topics = [
        ...new Set(
            form.data.topic
                .split(/[\s,]+/)
                .map((t) => t.replace(/^#+/, '').toLowerCase())
                .filter(Boolean),
        ),
    ];
    const tooMany = topics.length > maxTopics;
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (tooMany) return;
        form.transform((d) => ({
            ...d,
            topic: null,
            topics,
            scheduled_at:
                later && d.scheduled_at
                    ? new Date(d.scheduled_at).toISOString()
                    : null,
        }));
        form.post('/shows');
    };
    const error = Object.values(form.errors)[0];

    return (
        <form onSubmit={submit} className="gc-solid space-y-4 rounded-2xl p-4">
            <Input
                value={form.data.title}
                onChange={(e) => form.setData('title', e.target.value)}
                maxLength={80}
                placeholder={tr(
                    'Про що розмова? Наприклад, «Розбір патча 2.0»',
                )}
                aria-label={tr('Назва кімнати')}
                className="h-11"
            />
            <div>
                <Input
                    value={form.data.topic}
                    onChange={(e) => form.setData('topic', e.target.value)}
                    maxLength={180}
                    placeholder={tr('#теми через пробіл: #ігри #патч #новини')}
                    aria-label={tr('Теми')}
                    aria-invalid={tooMany}
                    className="h-11"
                />
                <p
                    className={cn(
                        'mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs',
                        tooMany ? 'text-rose-400' : 'text-white/45',
                    )}
                >
                    <span className="tabular-nums">
                        {tr('{n} з {max} тем', {
                            n: topics.length,
                            max: maxTopics,
                        })}
                    </span>
                    {topics.slice(0, maxTopics).map((t) => (
                        <span key={t} className="font-medium text-primary">
                            #{t}
                        </span>
                    ))}
                    {topics.length === 0 && (
                        <span>
                            {tr('Популярні теми потрапляють у тренди.')}
                        </span>
                    )}
                </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
                {FORMATS.map((f) => {
                    const Icon = f.icon;
                    const on = form.data.format === f.key;

                    return (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => form.setData('format', f.key)}
                            aria-pressed={on}
                            className={cn(
                                'flex items-start gap-3 rounded-xl p-3 text-left transition',
                                on
                                    ? 'bg-primary/15 ring-1 ring-primary/60'
                                    : 'gc-solid-2 hover:bg-white/[0.06]',
                            )}
                        >
                            <Icon
                                className={cn(
                                    'mt-0.5 size-5 shrink-0',
                                    on ? 'text-primary' : 'text-white/55',
                                )}
                            />
                            <span>
                                <span className="block text-sm font-semibold text-white">
                                    {tr(f.label)}
                                </span>
                                <span className="block text-xs text-white/50">
                                    {tr(f.hint)}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
            {form.data.format === 'custom' && (
                <div className="grid gap-2 sm:grid-cols-3">
                    <NumberField
                        label={tr('Місць на сцені')}
                        value={form.data.stage_seats}
                        min={1}
                        max={8}
                        onChange={(v) => form.setData('stage_seats', v)}
                    />
                    <NumberField
                        label={tr('Гостей одночасно')}
                        value={form.data.guest_seats}
                        min={0}
                        max={4}
                        onChange={(v) => form.setData('guest_seats', v)}
                    />
                    <label className="gc-solid-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-white/70">
                        {tr('Час на питання')}
                        <select
                            value={form.data.question_seconds}
                            onChange={(e) =>
                                form.setData(
                                    'question_seconds',
                                    Number(e.target.value),
                                )
                            }
                            className="rounded-lg bg-transparent font-semibold text-white"
                        >
                            {[30, 60, 90, 120, 180, 300].map((s) => (
                                <option key={s} value={s}>
                                    {s < 60
                                        ? tr('{n} с', { n: s })
                                        : tr('{n} хв', { n: s / 60 })}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <div className="gc-solid-2 inline-flex rounded-xl p-1">
                    {[
                        [false, tr('Зараз')],
                        [true, tr('Запланувати')],
                    ].map(([value, label]) => (
                        <button
                            key={String(value)}
                            type="button"
                            onClick={() => setLater(value as boolean)}
                            aria-pressed={later === value}
                            className={cn(
                                'h-9 rounded-lg px-3 text-sm',
                                later === value
                                    ? 'bg-primary text-white'
                                    : 'text-white/60',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {later && (
                    <Input
                        type="datetime-local"
                        value={form.data.scheduled_at}
                        onChange={(e) =>
                            form.setData('scheduled_at', e.target.value)
                        }
                        aria-label={tr('Дата й час')}
                        className="h-11 w-auto"
                    />
                )}
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        form.data.title.trim().length < 3 ||
                        (later && !form.data.scheduled_at)
                    }
                    className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-40"
                >
                    <Radio className="size-4" />
                    {later ? tr('Додати в розклад') : tr('Почати ефір')}
                </button>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
        </form>
    );
}

function NumberField({
    label,
    value,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
}) {
    return (
        <label className="gc-solid-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-white/70">
            {label}
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) =>
                    onChange(
                        Math.max(min, Math.min(max, Number(e.target.value))),
                    )
                }
                className="w-14 rounded-lg bg-transparent text-right font-semibold text-white"
            />
        </label>
    );
}
