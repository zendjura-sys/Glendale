import { usePage } from '@inertiajs/react';
import {
    ImagePlus,
    Lock,
    Pencil,
    Reply,
    SendHorizonal,
    Smile,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const EMOJI = [
    '😀',
    '😂',
    '🤣',
    '😊',
    '😍',
    '🥰',
    '😘',
    '😎',
    '🤩',
    '🥳',
    '😏',
    '🤔',
    '🙄',
    '😴',
    '😢',
    '😭',
    '😡',
    '🤯',
    '😱',
    '🤗',
    '🙏',
    '👍',
    '👎',
    '👏',
    '🙌',
    '💪',
    '🤝',
    '✌️',
    '👀',
    '🔥',
    '✨',
    '⚡',
    '💯',
    '❤️',
    '💜',
    '💙',
    '💔',
    '🎮',
    '🕹️',
    '🏆',
    '🎉',
    '🎁',
    '🍕',
    '☕',
    '🚀',
    '🌙',
    '⭐',
    '🌈',
];

const MAX_IMAGES = 10;
const MAX_LENGTH = 4096;

type Props = {
    canWrite: boolean;
    replyTo: ChatMessage | null;
    editing: ChatMessage | null;
    onCancel: () => void;
    onSend: (body: string, files: File[]) => void;
    onEdit: (message: ChatMessage, body: string) => void;
    onTyping: () => void;
    onEditLast: () => void;
};

export function Composer({
    canWrite,
    replyTo,
    editing,
    onCancel,
    onSend,
    onEdit,
    onTyping,
    onEditLast,
}: Props) {
    const { site } = usePage().props;
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);
    const maxImages = Math.min(MAX_IMAGES, site.max_attachments || MAX_IMAGES);

    const previews = useMemo(
        () => files.map((file) => URL.createObjectURL(file)),
        [files],
    );
    useEffect(
        () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
        [previews],
    );

    const resize = () => {
        const el = textRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    };

    const editingId = editing?.id;
    useEffect(() => {
        if (editingId === undefined) return;
        setBody(editing?.body ?? '');
        setFiles([]);
        requestAnimationFrame(() => {
            resize();
            textRef.current?.focus();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingId]);

    const replyId = replyTo?.id;
    useEffect(() => {
        if (replyId !== undefined) textRef.current?.focus();
    }, [replyId]);

    useEffect(() => {
        if (!emojiOpen) return;
        const onClick = (event: MouseEvent) => {
            if (!emojiRef.current?.contains(event.target as Node)) {
                setEmojiOpen(false);
            }
        };
        window.addEventListener('mousedown', onClick);

        return () => window.removeEventListener('mousedown', onClick);
    }, [emojiOpen]);

    const addFiles = (list: FileList | File[] | null) => {
        if (!list || editing) return;
        const images = Array.from(list).filter((file) =>
            file.type.startsWith('image/'),
        );
        if (images.length) {
            setFiles((current) => [...current, ...images].slice(0, maxImages));
        }
    };

    const trimmed = body.trim();
    const canSubmit = editing
        ? trimmed.length > 0 && trimmed !== editing.body
        : trimmed.length > 0 || files.length > 0;

    const reset = () => {
        setBody('');
        setFiles([]);
        requestAnimationFrame(resize);
    };

    const submit = () => {
        if (!canSubmit) {
            if (editing && trimmed === editing.body) {
                onCancel();
                reset();
            }

            return;
        }

        if (editing) {
            onEdit(editing, trimmed);
        } else {
            onSend(trimmed, files);
        }

        reset();
    };

    const insertEmoji = (emoji: string) => {
        const el = textRef.current;
        const start = el?.selectionStart ?? body.length;
        const end = el?.selectionEnd ?? body.length;
        const next = body.slice(0, start) + emoji + body.slice(end);
        setBody(next);
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(start + emoji.length, start + emoji.length);
            resize();
        });
    };

    if (!canWrite) {
        return (
            <div className="border-t border-white/[0.06] px-4 py-4">
                <p className="flex items-center justify-center gap-2 text-center text-sm text-white/45">
                    <Lock className="size-4" />
                    Користувач обмежив коло осіб, які можуть надсилати йому
                    повідомлення.
                </p>
            </div>
        );
    }

    const context = editing ?? replyTo;

    return (
        <div
            className="relative border-t border-white/[0.06] bg-[#070a16]/40 px-3 pt-2 pb-3 sm:px-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
            }}
        >
            {context && (
                <div className="mb-2 flex animate-in items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 fade-in slide-in-from-bottom-1">
                    {editing ? (
                        <Pencil className="size-4 shrink-0 text-[#8fa0ff]" />
                    ) : (
                        <Reply className="size-4 shrink-0 text-[#8fa0ff]" />
                    )}
                    <span className="min-w-0 flex-1 border-l-2 border-[#7c8cff] pl-2.5 text-[13px]">
                        <span className="block font-semibold text-[#a9b6ff]">
                            {editing
                                ? 'Редагування'
                                : (context.user?.first_name ?? 'Повідомлення')}
                        </span>
                        <span className="block truncate text-white/55">
                            {context.body ||
                                (context.attachments.length
                                    ? 'Фотографія'
                                    : '')}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            if (editing) reset();
                            onCancel();
                        }}
                        className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                        aria-label="Скасувати"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}

            {previews.length > 0 && (
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    {previews.map((url, index) => (
                        <div
                            key={url}
                            className="relative size-[72px] shrink-0 animate-in overflow-hidden rounded-xl ring-1 ring-white/10 zoom-in-90"
                        >
                            <img
                                src={url}
                                alt=""
                                className="size-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setFiles((current) =>
                                        current.filter((_, i) => i !== index),
                                    )
                                }
                                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                                aria-label="Прибрати"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-end gap-1.5">
                {!editing && (
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={files.length >= maxImages}
                        className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
                        aria-label="Додати фото"
                        title="Додати фото"
                    >
                        <ImagePlus className="size-5" />
                    </button>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => {
                        addFiles(event.target.files);
                        event.target.value = '';
                    }}
                />

                <div className="input-glass flex min-w-0 flex-1 items-end rounded-[22px] pr-1">
                    <textarea
                        ref={textRef}
                        value={body}
                        rows={1}
                        maxLength={MAX_LENGTH}
                        onChange={(event) => {
                            setBody(event.target.value);
                            resize();
                            if (event.target.value) onTyping();
                        }}
                        onPaste={(event) => {
                            const pasted = Array.from(
                                event.clipboardData.files,
                            );
                            if (pasted.length) {
                                event.preventDefault();
                                addFiles(pasted);
                            }
                        }}
                        onKeyDown={(event) => {
                            if (
                                event.key === 'Enter' &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault();
                                submit();
                            } else if (event.key === 'Escape' && context) {
                                if (editing) reset();
                                onCancel();
                            } else if (
                                event.key === 'ArrowUp' &&
                                !body &&
                                !editing
                            ) {
                                onEditLast();
                            }
                        }}
                        placeholder="Напишіть повідомлення…"
                        className="max-h-[180px] min-h-11 min-w-0 flex-1 resize-none bg-transparent py-[11px] pl-4 text-[14.5px] leading-[1.45] text-white placeholder:text-white/35 focus:outline-none"
                    />
                    <div ref={emojiRef} className="relative mb-1">
                        <button
                            type="button"
                            onClick={() => setEmojiOpen((value) => !value)}
                            className={cn(
                                'flex size-9 items-center justify-center rounded-full text-white/50 transition hover:text-white',
                                emojiOpen && 'text-[#ffd36b]',
                            )}
                            aria-label="Емодзі"
                        >
                            <Smile className="size-5" />
                        </button>
                        {emojiOpen && (
                            <div className="glass-strong absolute right-0 bottom-12 z-30 grid w-[296px] animate-rise grid-cols-8 gap-0.5 rounded-2xl p-2">
                                {EMOJI.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => insertEmoji(emoji)}
                                        className="flex size-8 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-white/10"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className={cn(
                        'mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-white transition duration-300',
                        canSubmit
                            ? 'scale-100 bg-gradient-brand shadow-[0_0_24px_-2px_rgb(124_92_255/0.9)] hover:brightness-110'
                            : 'scale-95 bg-white/[0.06] text-white/35',
                    )}
                    aria-label={editing ? 'Зберегти' : 'Надіслати'}
                >
                    <SendHorizonal className="size-5" />
                </button>
            </div>
        </div>
    );
}
