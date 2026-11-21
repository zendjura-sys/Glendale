import { Link } from '@inertiajs/react';
import {
    Activity,
    Clapperboard,
    Gamepad2,
    LayoutList,
    ListVideo,
    Shield,
    Star,
    UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Target = { title: string; href: string; cover: string | null };

type Item = {
    id: string;
    kind: string;
    at: string;
    user: UserCard;
    game?: Target | null;
    movie?: Target;
    score?: number;
    excerpt?: string | null;
    title?: string;
    count?: number;
    href?: string;
    other?: UserCard;
    community?: { name: string; href: string; avatar: string | null };
};

/** Що зробив друг: дієслово, значок і посилання на предмет дії. */
function describe(item: Item): {
    icon: LucideIcon;
    text: string;
    target: { title: string; href: string } | null;
} {
    switch (item.kind) {
        case 'backlog.playing':
            return {
                icon: Gamepad2,
                text: tr('почав грати в'),
                target: item.game ?? null,
            };
        case 'backlog.done':
            return {
                icon: Gamepad2,
                text: tr('пройшов'),
                target: item.game ?? null,
            };
        case 'backlog.want':
            return {
                icon: Gamepad2,
                text: tr('хоче зіграти в'),
                target: item.game ?? null,
            };
        case 'backlog.dropped':
            return {
                icon: Gamepad2,
                text: tr('закинув'),
                target: item.game ?? null,
            };
        case 'game_review':
            return {
                icon: Star,
                text: tr('написав відгук про'),
                target: item.game ?? null,
            };
        case 'movie_review':
            return {
                icon: Clapperboard,
                text: tr('оцінив'),
                target: item.movie ?? null,
            };
        case 'movie_list':
            return {
                icon: ListVideo,
                text: tr('зібрав добірку'),
                target: item.href
                    ? { title: item.title ?? '', href: item.href }
                    : null,
            };
        case 'tier_list':
            return {
                icon: LayoutList,
                text: tr('склав тір-лист'),
                target: item.href
                    ? { title: item.title ?? '', href: item.href }
                    : null,
            };
        case 'friend':
            return {
                icon: UserPlus,
                text: tr('тепер дружить з'),
                target: item.other
                    ? {
                          title: item.other.name,
                          href: `/${item.other.username}`,
                      }
                    : null,
            };
        case 'community':
            return {
                icon: Shield,
                text: tr('вступив у спільноту'),
                target: item.community
                    ? { title: item.community.name, href: item.community.href }
                    : null,
            };
        default:
            return { icon: Activity, text: '', target: null };
    }
}

/** Вкладка «Активність»: стрічка дій друзів за тиждень, згрупована за днями, з догрузкою. */
export function FriendActivity() {
    const reduce = useReducedMotion();
    const [items, setItems] = useState<Item[] | null>(null);
    const [more, setMore] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api<{ items: Item[] }>('GET', '/feed/activity')
            .then((d) => {
                setItems(d.items);
                setMore(d.items.length >= 40);
            })
            .catch(() => setItems([]));
    }, []);

    const loadMore = () => {
        if (!items?.length || busy) return;
        setBusy(true);
        api<{ items: Item[] }>(
            'GET',
            `/feed/activity?before=${encodeURIComponent(items[items.length - 1].at)}`,
        )
            .then((d) => {
                setItems([...items, ...d.items]);
                setMore(d.items.length >= 40);
            })
            .catch(() => setMore(false))
            .finally(() => setBusy(false));
    };

    if (items === null) {
        return (
            <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="gc-solid h-[72px] animate-pulse rounded-2xl"
                    />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <EmptyState
                icon={Activity}
                title={tr('Друзі поки нічого не робили')}
                text={tr(
                    'Тут з’являтимуться їхні ігри, відгуки, добірки й нові знайомства за тиждень.',
                )}
            />
        );
    }

    return (
        <section
            aria-label={tr('Активність друзів')}
            className="gc-solid rounded-2xl p-2 sm:p-3"
        >
            <ul className="divide-y divide-white/[0.06]">
                {items.map((item, i) => {
                    const d = describe(item);
                    const cover =
                        item.game?.cover ??
                        item.movie?.cover ??
                        item.community?.avatar ??
                        null;

                    return (
                        <motion.li
                            key={item.id}
                            initial={reduce ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                delay: reduce ? 0 : Math.min(i, 10) * 0.03,
                            }}
                            className="flex items-center gap-3 px-2 py-3"
                        >
                            <span className="relative shrink-0">
                                <UserAvatar user={item.user} size="md" />
                                <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-primary text-white ring-2 ring-[var(--gc-surface,#0b1020)]">
                                    <d.icon className="size-3" />
                                </span>
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm leading-snug text-white/75">
                                    <Link
                                        href={`/${item.user.username}`}
                                        className="font-semibold text-white hover:underline"
                                    >
                                        {item.user.name}
                                    </Link>{' '}
                                    {d.text}{' '}
                                    {d.target && (
                                        <Link
                                            href={d.target.href}
                                            className="font-semibold text-white hover:underline"
                                        >
                                            {d.target.title}
                                        </Link>
                                    )}
                                    {item.score !== undefined && (
                                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-amber-400/15 px-1.5 text-xs font-bold text-amber-300 tabular-nums">
                                            <Star className="size-3 fill-current" />
                                            {item.score}/10
                                        </span>
                                    )}
                                </p>
                                {item.excerpt && (
                                    <p className="mt-0.5 line-clamp-2 text-sm text-white/50">
                                        {item.excerpt}
                                    </p>
                                )}
                                <p className="mt-0.5 text-xs text-white/40">
                                    {timeAgo(item.at)}
                                </p>
                            </div>
                            {cover && (
                                <img
                                    src={cover}
                                    alt=""
                                    loading="lazy"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                    className="h-14 w-10 shrink-0 rounded-lg object-cover"
                                />
                            )}
                        </motion.li>
                    );
                })}
            </ul>
            {more && (
                <button
                    type="button"
                    onClick={loadMore}
                    disabled={busy}
                    className="mt-1 h-10 w-full rounded-xl text-sm font-semibold text-primary transition hover:bg-white/[0.04] disabled:opacity-50"
                >
                    {tr('Показати раніше')}
                </button>
            )}
        </section>
    );
}
