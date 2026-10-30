import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { eventWhen } from '@/components/communities/community-hub';
import type { CommunityEventItem } from '@/components/communities/community-hub';
import { EventStories } from '@/components/communities/event-stories';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { LOCALE, tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { CommunityCard } from '@/types';

type Props = {
    community: CommunityCard;
    month: string;
    events: CommunityEventItem[];
    upcoming: CommunityEventItem[];
    can: { manage: boolean; member: boolean };
};

const field =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

function shift(month: string, by: number): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + by, 1);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Календар спільноти: місяць сіткою, найближчі події, «Буду / Можливо», спільні історії. */
export default function CommunityCalendar({
    community,
    month,
    events,
    upcoming,
    can,
}: Props) {
    const storiesOn = usePlugin('event_stories');
    const [adding, setAdding] = useState(false);
    const [selected, setSelected] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const id = new URLSearchParams(window.location.search).get('event');
        return id ? Number(id) : null;
    });
    const form = useForm({
        title: '',
        description: '',
        place: '',
        starts_at: '',
        ends_at: '',
    });
    const base = `/c/${community.slug}`;

    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const cells = Array.from(
        { length: Math.ceil((offset + days) / 7) * 7 },
        (_, i) => i - offset + 1,
    );
    const byDay = (day: number) =>
        events.filter((e) => {
            const d = new Date(e.starts_at);
            return (
                d.getFullYear() === y &&
                d.getMonth() === m - 1 &&
                d.getDate() === day
            );
        });
    const today = new Date();
    const all = [
        ...upcoming,
        ...events.filter((e) => !upcoming.some((u) => u.id === e.id)),
    ];
    const active = all.find((e) => e.id === selected) ?? null;
    const rsvp = (
        event: CommunityEventItem,
        status: 'going' | 'maybe' | 'none',
    ) =>
        router.post(
            `${base}/events/${event.id}/rsvp`,
            { status },
            { preserveScroll: true, preserveState: true },
        );

    return (
        <>
            <Head title={`${tr('Календар')} — ${community.name}`} />
            <div className="mx-auto max-w-4xl space-y-4">
                <div className="flex items-center gap-3">
                    <Link
                        href={base}
                        aria-label={tr('Назад')}
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <CommunityAvatar community={community} size="md" />
                    <div className="min-w-0 flex-1">
                        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                            <CalendarDays className="size-5 text-gc-lilac-300" />
                            {tr('Календар')}
                        </h1>
                        <p className="truncate text-sm text-white/50">
                            {community.name}
                        </p>
                    </div>
                    {can.manage && (
                        <button
                            type="button"
                            onClick={() => setAdding(!adding)}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="size-4" />
                            <span className="hidden sm:inline">
                                {tr('Подія')}
                            </span>
                        </button>
                    )}
                </div>

                {adding && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.transform((d) => ({
                                ...d,
                                starts_at: d.starts_at
                                    ? new Date(d.starts_at).toISOString()
                                    : '',
                                ends_at: d.ends_at
                                    ? new Date(d.ends_at).toISOString()
                                    : null,
                            }));
                            form.post(`${base}/events`, {
                                preserveScroll: true,
                                onSuccess: () => {
                                    form.reset();
                                    setAdding(false);
                                },
                            });
                        }}
                        className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2"
                    >
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Назва події')}
                            maxLength={120}
                            className={cn(field, 'sm:col-span-2')}
                        />
                        <label className="text-xs text-white/50">
                            {tr('Початок')}
                            <input
                                type="datetime-local"
                                value={form.data.starts_at}
                                onChange={(e) =>
                                    form.setData('starts_at', e.target.value)
                                }
                                className={cn(field, 'mt-1')}
                            />
                        </label>
                        <label className="text-xs text-white/50">
                            {tr('Кінець (необовʼязково)')}
                            <input
                                type="datetime-local"
                                value={form.data.ends_at}
                                onChange={(e) =>
                                    form.setData('ends_at', e.target.value)
                                }
                                className={cn(field, 'mt-1')}
                            />
                        </label>
                        <input
                            value={form.data.place}
                            onChange={(e) =>
                                form.setData('place', e.target.value)
                            }
                            placeholder={tr(
                                'Де: голосовий канал, сервер, адреса',
                            )}
                            maxLength={120}
                            className={cn(field, 'sm:col-span-2')}
                        />
                        <textarea
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder={tr('Опис (необовʼязково)')}
                            rows={3}
                            maxLength={2000}
                            className={cn(
                                field,
                                'h-auto resize-y py-2.5 sm:col-span-2',
                            )}
                        />
                        {Object.values(form.errors)[0] && (
                            <p className="text-xs text-rose-300 sm:col-span-2">
                                {Object.values(form.errors)[0]}
                            </p>
                        )}
                        <div className="flex justify-end sm:col-span-2">
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    !form.data.title ||
                                    !form.data.starts_at
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Додати')}
                            </button>
                        </div>
                    </form>
                )}

                <section className="glass rounded-2xl p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <Link
                            href={`${base}/calendar?month=${shift(month, -1)}`}
                            preserveScroll
                            aria-label={tr('Попередній місяць')}
                            className="flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.06] hover:text-white"
                        >
                            <ChevronLeft className="size-5" />
                        </Link>
                        <h2 className="font-display text-base font-semibold text-white capitalize">
                            {first.toLocaleDateString(LOCALE, {
                                month: 'long',
                                year: 'numeric',
                            })}
                        </h2>
                        <Link
                            href={`${base}/calendar?month=${shift(month, 1)}`}
                            preserveScroll
                            aria-label={tr('Наступний місяць')}
                            className="flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.06] hover:text-white"
                        >
                            <ChevronRight className="size-5" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/40">
                        {[
                            tr('Пн'),
                            tr('Вт'),
                            tr('Ср'),
                            tr('Чт'),
                            tr('Пт'),
                            tr('Сб'),
                            tr('Нд'),
                        ].map((d) => (
                            <div key={d} className="py-1">
                                {d}
                            </div>
                        ))}
                        {cells.map((day, i) => {
                            const list =
                                day >= 1 && day <= days ? byDay(day) : [];
                            const isToday =
                                day === today.getDate() &&
                                m - 1 === today.getMonth() &&
                                y === today.getFullYear();
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        'min-h-14 rounded-lg p-1 text-left sm:min-h-20',
                                        day >= 1 && day <= days
                                            ? 'bg-white/[0.03]'
                                            : 'opacity-0',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'text-xs',
                                            isToday
                                                ? 'font-bold text-gc-lilac-300'
                                                : 'text-white/50',
                                        )}
                                    >
                                        {day >= 1 && day <= days ? day : ''}
                                    </span>
                                    {list.slice(0, 2).map((e) => (
                                        <button
                                            key={e.id}
                                            type="button"
                                            onClick={() => setSelected(e.id)}
                                            className="mt-0.5 block w-full truncate rounded bg-gc-indigo/40 px-1 text-left text-[10px] text-white sm:text-[11px]"
                                        >
                                            {e.title}
                                        </button>
                                    ))}
                                    {list.length > 2 && (
                                        <span className="text-[10px] text-white/45">
                                            +{list.length - 2}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {active && (
                    <section className="glass rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <h3 className="font-display text-lg font-semibold text-white">
                                    {active.title}
                                </h3>
                                <p className="mt-0.5 text-sm text-white/55">
                                    {eventWhen(active.starts_at)}
                                </p>
                                {active.place && (
                                    <p className="mt-1 flex items-center gap-1.5 text-sm text-white/65">
                                        <MapPin className="size-4" />
                                        {active.place}
                                    </p>
                                )}
                            </div>
                            {can.manage && (
                                <button
                                    type="button"
                                    aria-label={tr('Видалити подію')}
                                    onClick={() =>
                                        window.confirm(tr('Видалити подію?')) &&
                                        router.delete(
                                            `${base}/events/${active.id}`,
                                            {
                                                preserveScroll: true,
                                                onSuccess: () =>
                                                    setSelected(null),
                                            },
                                        )
                                    }
                                    className="flex size-9 items-center justify-center rounded-xl text-white/45 hover:bg-rose-500/10 hover:text-rose-300"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            )}
                        </div>
                        {active.description && (
                            <p className="mt-3 text-sm whitespace-pre-line text-white/75">
                                {active.description}
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm text-white/55">
                                <Users className="size-4" />
                                {tr('Буде: {count}', { count: active.going })}
                            </span>
                            {can.member &&
                                (['going', 'maybe'] as const).map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() =>
                                            rsvp(
                                                active,
                                                active.my === status
                                                    ? 'none'
                                                    : status,
                                            )
                                        }
                                        className={cn(
                                            'h-9 rounded-xl px-3.5 text-sm font-medium transition',
                                            active.my === status
                                                ? 'bg-gc-indigo text-white'
                                                : 'bg-white/[0.07] text-white hover:bg-white/[0.11]',
                                        )}
                                    >
                                        {status === 'going'
                                            ? tr('Буду')
                                            : tr('Можливо')}
                                    </button>
                                ))}
                        </div>
                        {storiesOn && (
                            <EventStories
                                key={active.id}
                                base={`${base}/events/${active.id}`}
                                canAdd={
                                    can.member &&
                                    new Date(active.starts_at).getTime() -
                                        Date.now() <
                                        2 * 3600_000
                                }
                            />
                        )}
                    </section>
                )}

                <section className="glass rounded-2xl p-4">
                    <h2 className="mb-2 font-display text-base font-semibold text-white">
                        {tr('Найближчі')}
                    </h2>
                    {upcoming.length === 0 ? (
                        <p className="text-sm text-white/50">
                            {tr('Попереду подій немає.')}
                        </p>
                    ) : (
                        <ul className="divide-y divide-white/[0.06]">
                            {upcoming.map((e) => (
                                <li key={e.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(e.id)}
                                        className="flex w-full items-center gap-3 py-2.5 text-left"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-white">
                                                {e.title}
                                            </span>
                                            <span className="text-xs text-white/45">
                                                {eventWhen(e.starts_at)}
                                            </span>
                                        </span>
                                        {e.my && (
                                            <span className="text-xs text-gc-lilac-300">
                                                {e.my === 'going'
                                                    ? tr('Буду')
                                                    : tr('Можливо')}
                                            </span>
                                        )}
                                        <span className="text-xs text-white/40 tabular-nums">
                                            {e.going}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
