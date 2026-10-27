import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Hash,
    LogIn,
    Megaphone,
    MessageCircle,
    Send,
    UserPlus,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useRef } from 'react';
import { membersLabel } from '@/components/communities/community-card';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CommunityCard } from '@/types';

type GuestChannel = {
    id: number;
    name: string;
    type: 'text' | 'announcement';
    topic: string | null;
    guest_chat: boolean;
};

type GuestMessage = {
    id: number;
    type: string;
    body: string | null;
    created_at: string;
    author: {
        name: string;
        username: string;
        avatar_url: string | null;
    } | null;
    guest: string | null;
    bot: string | null;
    images: string[];
};

type Props = {
    community: CommunityCard & {
        description: string | null;
        created_at: string;
    };
    channels: GuestChannel[];
    channel_id: number | null;
    messages: GuestMessage[];
    can_write: boolean;
    guest_name: string | null;
};

const POLL_MS = 8000;

/** Спільнота для гостя без акаунта: опис, відкриті канали (читання) і гостьовий чат. */
export default function CommunityGuest({
    community,
    channels,
    channel_id,
    messages,
    can_write,
    guest_name,
}: Props) {
    const channel = channels.find((c) => c.id === channel_id) ?? null;
    const listRef = useRef<HTMLDivElement>(null);
    const form = useForm({ name: guest_name ?? '', body: '', website: '' });

    // Нові повідомлення підтягуються раз на кілька секунд, поки вкладка відкрита.
    useEffect(() => {
        if (!channel) return;
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') {
                router.reload({ only: ['messages'] });
            }
        }, POLL_MS);

        return () => clearInterval(timer);
    }, [channel]);

    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages.length, channel_id]);

    const send = (event: FormEvent) => {
        event.preventDefault();
        if (!channel) return;
        form.post(`/c/${community.slug}/guest/${channel.id}`, {
            preserveScroll: true,
            onSuccess: () => form.setData('body', ''),
        });
    };

    return (
        <>
            <Head title={community.name} />
            <div className="space-y-4">
                <section className="glass overflow-hidden rounded-2xl">
                    <div className="relative h-32 sm:h-40">
                        {community.cover_url ? (
                            <img
                                src={community.cover_url}
                                alt=""
                                className="absolute inset-0 size-full object-cover"
                            />
                        ) : (
                            <span className="absolute inset-0 bg-gradient-to-br from-gc-indigo/50 to-gc-cyan/30" />
                        )}
                    </div>
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
                        <CommunityAvatar
                            community={community}
                            size="xl"
                            className="-mt-16 shrink-0 sm:-mt-20"
                        />
                        <div className="min-w-0 flex-1">
                            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                                <span className="break-words">
                                    {community.name}
                                </span>
                                {community.is_verified && (
                                    <VerifiedBadge className="size-5 shrink-0" />
                                )}
                            </h1>
                            <p className="mt-1 text-sm text-white/55">
                                {[
                                    community.category_label,
                                    membersLabel(
                                        community.members_count,
                                        community.type === 'public',
                                    ),
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                            {community.description && (
                                <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-white/75">
                                    {community.description}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Link
                                href="/register"
                                className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                            >
                                <UserPlus className="size-4" />
                                {tr('Приєднатися')}
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                            >
                                <LogIn className="size-4" />
                                {tr('Увійти')}
                            </Link>
                        </div>
                    </div>
                </section>

                {channels.length > 0 && (
                    <div className="flex flex-col gap-4 md:flex-row">
                        <nav className="glass flex gap-1 overflow-x-auto rounded-2xl p-2 md:w-60 md:shrink-0 md:flex-col md:self-start">
                            {channels.map((item) => {
                                const Icon =
                                    item.type === 'announcement'
                                        ? Megaphone
                                        : Hash;

                                return (
                                    <Link
                                        key={item.id}
                                        href={`/c/${community.slug}/guest?channel=${item.id}`}
                                        preserveScroll
                                        className={cn(
                                            'flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition',
                                            item.id === channel_id
                                                ? 'bg-white/10 font-semibold text-white'
                                                : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                                        )}
                                    >
                                        <Icon className="size-4 shrink-0 opacity-70" />
                                        <span className="truncate">
                                            {item.name}
                                        </span>
                                        {item.guest_chat && (
                                            <span className="ml-auto rounded-full bg-emerald-400/15 px-1.5 text-[10px] leading-4 font-medium text-emerald-200">
                                                {tr('гості пишуть')}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {channel && (
                            <section className="glass flex h-[min(70dvh,640px)] min-w-0 flex-1 flex-col overflow-clip rounded-2xl">
                                <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-gc-lilac-300">
                                        {channel.type === 'announcement' ? (
                                            <Megaphone className="size-[18px]" />
                                        ) : (
                                            <Hash className="size-[18px]" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[15px] font-semibold text-white">
                                            {channel.name}
                                        </span>
                                        <span className="block truncate text-xs text-white/45">
                                            {channel.topic ??
                                                tr('Ви переглядаєте як гість')}
                                        </span>
                                    </span>
                                </header>

                                <div
                                    ref={listRef}
                                    className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
                                >
                                    {messages.length === 0 && (
                                        <p className="py-10 text-center text-sm text-white/45">
                                            {tr('Тут поки тихо.')}
                                        </p>
                                    )}
                                    {messages.map((message) => (
                                        <GuestLine
                                            key={message.id}
                                            message={message}
                                        />
                                    ))}
                                </div>

                                {can_write ? (
                                    <form
                                        onSubmit={send}
                                        className="space-y-2 border-t border-white/[0.06] p-3"
                                    >
                                        <input
                                            type="text"
                                            name="website"
                                            value={form.data.website}
                                            onChange={(e) =>
                                                form.setData(
                                                    'website',
                                                    e.target.value,
                                                )
                                            }
                                            tabIndex={-1}
                                            autoComplete="off"
                                            aria-hidden
                                            className="hidden"
                                        />
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <input
                                                value={form.data.name}
                                                onChange={(e) =>
                                                    form.setData(
                                                        'name',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder={tr('Ваше ім’я')}
                                                maxLength={24}
                                                className="input-glass h-11 rounded-xl px-3.5 text-sm text-white placeholder:text-white/35 focus:outline-none sm:w-44"
                                            />
                                            <div className="flex min-w-0 flex-1 gap-2">
                                                <input
                                                    value={form.data.body}
                                                    onChange={(e) =>
                                                        form.setData(
                                                            'body',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder={tr(
                                                        'Напишіть повідомлення…',
                                                    )}
                                                    maxLength={500}
                                                    className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={
                                                        form.processing ||
                                                        form.data.body.trim() ===
                                                            '' ||
                                                        form.data.name.trim()
                                                            .length < 2
                                                    }
                                                    aria-label={tr('Надіслати')}
                                                    className="btn-glow inline-flex size-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
                                                >
                                                    <Send className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {(form.errors.name ||
                                            form.errors.body ||
                                            form.errors.website) && (
                                            <p className="text-xs text-rose-300">
                                                {form.errors.name ??
                                                    form.errors.body ??
                                                    form.errors.website}
                                            </p>
                                        )}
                                    </form>
                                ) : (
                                    <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-3 text-sm text-white/55">
                                        <MessageCircle className="size-4 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            {tr(
                                                'Щоб писати в цьому каналі, увійдіть і вступіть у спільноту.',
                                            )}
                                        </span>
                                        <Link
                                            href="/login"
                                            className="shrink-0 font-semibold text-gc-lilac-300 hover:underline"
                                        >
                                            {tr('Увійти')}
                                        </Link>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function GuestLine({ message }: { message: GuestMessage }) {
    const time = new Date(message.created_at).toLocaleTimeString([], {
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="flex gap-3">
            {message.author ? (
                <UserAvatar
                    user={message.author}
                    size="xs"
                    className="size-8 shrink-0"
                />
            ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
                    {(message.guest ?? '?').slice(0, 1).toUpperCase()}
                </span>
            )}
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px]">
                    <span
                        className={cn(
                            'font-semibold',
                            message.author ? 'text-[#9fb0ff]' : 'text-white/70',
                        )}
                    >
                        {message.author?.name ??
                            message.bot ??
                            message.guest ??
                            tr('Гість')}
                    </span>
                    {!message.author && (
                        <span className="rounded-full bg-white/10 px-1.5 text-[10px] leading-4 text-white/55">
                            {message.bot ? tr('бот') : tr('гість')}
                        </span>
                    )}
                    <span className="text-[11px] text-white/35">{time}</span>
                </p>
                {message.body && (
                    <p className="mt-0.5 text-sm break-words whitespace-pre-line text-white/85">
                        {message.body}
                    </p>
                )}
                {message.type !== 'text' &&
                    !message.body &&
                    message.images.length === 0 && (
                        <p className="mt-0.5 text-sm text-white/40 italic">
                            {tr('Вкладення доступне учасникам')}
                        </p>
                    )}
                {message.images.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {message.images.map((url) => (
                            <img
                                key={url}
                                src={url}
                                alt=""
                                loading="lazy"
                                className="max-h-48 rounded-lg object-cover"
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
