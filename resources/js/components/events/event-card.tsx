import { Link, router, useForm } from '@inertiajs/react';
import {
    CalendarDays,
    Check,
    Crown,
    ExternalLink,
    Gamepad2,
    Server,
    Swords,
    Trash2,
    UsersRound,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalendarEvent = {
    key: string;
    kind: 'family' | 'clan' | 'server' | 'game';
    id: number;
    title: string;
    type_label: string;
    description: string | null;
    starts_at: string;
    where: { name: string; url: string };
    status: 'going' | 'declined' | null;
    going_count: number;
    can_decline: boolean;
    rsvp_url: string;
    host?: string | null;
    is_official?: boolean;
    can_delete?: boolean;
    delete_url?: string;
    all_day?: boolean;
    ends_at?: string | null;
    url?: string | null;
    image?: string | null;
    source?: string | null;
    games?: { name: string; url: string }[];
};

const KIND_ICON = {
    family: Crown,
    clan: Swords,
    server: Server,
    game: Gamepad2,
} as const;

/** Підпис кнопки зовнішнього посилання: трансляція, Discord чи сайт. */
const linkLabel = (url: string) =>
    url.includes('discord.com')
        ? 'Відкрити в Discord'
        : /twitch\.tv|youtube\.com|youtu\.be/.test(url)
          ? 'Дивитися трансляцію'
          : 'Детальніше';

export const kyivTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        hour: '2-digit',
        minute: '2-digit',
    });

export const kyivDay = (iso: string) =>
    new Date(iso).toLocaleDateString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

