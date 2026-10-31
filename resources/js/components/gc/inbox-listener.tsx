import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtime } from '@/hooks/use-realtime';
import { inbox } from '@/lib/inbox';
import { playNotifySound, unlockSoundOnGesture } from '@/lib/sounds';
import type { ChatMessage, InboxEvent } from '@/types';
import { UserAvatar } from './user-avatar';
import { tr } from '@/lib/i18n';

export function messagePreview(message: {
    body: string | null;
    preview?: string | null;
    has_attachments?: boolean;
    attachments?: unknown[];
}): string {
    if (message.body) return message.body;
    if (message.preview) return message.preview;

    return message.has_attachments || message.attachments?.length
        ? tr('Фотографія')
        : tr('Повідомлення');
}

function notify(message: ChatMessage) {
    if (!message.user) return;
    const author = message.user;

    // Той самий вигляд, що й решта тостів (.gc-toast): аватар замість іконки, ім'я, текст і хрестик.
    toast.custom(
        (id) => (
            <>
                <button
                    type="button"
                    onClick={() => {
                        toast.dismiss(id);
                        router.visit(`/messages/${message.conversation_id}`);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                    <UserAvatar user={author} size="sm" showOnline={false} />
                    <span className="gc-toast__content">
                        <span className="gc-toast__title truncate">
                            {author.name}
                        </span>
                        <span className="gc-toast__description truncate">
                            {messagePreview(message)}
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    aria-label={tr('Закрити')}
                    onClick={() => toast.dismiss(id)}
                    data-close-button
                    className="gc-toast__close"
                >
                    <X />
                </button>
            </>
        ),
        { duration: 5000 },
    );
}

/**
 * Персональний канал користувача: лічильник непрочитаних та тости про нові повідомлення.
 */
export function InboxListener({ userId }: { userId: number }) {
    const { counters, auth } = usePage().props;
    const initial = counters?.messages ?? 0;
    const sound = auth.user?.notify_sound;

    useEffect(() => inbox.setUnread(initial), [initial]);
    useEffect(unlockSoundOnGesture, []);

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
                playNotifySound(sound);
            }
        },
    });

    return null;
}
