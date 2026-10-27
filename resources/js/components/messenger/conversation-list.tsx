import { Link } from '@inertiajs/react';
import {
    BellOff,
    MessagesSquare,
    PenSquare,
    Pin,
    Search,
    Star,
} from 'lucide-react';
import { useState } from 'react';
import { messagePreview } from '@/components/gc/inbox-listener';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { PlusBadge } from '@/components/gc/plus';
import { shortTime } from '@/lib/format';
import { usePlayer } from '@/lib/player';
import { cn, dockedAboveNav } from '@/lib/utils';
import type { ConversationSummary } from '@/types';
import { ConversationAvatar } from './conversation-avatar';
import { useStoredDraft } from '@/lib/drafts';
import { tr } from '@/lib/i18n';

function Preview({ conversation }: { conversation: ConversationSummary }) {
    const last = conversation.last_message;
    const draft = useStoredDraft(`chat:${conversation.id}`);

    // Незакінчене повідомлення — як у Telegram: «Чернетка: …».
    if (draft.trim()) {
        return (
            <span>
                <span className="text-rose-300">{tr('Чернетка:')}</span>{' '}
                {draft.split('\n')[0]}
            </span>
        );
    }

    if (!last) {
        return <span className="text-white/35">{tr('Немає повідомлень')}</span>;
    }

    if (last.type === 'system') {
        return <span className="text-white/45 italic">{last.body}</span>;
    }

    const prefix = last.is_own
        ? tr('Ви')
        : conversation.type === 'group'
          ? last.author
          : null;

    return (
        <>
            {prefix && <span className="text-white/75">{prefix}: </span>}
            <span className={cn(!last.body && 'text-[#9fb0ff]')}>
                {messagePreview(last)}
            </span>
        </>
    );
}

export function ConversationList({
    conversations,
    activeId,
    typing,
    onCompose,
    className,
}: {
    conversations: ConversationSummary[];
    activeId: number | null;
    typing: Record<number, string>;
    onCompose: () => void;
    className?: string;
}) {
    const [query, setQuery] = useState('');
    const playing = usePlayer().current !== null;
    const needle = query.trim().toLowerCase();
    const visible = needle
        ? conversations.filter((c) => c.title.toLowerCase().includes(needle))
        : conversations;

    return (
        <aside className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
                <h1 className="font-display text-lg font-semibold text-white">
                    {tr('Повідомлення')}
                </h1>
                <div className="flex items-center">
                    <Link
                        href="/messages/saved"
                        className="flex size-9 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                        aria-label={tr('Обрані')}
                        title={tr('Обрані')}
                    >
                        <Star className="size-[18px]" />
                    </Link>
                    <button
                        type="button"
                        onClick={onCompose}
                        className="flex size-9 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                        aria-label={tr('Нове повідомлення')}
                        title={tr('Нове повідомлення')}
                    >
                        <PenSquare className="size-[18px]" />
                    </button>
                </div>
            </div>
            <div className="px-3 pb-2">
                <label className="input-glass flex h-10 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/40" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={tr('Пошук')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                    />
                </label>
            </div>

            <div
                className={cn(
                    'min-h-0 flex-1 overflow-y-auto px-2',
                    dockedAboveNav(playing, 'lg:pb-2'),
                )}
            >
                {visible.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-14 text-center">
                        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                            <MessagesSquare className="size-7 text-white/25" />
                        </span>
                        <p className="text-sm text-white/50">
                            {needle
                                ? tr('Нічого не знайдено')
                                : tr('Тут з’являться ваші бесіди')}
                        </p>
                        {!needle && (
                            <button
                                type="button"
                                onClick={onCompose}
                                className="btn-glow mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
                            >
                                {tr('Написати повідомлення')}
                            </button>
                        )}
                    </div>
                ) : (
                    visible.map((conversation) => {
                        const active = conversation.id === activeId;
                        const typingName = typing[conversation.id];

                        return (
                            <Link
                                key={conversation.id}
                                href={`/messages/${conversation.id}`}
                                preserveScroll
                                className={cn(
                                    'group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition',
                                    active
                                        ? 'nav-active'
                                        : 'hover:bg-white/[0.04]',
                                )}
                            >
                                <ConversationAvatar
                                    conversation={conversation}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                        <span className="truncate text-[14px] font-semibold text-white">
                                            {conversation.title}
                                        </span>
                                        {conversation.peer?.is_verified && (
                                            <VerifiedBadge className="size-3.5 shrink-0" />
                                        )}
                                        {conversation.peer?.plus && (
                                            <PlusBadge className="size-3.5" />
                                        )}
                                        {conversation.pinned && (
                                            <Pin className="size-3.5 shrink-0 fill-current text-white/70" />
                                        )}
                                        {conversation.is_muted && (
                                            <BellOff className="size-3.5 shrink-0 text-white/35" />
                                        )}
                                        {conversation.last_message && (
                                            <span className="ml-auto shrink-0 pl-2 text-xs text-white/40">
                                                {shortTime(
                                                    conversation.last_message
                                                        .created_at,
                                                )}
                                            </span>
                                        )}
                                    </span>
                                    <span className="mt-0.5 flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-[13px] text-white/50">
                                            {conversation.folder && (
                                                <span className="text-white/35">
                                                    {conversation.folder} ·{' '}
                                                </span>
                                            )}
                                            {typingName ? (
                                                <span className="text-[#8fd8ff]">
                                                    {conversation.type ===
                                                    'group'
                                                        ? tr(
                                                              '{typingName} друкує…',
                                                              { typingName },
                                                          )
                                                        : tr('друкує…')}
                                                </span>
                                            ) : (
                                                <Preview
                                                    conversation={conversation}
                                                />
                                            )}
                                        </span>
                                        {conversation.unread > 0 && (
                                            <span
                                                className={cn(
                                                    'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white',
                                                    conversation.is_muted
                                                        ? 'bg-white/20'
                                                        : 'bg-gradient-brand shadow-[0_0_12px_rgb(124_140_255/0.7)]',
                                                )}
                                            >
                                                {conversation.unread > 99
                                                    ? '99+'
                                                    : conversation.unread}
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </Link>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
