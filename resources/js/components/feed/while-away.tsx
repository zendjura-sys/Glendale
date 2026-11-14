import { Link } from '@inertiajs/react';
import { Bell, Heart, Music, Newspaper, UserPlus, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type WhileAwayData = {
    hours: number;
    posts: number;
    requests: number;
    notifications: number;
    tracks: number;
    top: {
        id: number;
        author: UserCard | null;
        excerpt: string;
        likes: number;
    }[];
};

function away(hours: number): string {
    if (hours < 48) return tr('{n} год', { n: hours });

    return tr('{n} дн.', { n: Math.floor(hours / 24) });
}

/** «Поки вас не було»: що нового за час відсутності (понад 12 годин); можна закрити. */
export function WhileAway({ data }: { data: WhileAwayData | null }) {
    const [open, setOpen] = useState(true);
    const reduce = useReducedMotion();
    if (!data) return null;

    const chips = [
        data.posts > 0 && {
            href: '#feed',
            icon: Newspaper,
            label: tr('{n} записів друзів', { n: data.posts }),
        },
        data.requests > 0 && {
            href: '/friends?tab=requests',
            icon: UserPlus,
            label: tr('{n} заявок у друзі', { n: data.requests }),
        },
        data.notifications > 0 && {
            href: '/notifications',
            icon: Bell,
            label: tr('{n} сповіщень', { n: data.notifications }),
        },
        data.tracks > 0 && {
            href: '/music',
            icon: Music,
            label: tr('{n} нових треків друзів', { n: data.tracks }),
        },
    ].filter(Boolean) as { href: string; icon: typeof Bell; label: string }[];

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.section
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    aria-label={tr('Поки вас не було')}
                    className="gc-solid overflow-hidden rounded-2xl p-4"
                >
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <h2 className="font-display text-lg font-bold text-white">
                                {tr('Поки вас не було')}
                            </h2>
                            <p className="text-sm text-white/55">
                                {tr('Вас не було {time} — ось що нового.', {
                                    time: away(data.hours),
                                })}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label={tr('Закрити')}
                            className="grid size-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {chips.map((c) => (
                            <Link
                                key={c.href}
                                href={c.href}
                                className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-sm font-medium text-white/85 transition hover:bg-white/[0.1] hover:text-white"
                            >
                                <c.icon className="size-4 text-primary" />
                                {c.label}
                            </Link>
                        ))}
                    </div>

                    {data.top.length > 0 && (
                        <ul className="mt-3 divide-y divide-white/[0.06]">
                            {data.top.map((p) => (
                                <li key={p.id}>
                                    <Link
                                        href={`/posts/${p.id}`}
                                        className="flex items-center gap-3 py-2.5 transition hover:opacity-90"
                                    >
                                        {p.author && (
                                            <UserAvatar
                                                user={p.author}
                                                size="sm"
                                            />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-white">
                                                {p.author?.name}
                                            </span>
                                            <span className="block truncate text-sm text-white/60">
                                                {p.excerpt ||
                                                    tr('Запис із фото')}
                                            </span>
                                        </span>
                                        {p.likes > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs text-white/50 tabular-nums">
                                                <Heart className="size-3.5" />
                                                {p.likes}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </motion.section>
            )}
        </AnimatePresence>
    );
}
