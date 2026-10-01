import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRealtime } from '@/hooks/use-realtime';
import { inbox } from '@/lib/inbox';
import type { ChatMessage, InboxEvent } from '@/types';
import { UserAvatar } from './user-avatar';

export function messagePreview(message: {
    body: string | null;
    preview?: string | null;
    has_attachments?: boolean;
    attachments?: unknown[];
}): string {
    if (message.body) return message.body;
    if (message.preview) return message.preview;

    return message.has_attachments || message.attachments?.length
        ? 'Фотографія'
        : 'Повідомлення';
}

function notify(message: ChatMessage) {
    if (!message.user) return;
    const author = message.user;

    toast.custom(
        (id) => (
            <button
                type="button"
                onClick={() => {
                    toast.dismiss(id);
                    router.visit(`/messages/${message.conversation_id}`);
                }}
                className="glass-strong flex w-[356px] max-w-[92vw] items-center gap-3 rounded-2xl p-3 text-left shadow-[0_20px_50px_-20px_rgb(109_93_252/0.8)]"
            >
                <UserAvatar user={author} size="md" showOnline={false} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                        {author.name}
                    </span>
                    <span className="block truncate text-[13px] text-white/60">
                        {messagePreview(message)}
                    </span>
                </span>
                <span className="size-2 shrink-0 rounded-full bg-gradient-brand shadow-[0_0_10px_rgb(124_140_255)]" />
            </button>
        ),
        { duration: 5000 },
    );
}

/**
 * Персональний канал користувача: лічильник непрочитаних та тости про нові повідомлення.
 */
export function InboxListener({ userId }: { userId: number }) {
    const { counters } = usePage().props;
    const initial = counters?.messages ?? 0;

    useEffect(() => inbox.setUnread(initial), [initial]);

    useRealtime(`App.Models.User.${userId}`, {
        'inbox.updated': (event: InboxEvent) => {
            inbox.setUnread(event.unread_total);
            inbox.emit(event);

            const message = event.message;

            if (
                message &&
                message.type !== 'system' &&
                message.user?.id !== userId &&
                !event.is_muted &&
                inbox.active() !== event.conversation_id
            ) {
                notify(message);
            }
        },
    });

    return null;
}
