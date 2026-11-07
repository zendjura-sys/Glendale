import { Link, router } from '@inertiajs/react';
import { Headphones } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { TrackCard, UserCard } from '@/types';

export type ListenGroupType = 'family' | 'clan' | 'community';

export type ListenRoomSummary = {
    code: string;
    url: string;
    title: string | null;
    group: {
        type: ListenGroupType;
        id: number;
        name: string;
        url: string;
        avatar_url: string | null;
    } | null;
    host: UserCard | null;
    now_playing: TrackCard | null;
    playing: boolean;
    listeners: number;
};

type Status = {
    member: boolean;
    room: ListenRoomSummary | null;
    can_start: boolean;
    can_manage: boolean;
    policy: 'all' | 'admins' | 'off' | null;
};

const POLICIES: { key: NonNullable<Status['policy']>; label: () => string }[] =
    [
        { key: 'all', label: () => tr('Відкривати можуть усі') },
        { key: 'admins', label: () => tr('Лише адміністратори') },
        { key: 'off', label: () => tr('Кімнати вимкнено') },
    ];

/** Відкрити кімнату групи (або приєднатися до живої) і перейти в неї. */
export function startListenRoom(group: ListenGroupType | null, id?: number) {
    void api<{ code: string }>('POST', '/music/rooms', {
        group_type: group,
        group_id: id ?? null,
    })
        .then(({ code }) => router.visit(`/listen/${code}`))
        .catch((e: Error) => toast.error(e.message));
}

/**
 * «Слухати разом» на сторінці сім’ї, клану чи спільноти: кнопка й значок «Зараз у кімнаті: N».
 * `button` — компактна кнопка для шапки, `card` — картка для бічної колонки з налаштуванням для адміністраторів.
 */
export function ListenRoomButton({
    group,
    id,
    variant = 'card',
    className,
}: {
    group: ListenGroupType;
    id: number;
    variant?: 'card' | 'button';
    className?: string;
}) {
    const [status, setStatus] = useState<Status | null>(null);
    const reduce = useReducedMotion();
    const url = `/music/rooms/${group}/${id}`;

    useEffect(() => {
        const load = () => {
            if (document.visibilityState === 'hidden') return;
            void api<Status>('GET', url)
                .then(setStatus)
                .catch(() => undefined);
        };
        load();
        const timer = window.setInterval(load, 30000);

        return () => window.clearInterval(timer);
    }, [url]);

    if (!status?.member) return null;
    const room = status.room;
    if (!room && !status.can_start && !status.can_manage) return null;

    const action = room ? (
        <Link
            href={`/listen/${room.code}`}
            className={cn(
                variant === 'button'
                    ? className
                    : 'btn-glow inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold',
            )}
        >
            <Headphones className="size-4" /> {tr('Слухати разом')}
        </Link>
    ) : status.can_start ? (
        <button
            type="button"
            onClick={() => startListenRoom(group, id)}
            className={cn(
                variant === 'button'
                    ? className
                    : 'glass inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-white/80 hover:text-white',
            )}
        >
            <Headphones className="size-4" /> {tr('Слухати разом')}
        </button>
    ) : null;

    const badge = room && (
        <m.span
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200"
        >
            <span className="size-1.5 rounded-full bg-emerald-300" />
            {tr('Зараз у кімнаті: {n}', { n: room.listeners })}
        </m.span>
    );

    if (variant === 'button') {
        return (
            <span className="inline-flex items-center gap-2">
                {action}
                <AnimatePresence>{badge}</AnimatePresence>
            </span>
        );
    }

    return (
        <section className="glass space-y-3 rounded-2xl p-4">
            <div className="flex items-center gap-2">
                <Headphones className="size-4 text-gc-lilac-200" />
                <h2 className="flex-1 font-display text-base font-semibold text-white">
                    {tr('Слухати разом')}
                </h2>
                <AnimatePresence>{badge}</AnimatePresence>
            </div>
            <p className="text-sm text-white/50">
                {room?.now_playing
                    ? `${room.now_playing.title}${room.now_playing.artist ? ` · ${room.now_playing.artist}` : ''}`
                    : room
                      ? tr('Діджей ще обирає музику')
                      : tr(
                            'Один трек синхронно в усіх: діджей керує, решта пропонує треки й реагує.',
                        )}
            </p>
            {action}
            {status.can_manage && (
                <label className="flex items-center justify-between gap-2 text-xs text-white/45">
                    {tr('Хто відкриває кімнати')}
                    <select
                        value={status.policy ?? 'all'}
                        onChange={(e) =>
                            void api<Status>('PUT', `${url}/policy`, {
                                who: e.target.value,
                            })
                                .then((s) => {
                                    setStatus(s);
                                    toast.success(tr('Збережено'));
                                })
                                .catch((err: Error) => toast.error(err.message))
                        }
                        className="input-glass h-8 rounded-lg px-2 text-xs text-white"
                    >
                        {POLICIES.map((p) => (
                            <option key={p.key} value={p.key}>
                                {p.label()}
                            </option>
                        ))}
                    </select>
                </label>
            )}
        </section>
    );
}