/** Подія з календаря: де, коли, хто йде, «піду / не піду». Дії йдуть у розділи сім’ї, клану чи сервера. */
export function EventCard({ event }: { event: CalendarEvent }) {
    const Icon = KIND_ICON[event.kind];
    const game = event.kind === 'game';
    const rsvp = (going: boolean) =>
        router.post(event.rsvp_url, event.kind === 'clan' ? {} : { going }, {
            preserveScroll: true,
        });

    return (
        <article className="glass flex flex-wrap items-start gap-3 rounded-2xl p-3.5 sm:flex-nowrap">
            <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-white/[0.04] py-2">
                {event.all_day ? (
                    <span className="text-center text-xs leading-tight font-semibold text-white">
                        Весь
                        <br />
                        день
                    </span>
                ) : (
                    <span className="text-base font-semibold text-white">
                        {kyivTime(event.starts_at)}
                    </span>
                )}
                <Icon className="mt-1 size-4 text-[#a5b4fc]" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-white/50">
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-white/70">
                        {event.type_label}
                    </span>
                    <Link
                        href={event.where.url}
                        className="truncate hover:text-white"
                    >
                        {event.where.name}
                    </Link>
                    {event.host && <span>· {event.host}</span>}
                </p>
                <h3 className="mt-1 font-semibold text-white">{event.title}</h3>
                {event.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-white/60">
                        {event.description}
                    </p>
                )}
                {event.games && event.games.length > 1 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                        {event.games.map((g) => (
                            <Link
                                key={g.url}
                                href={g.url}
                                className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-white/60 hover:text-white"
                            >
                                {g.name}
                            </Link>
                        ))}
                    </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1">
                        <UsersRound className="size-3.5" />{' '}
                        {game ? 'Цікаво' : 'Іде'}: {event.going_count}
                    </span>
                    {event.url && (
                        <a
                            href={event.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-[#a5b4fc] hover:text-white"
                        >
                            <ExternalLink className="size-3.5" />
                            {linkLabel(event.url)}
                        </a>
                    )}
                </p>
            </div>
            {event.image && (
                <img
                    src={event.image}
                    alt=""
                    loading="lazy"
                    className="hidden size-14 shrink-0 rounded-xl bg-white/[0.04] object-contain p-1 sm:block"
                />
            )}
            <div className="flex w-full items-center gap-1.5 sm:w-auto">
                <button
                    type="button"
                    onClick={() =>
                        rsvp(
                            event.kind === 'clan'
                                ? event.status !== 'going'
                                : true,
                        )
                    }
                    className={cn(
                        'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition sm:flex-none',
                        event.status === 'going'
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-white/[0.06] text-white/75 hover:bg-white/10',
                    )}
                >
                    <Check className="size-4" /> {game ? 'Цікаво' : 'Піду'}
                </button>
                {event.can_decline && (
                    <button
                        type="button"
                        onClick={() => rsvp(false)}
                        className={cn(
                            'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm transition sm:flex-none',
                            event.status === 'declined'
                                ? 'bg-rose-500/15 text-rose-200'
                                : 'bg-white/[0.04] text-white/55 hover:bg-white/10',
                        )}
                    >
                        <X className="size-4" />{' '}
                        {game ? 'Не цікаво' : 'Не піду'}
                    </button>
                )}
                {event.can_delete && (
                    <button
                        type="button"
                        onClick={() =>
                            confirm('Видалити подію?') &&
                            router.delete(
                                event.delete_url ??
                                    `/events/server/${event.id}`,
                                { preserveScroll: true },
                            )
                        }
                        className="rounded-lg p-2 text-white/35 hover:text-rose-300"
                        aria-label="Видалити"
                    >
                        <Trash2 className="size-4" />
                    </button>
                )}
            </div>
        </article>
    );
}

/** Стрічка подій, згрупована за днями (київський час). */
export function EventList({ events }: { events: CalendarEvent[] }) {
    const days = new Map<string, CalendarEvent[]>();
    for (const e of events) {
        const day = kyivDay(e.starts_at);
        days.set(day, [...(days.get(day) ?? []), e]);
    }

    return (
        <div className="space-y-5">
            {[...days.entries()].map(([day, items]) => (
                <section key={day}>
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/70 first-letter:uppercase">
                        <CalendarDays className="size-4 text-[#a5b4fc]" /> {day}
                    </h2>
                    <div className="space-y-2">
                        {items.map((e) => (
                            <EventCard key={e.key} event={e} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

/** Нова подія сервера: від сім’ї (керівникам сімей цього сервера) або офіційна (адміністрації). */
export function ServerEventForm({
    serverSlug,
    hosts,
    types,
}: {
    serverSlug: string;
    hosts: { id: number | null; name: string }[];
    types: Record<string, string>;
}) {
    const form = useForm({
        family_id: hosts[0]?.id ?? null,
        type: Object.keys(types)[0] ?? 'event',
        title: '',
        starts_at: '',
        description: '',
    });
    const input =
        'input-glass h-10 w-full min-w-0 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.post(`/events/server/${serverSlug}`, {
                    preserveScroll: true,
                    onSuccess: () =>
                        form.reset('title', 'starts_at', 'description'),
                });
            }}
            className="grid gap-2 sm:grid-cols-2"
        >
            <select
                value={form.data.family_id ?? ''}
                onChange={(e) =>
                    form.setData(
                        'family_id',
                        e.target.value === '' ? null : Number(e.target.value),
                    )
                }
                className={input}
                aria-label="Від кого"
            >
                {hosts.map((h) => (
                    <option key={h.id ?? 'official'} value={h.id ?? ''}>
                        {h.name}
                    </option>
                ))}
            </select>
            <select
                value={form.data.type}
                onChange={(e) => form.setData('type', e.target.value)}
                className={input}
                aria-label="Тип"
            >
                {Object.entries(types).map(([key, label]) => (
                    <option key={key} value={key}>
                        {label}
                    </option>
                ))}
            </select>
            <input
                value={form.data.title}
                maxLength={120}
                onChange={(e) => form.setData('title', e.target.value)}
                placeholder="Назва: турнір, збір, рейд…"
                className={input}
            />
            <input
                type="datetime-local"
                value={form.data.starts_at}
                onChange={(e) => form.setData('starts_at', e.target.value)}
                className={input}
                aria-label="Початок (Київ)"
            />
            <textarea
                value={form.data.description}
                maxLength={1000}
                rows={2}
                onChange={(e) => form.setData('description', e.target.value)}
                placeholder="Деталі (необов’язково)"
                className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none sm:col-span-2"
            />
            {(form.errors.starts_at || form.errors.title) && (
                <p className="text-xs text-rose-300 sm:col-span-2">
                    {form.errors.starts_at ?? form.errors.title}
                </p>
            )}
            <button
                type="submit"
                disabled={form.processing}
                className="btn-glow inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold disabled:opacity-50 sm:col-span-2"
            >
                Додати подію
            </button>
        </form>
    );
}

/** Офіційна подія гри від адміністрації GameCon (турнір, трансляція, оновлення). */
export function GameEventForm({
    gameSlug,
    types,
}: {
    gameSlug: string;
    types: Record<string, string>;
}) {
    const form = useForm({
        type: 'tournament',
        title: '',
        starts_at: '',
        url: '',
        description: '',
    });
    const input =
        'input-glass h-10 w-full min-w-0 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.post(`/events/game/${gameSlug}`, {
                    preserveScroll: true,
                    onSuccess: () =>
                        form.reset('title', 'starts_at', 'url', 'description'),
                });
            }}
            className="grid gap-2 sm:grid-cols-2"
        >
            <input
                value={form.data.title}
                maxLength={160}
                onChange={(e) => form.setData('title', e.target.value)}
                placeholder="Назва події"
                className={input}
            />
            <select
                value={form.data.type}
                onChange={(e) => form.setData('type', e.target.value)}
                className={input}
                aria-label="Тип"
            >
                {Object.entries(types)
                    .filter(([key]) => key !== 'release')
                    .map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
            </select>
            <input
                type="datetime-local"
                value={form.data.starts_at}
                onChange={(e) => form.setData('starts_at', e.target.value)}
                className={input}
                aria-label="Початок (Київ)"
            />
            <input
                value={form.data.url}
                onChange={(e) => form.setData('url', e.target.value)}
                placeholder="Посилання (https://…), необов’язково"
                className={input}
            />
            <textarea
                value={form.data.description}
                maxLength={1000}
                rows={2}
                onChange={(e) => form.setData('description', e.target.value)}
                placeholder="Деталі (необов’язково)"
                className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none sm:col-span-2"
            />
            {(form.errors.starts_at ||
                form.errors.title ||
                form.errors.url) && (
                <p className="text-xs text-rose-300 sm:col-span-2">
                    {form.errors.starts_at ??
                        form.errors.title ??
                        form.errors.url}
                </p>
            )}
            <button
                type="submit"
                disabled={form.processing}
                className="btn-glow inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold disabled:opacity-50 sm:col-span-2"
            >
                Додати подію гри
            </button>
        </form>
    );
}
