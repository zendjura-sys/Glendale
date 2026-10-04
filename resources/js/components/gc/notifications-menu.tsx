import { Link, usePage } from '@inertiajs/react';
import {
    AlarmClock,
    Bell,
    CalendarDays,
    ClipboardCheck,
    Crown,
    Gavel,
    Heart,
    Package,
    Wallet,
    ImageIcon,
    MessageSquare,
    PenSquare,
    Shield,
    ShieldCheck,
    UserCheck,
    UserPlus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';
import { UserAvatar } from './user-avatar';
import { tr } from '@/lib/i18n';

const kindIcon: Record<string, { icon: typeof Bell; className: string }> = {
    post_like: { icon: Heart, className: 'bg-rose-500' },
    post_comment: { icon: MessageSquare, className: 'bg-[#4f8bff]' },
    wall_post: { icon: PenSquare, className: 'bg-[#a855f7]' },
    friend_request: { icon: UserPlus, className: 'bg-emerald-500' },
    friend_accepted: { icon: UserCheck, className: 'bg-emerald-500' },
    community_request: { icon: Shield, className: 'bg-[#6d5dfc]' },
    community_approved: { icon: ShieldCheck, className: 'bg-[#6d5dfc]' },
    photo_like: { icon: Heart, className: 'bg-rose-500' },
    photo_comment: { icon: ImageIcon, className: 'bg-[#38bdf8]' },
    family_application: { icon: UserPlus, className: 'bg-amber-500' },
    family_accepted: { icon: Crown, className: 'bg-amber-500' },
    family_report: { icon: ClipboardCheck, className: 'bg-amber-500' },
    family_review: { icon: ClipboardCheck, className: 'bg-emerald-500' },
    family_cashout: { icon: Wallet, className: 'bg-emerald-500' },
    family_bank: { icon: Wallet, className: 'bg-emerald-500' },
    family_sanction: { icon: Gavel, className: 'bg-rose-500' },
    family_kicked: { icon: Gavel, className: 'bg-rose-500' },
    family_warehouse: { icon: Package, className: 'bg-rose-500' },
    family_event: { icon: CalendarDays, className: 'bg-[#6d5dfc]' },
    event_reminder: { icon: AlarmClock, className: 'bg-amber-500' },
};

const familyIcon = { icon: Crown, className: 'bg-amber-500' };

export function NotificationsMenu() {
    const { counters } = usePage().props;
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[] | null>(null);
    const [unread, setUnread] = useState(counters?.notifications ?? 0);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(
        () => setUnread(counters?.notifications ?? 0),
        [counters?.notifications],
    );

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (!boxRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        window.addEventListener('mousedown', onClick);

        return () => window.removeEventListener('mousedown', onClick);
    }, []);

    const toggle = () => {
        const next = !open;
        setOpen(next);

        if (next) {
            void api<{ notifications: NotificationItem[]; unread: number }>(
                'GET',
                '/notifications',
            ).then((response) => {
                setItems(response.notifications);

                if (response.unread > 0) {
                    void api('POST', '/notifications/read').then(() =>
                        setUnread(0),
                    );
                }
            });
        }
    };

    return (
        <div ref={boxRef} className="relative">
            <button
                type="button"
                onClick={toggle}
                className={cn(
                    'relative flex size-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.06] hover:text-white',
                    open && 'bg-white/[0.07] text-white',
                )}
                aria-label={tr('Сповіщення')}
            >
                <Bell className="size-[19px]" />
                {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] leading-4 font-bold text-white shadow-[0_0_12px_rgb(244_63_94/0.8)]">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        aria-label={tr('Закрити сповіщення')}
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-40 bg-[#05070f]/70 sm:hidden"
                    />
                    <div className="fixed inset-x-3 top-16 z-50 flex max-h-[min(70dvh,calc(100dvh-env(safe-area-inset-bottom)-8.5rem))] animate-rise flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101628] shadow-[0_24px_80px_-24px_rgb(0_0_0/0.9)] sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:max-h-[60vh] sm:w-[min(380px,calc(100vw-2rem))]">
                        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
                            <span className="font-display text-sm font-semibold">
                                {tr('Сповіщення')}
                            </span>
                        </div>
                        <div className="min-h-0 overflow-y-auto overscroll-contain p-1.5">
                            {items === null ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 px-2.5 py-2.5"
                                    >
                                        <span className="skeleton size-10 rounded-full" />
                                        <span className="flex-1 space-y-2">
                                            <span className="skeleton block h-3 w-3/4 rounded" />
                                            <span className="skeleton block h-3 w-1/3 rounded" />
                                        </span>
                                    </div>
                                ))
                            ) : items.length === 0 ? (
                                <div className="px-4 py-10 text-center">
                                    <Bell className="mx-auto mb-3 size-8 text-white/20" />
                                    <p className="text-sm text-white/50">
                                        {tr(
                                            "Поки що тихо. Тут з'являться лайки, коментарі та заявки.",
                                        )}
                                    </p>
                                </div>
                            ) : (
                                items.map((item) => {
                                    const meta =
                                        kindIcon[item.kind] ??
                                        (item.kind.startsWith('family_')
                                            ? familyIcon
                                            : {
                                                  icon: Bell,
                                                  className: 'bg-white/20',
                                              });
                                    const Icon = meta.icon;

                                    return (
                                        <Link
                                            key={item.id}
                                            href={item.url ?? '#'}
                                            onClick={() => setOpen(false)}
                                            className={cn(
                                                'flex gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/5',
                                                !item.read &&
                                                    'bg-[#4f8bff]/[0.06]',
                                            )}
                                        >
                                            <span className="relative">
                                                {item.actor ? (
                                                    <UserAvatar
                                                        user={item.actor}
                                                        size="md"
                                                        showOnline={false}
                                                    />
                                                ) : (
                                                    <span className="block size-11 rounded-full bg-white/5" />
                                                )}
                                                <span
                                                    className={cn(
                                                        'absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-[#0d1222]',
                                                        meta.className,
                                                    )}
                                                >
                                                    <Icon className="size-3 text-white" />
                                                </span>
                                            </span>
                                            <span className="min-w-0 flex-1 text-sm leading-snug break-words">
                                                <span className="font-semibold text-white">
                                                    {item.actor?.name}
                                                </span>{' '}
                                                <span className="text-white/70">
                                                    {item.text}
                                                </span>
                                                {item.excerpt && (
                                                    <span className="mt-0.5 block truncate text-xs text-white/45">
                                                        «{item.excerpt}»
                                                    </span>
                                                )}
                                                <span className="mt-1 block text-xs text-white/40">
                                                    {timeAgo(item.created_at)}
                                                </span>
                                            </span>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
