import { Link } from '@inertiajs/react';
import {
    AlertCircle,
    Check,
    CheckCheck,
    Clock3,
    Copy,
    Pencil,
    Reply,
    RotateCw,
    Trash2,
} from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { clockTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ChatAttachment, ChatMessage } from '@/types';

export type BubbleActions = {
    onReply: (message: ChatMessage) => void;
    onEdit: (message: ChatMessage) => void;
    onDelete: (message: ChatMessage) => void;
    onRetry: (message: ChatMessage) => void;
    onCopy: (message: ChatMessage) => void;
    onJump: (id: number) => void;
    onOpenImage: (items: ChatAttachment[], index: number) => void;
    onMediaLoad: () => void;
};

type Props = {
    message: ChatMessage;
    own: boolean;
    read: boolean;
    showAuthor: boolean;
    showAvatar: boolean;
    groupStart: boolean;
    groupEnd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    highlighted: boolean;
    actions: BubbleActions;
};

function Images({
    items,
    onOpen,
    onLoad,
}: {
    items: ChatAttachment[];
    onOpen: (index: number) => void;
    onLoad: () => void;
}) {
    if (items.length === 1) {
        const [image] = items;
        const ratio =
            image.width && image.height ? image.width / image.height : 4 / 3;

        return (
            <button
                type="button"
                onClick={() => onOpen(0)}
                className="block overflow-hidden rounded-[14px]"
                style={{
                    width: `min(320px, 62vw, ${Math.round(360 * ratio)}px)`,
                    aspectRatio: String(ratio),
                }}
            >
                <img
                    src={image.url}
                    alt=""
                    onLoad={onLoad}
                    className="size-full object-cover transition duration-300 hover:scale-[1.03]"
                />
            </button>
        );
    }

    return (
        <div
            className={cn(
                'grid w-[min(320px,62vw)] gap-1 overflow-hidden rounded-[14px]',
                items.length === 2 || items.length === 4
                    ? 'grid-cols-2'
                    : 'grid-cols-3',
            )}
        >
            {items.map((image, index) => (
                <button
                    key={image.id}
                    type="button"
                    onClick={() => onOpen(index)}
                    className="aspect-square overflow-hidden"
                >
                    <img
                        src={image.url}
                        alt=""
                        onLoad={onLoad}
                        className="size-full object-cover transition duration-300 hover:scale-105"
                    />
                </button>
            ))}
        </div>
    );
}

export function SystemMessage({ message }: { message: ChatMessage }) {
    return (
        <div className="flex justify-center py-1.5">
            <span className="rounded-full bg-white/[0.05] px-3 py-1 text-center text-xs text-white/50">
                {message.body}
            </span>
        </div>
    );
}

export function MessageBubble({
    message,
    own,
    read,
    showAuthor,
    showAvatar,
    groupStart,
    groupEnd,
    canEdit,
    canDelete,
    highlighted,
    actions,
}: Props) {
    const hasImages = message.attachments.length > 0;
    const onlyImages = hasImages && !message.body && !message.reply_to;
    const pending = message.pending;

    const meta = (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-[11px] leading-none select-none',
                onlyImages
                    ? 'rounded-full bg-black/45 px-2 py-1 text-white/90 backdrop-blur'
                    : own
                      ? 'text-white/70'
                      : 'text-white/40',
            )}
        >
            {message.edited_at && <span>ред.</span>}
            {clockTime(message.created_at)}
            {own &&
                (pending === 'sending' ? (
                    <Clock3 className="size-3" />
                ) : pending === 'failed' ? (
                    <AlertCircle className="size-3.5 text-rose-300" />
                ) : read ? (
                    <CheckCheck className="size-3.5 text-[#8fe3ff] drop-shadow-[0_0_4px_rgb(56_225_255/0.8)]" />
                ) : (
                    <Check className="size-3.5" />
                ))}
        </span>
    );

    const toolButton =
        'flex size-7 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white';

    return (
        <div
            id={`message-${message.id}`}
            className={cn(
                'group/msg flex items-end gap-2 px-3 sm:px-5',
                own ? 'flex-row-reverse' : 'flex-row',
                groupStart ? 'mt-2.5' : 'mt-0.5',
            )}
        >
            {!own && (
                <span className="w-8 shrink-0">
                    {showAvatar && message.user && (
                        <Link href={`/${message.user.username}`}>
                            <UserAvatar
                                user={message.user}
                                size="xs"
                                showOnline={false}
                                className="size-8"
                            />
                        </Link>
                    )}
                </span>
            )}

            <div
                className={cn(
                    'flex max-w-[min(78%,560px)] min-w-0 flex-col',
                    own ? 'items-end' : 'items-start',
                )}
            >
                <div
                    className={cn(
                        'relative min-w-0 transition-shadow duration-500',
                        onlyImages
                            ? 'overflow-hidden rounded-[18px]'
                            : cn(
                                  'rounded-[20px] px-3.5 py-2',
                                  own
                                      ? 'bg-gradient-to-br from-[#4f6bff] via-[#6d5dfc] to-[#8b5cf6] text-white shadow-[0_8px_24px_-12px_rgb(109_93_252/0.9)]'
                                      : 'border border-white/[0.07] bg-white/[0.06] text-white/90 backdrop-blur-xl',
                                  own
                                      ? groupEnd
                                          ? 'rounded-br-md'
                                          : 'rounded-tr-md rounded-br-md'
                                      : groupEnd
                                        ? 'rounded-bl-md'
                                        : 'rounded-tl-md rounded-bl-md',
                                  !groupStart &&
                                      (own ? 'rounded-tr-md' : 'rounded-tl-md'),
                              ),
                        hasImages && !onlyImages && 'pt-1.5 pr-1.5 pl-1.5',
                        pending === 'sending' && 'opacity-80',
                        highlighted &&
                            'shadow-[0_0_30px_rgb(124_140_255/0.6)] ring-2 ring-[#8fa0ff]',
                    )}
                >
                    {showAuthor && message.user && (
                        <Link
                            href={`/${message.user.username}`}
                            className={cn(
                                'mb-0.5 block text-[13px] font-semibold text-[#9fb0ff] hover:underline',
                                hasImages && 'px-2 pt-0.5',
                            )}
                        >
                            {message.user.first_name}
                        </Link>
                    )}

                    {message.reply_to && (
                        <button
                            type="button"
                            onClick={() =>
                                message.reply_to &&
                                actions.onJump(message.reply_to.id)
                            }
                            className={cn(
                                'mb-1.5 block w-full min-w-0 rounded-lg border-l-2 py-1 pr-2 pl-2 text-left text-[13px] transition',
                                own
                                    ? 'border-white/70 bg-white/15 hover:bg-white/20'
                                    : 'border-[#7c8cff] bg-[#7c8cff]/10 hover:bg-[#7c8cff]/15',
                                hasImages && 'mx-0.5 mt-0.5 w-[calc(100%-4px)]',
                            )}
                        >
                            <span
                                className={cn(
                                    'block truncate font-semibold',
                                    own ? 'text-white' : 'text-[#a9b6ff]',
                                )}
                            >
                                {message.reply_to.author ?? 'Повідомлення'}
                            </span>
                            <span className="block truncate opacity-75">
                                {message.reply_to.deleted
                                    ? 'Повідомлення видалено'
                                    : message.reply_to.body ||
                                      (message.reply_to.has_attachments
                                          ? 'Фотографія'
                                          : '')}
                            </span>
                        </button>
                    )}

                    {hasImages && (
                        <div className="relative">
                            <Images
                                items={message.attachments}
                                onOpen={(index) =>
                                    actions.onOpenImage(
                                        message.attachments,
                                        index,
                                    )
                                }
                                onLoad={actions.onMediaLoad}
                            />
                            {onlyImages && (
                                <span className="absolute right-2 bottom-2">
                                    {meta}
                                </span>
                            )}
                        </div>
                    )}

                    {!onlyImages && (
                        <div
                            className={cn(
                                'text-[14.5px] leading-[1.45]',
                                hasImages && 'px-2 pt-1.5 pb-1.5',
                            )}
                        >
                            {message.body && (
                                <span className="break-words whitespace-pre-wrap">
                                    {message.body}
                                </span>
                            )}
                            <span className="float-right mt-1.5 ml-2.5 translate-y-0.5">
                                {meta}
                            </span>
                        </div>
                    )}
                </div>

                {pending === 'failed' && (
                    <button
                        type="button"
                        onClick={() => actions.onRetry(message)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
                    >
                        <RotateCw className="size-3" /> Не надіслано. Повторити
                    </button>
                )}
            </div>

            {!pending && (
                <div
                    className={cn(
                        'mb-1 flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.06] bg-[#0d1222]/90 p-0.5 opacity-0 shadow-lg backdrop-blur transition group-hover/msg:opacity-100 focus-within:opacity-100',
                        own && 'flex-row-reverse',
                    )}
                >
                    <button
                        type="button"
                        className={toolButton}
                        onClick={() => actions.onReply(message)}
                        title="Відповісти"
                    >
                        <Reply className="size-4" />
                    </button>
                    {message.body && (
                        <button
                            type="button"
                            className={toolButton}
                            onClick={() => actions.onCopy(message)}
                            title="Копіювати"
                        >
                            <Copy className="size-3.5" />
                        </button>
                    )}
                    {canEdit && (
                        <button
                            type="button"
                            className={toolButton}
                            onClick={() => actions.onEdit(message)}
                            title="Редагувати"
                        >
                            <Pencil className="size-3.5" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            className={cn(toolButton, 'hover:text-rose-300')}
                            onClick={() => actions.onDelete(message)}
                            title="Видалити"
                        >
                            <Trash2 className="size-3.5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
