import { usePage } from '@inertiajs/react';
import {
    Clock,
    FileUp,
    ImagePlus,
    LayoutGrid,
    Lock,
    Mic,
    Paperclip,
    Pencil,
    Reply,
    SendHorizonal,
    Smile,
    Timer,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { api } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/format';
import { usePlayer } from '@/lib/player';
import { fitTextarea } from '@/lib/textarea';
import { cn, dockedAboveNav } from '@/lib/utils';
import type { ChatMessage, OutgoingMessage } from '@/types';
import { ContactShareDialog } from './contact-share-dialog';
import { EmojiPanel } from './emoji-panel';
import { LOCALE, tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

const MAX_ATTACHMENTS = 10;
const MAX_LENGTH = 4096;

type Props = {
    canWrite: boolean;
    replyTo: ChatMessage | null;
    editing: ChatMessage | null;
    onCancel: () => void;
    onSend: (message: OutgoingMessage) => void;
    onEdit: (message: ChatMessage, body: string) => void;
    onTyping: () => void;
    onEditLast: () => void;
    draft?: string | null;
};

function useOutsideClose(
    open: boolean,
    ref: React.RefObject<HTMLElement | null>,
    close: () => void,
) {
    useEffect(() => {
        if (!open) return;
        const onClick = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) close();
        };
        window.addEventListener('mousedown', onClick);

        return () => window.removeEventListener('mousedown', onClick);
    }, [open, ref, close]);
}

export function Composer({
    canWrite,
    replyTo,
    editing,
    onCancel,
    onSend,
    onEdit,
    onTyping,
    onEditLast,
    draft = null,
}: Props) {
    const { site } = usePage().props;
    const vanishOn = usePlugin('disappearing_messages');
    const scheduleOn = usePlugin('scheduled_messages');
    const [body, setBody] = useState(draft ?? '');
    const [publishAt, setPublishAt] = useState('');
    const [vanish, setVanish] = useState(false);
    const [card, setCard] = useState<{
        kind: string;
        id: number;
        title: string;
        hint: string;
        href: string;
        image: string | null;
    } | null>(null);
    const [cardQuery, setCardQuery] = useState('');
    const [cardHits, setCardHits] = useState<NonNullable<typeof card>[]>([]);
    const [pickingCard, setPickingCard] = useState(false);
    const [images, setImages] = useState<File[]>([]);
    const [docs, setDocs] = useState<File[]>([]);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [attachOpen, setAttachOpen] = useState(false);
    const [sendMenu, setSendMenu] = useState(false);
    const sendRef = useRef<HTMLDivElement>(null);
    const sendTimer = useRef<number | null>(null);
    const sendHeld = useRef(false);
    const [contactOpen, setContactOpen] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const imageRef = useRef<HTMLInputElement>(null);
    const docRef = useRef<HTMLInputElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);
    const attachRef = useRef<HTMLDivElement>(null);
    const maxAttachments = Math.min(
        MAX_ATTACHMENTS,
        site.max_attachments || MAX_ATTACHMENTS,
    );
    const maxFileBytes = (site.max_message_file_mb || 50) * 1024 * 1024;

    const voice = useVoiceRecorder((recording) =>
        onSend({ kind: 'voice', ...recording }),
    );
    const playing = usePlayer().current !== null;

    const previews = useMemo(
        () => images.map((file) => URL.createObjectURL(file)),
        [images],
    );
    useEffect(
        () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
        [previews],
    );

    const resize = () => {
        const el = textRef.current;
        if (el) fitTextarea(el, 180);
    };

    useEffect(() => {
        if (!draft) return;
        const el = textRef.current;
        if (!el) return;
        fitTextarea(el, 180);
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [draft]);

    const editingId = editing?.id;
    useEffect(() => {
        if (editingId === undefined) return;
        setBody(editing?.body ?? '');
        setImages([]);
        setDocs([]);
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

    useOutsideClose(emojiOpen, emojiRef, () => setEmojiOpen(false));
    useOutsideClose(attachOpen, attachRef, () => setAttachOpen(false));
    useOutsideClose(sendMenu, sendRef, () => setSendMenu(false));
    const stopSendHold = () => {
        if (sendTimer.current) window.clearTimeout(sendTimer.current);
        sendTimer.current = null;
    };

    const addFiles = (
        list: FileList | File[] | null,
        mode: 'auto' | 'document' = 'auto',
    ) => {
        if (!list || editing) return;
        const incoming = Array.from(list);
        const tooBig = incoming.filter((file) => file.size > maxFileBytes);
        if (tooBig.length) {
            toast.error(
                tr('Файл «{name}» завеликий. Максимум — {v} МБ.', {
                    name: tooBig[0].name,
                    v: site.max_message_file_mb || 50,
                }),
            );
        }
        const accepted = incoming.filter((file) => file.size <= maxFileBytes);
        const asImage = (file: File) =>
            mode === 'auto' &&
            /^image\/(jpeg|png|webp|gif)$/.test(file.type) &&
            file.size <= 20 * 1024 * 1024;
        const free = maxAttachments - images.length - docs.length;
        if (accepted.length > free) {
            toast(
                tr(
                    'Не більше {maxAttachments} вкладень в одному повідомленні.',
                    { maxAttachments },
                ),
            );
        }
        const taken = accepted.slice(0, Math.max(0, free));
        const nextImages = taken.filter(asImage);
        const nextDocs = taken.filter((file) => !asImage(file));
        if (nextImages.length) setImages((c) => [...c, ...nextImages]);
        if (nextDocs.length) setDocs((c) => [...c, ...nextDocs]);
        textRef.current?.focus();
    };

    const trimmed = body.trim();
    const hasAttachments = images.length > 0 || docs.length > 0;
    const canSubmit = editing
        ? trimmed.length > 0 && trimmed !== editing.body
        : trimmed.length > 0 || hasAttachments || card !== null;
    const showMic = !editing && !canSubmit && voice.supported;

    const reset = () => {
        setBody('');
        setImages([]);
        setDocs([]);
        setPublishAt('');
        setVanish(false);
        setCard(null);
        setPickingCard(false);
        setCardQuery('');
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
            onSend({
                kind: 'text',
                body: trimmed,
                images,
                files: docs,
                publishAt: publishAt || null,
                vanish,
                card,
            });
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

    const startRecording = () => {
        voice.start().catch((error: unknown) => {
            const denied =
                error instanceof DOMException &&
                (error.name === 'NotAllowedError' ||
                    error.name === 'SecurityError');
            toast.error(
                denied
                    ? tr(
                          'Дозвольте доступ до мікрофона в налаштуваннях браузера.',
                      )
                    : tr('Не вдалося увімкнути мікрофон.'),
            );
        });
    };

    const sendRecording = () => {
        void voice.stop().then((recording) => {
            if (recording) onSend({ kind: 'voice', ...recording });
        });
    };

    if (!canWrite) {
        return (
            <div
                className={cn(
                    'border-t border-white/[0.06] px-4 pt-4',
                    dockedAboveNav(playing),
                )}
            >
                <p className="flex items-center justify-center gap-2 text-center text-sm text-white/45">
                    <Lock className="size-4" />
                    {tr(
                        'Користувач обмежив коло осіб, які можуть надсилати йому повідомлення.',
                    )}
                </p>
            </div>
        );
    }

    const context = editing ?? replyTo;
    const iconButton =
        'flex size-10 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40';

    return (
        <div
            className={cn(
                'relative border-t border-white/[0.06] bg-transparent px-3 pt-2 sm:px-4',
                dockedAboveNav(playing),
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
            }}
        >
            {!editing && card && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                    <span className="min-w-0">
                        <span className="block text-[11px] text-white/40">
                            {tr(card.hint)}
                        </span>
                        <span className="block truncate text-sm text-white">
                            {card.title}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setCard(null)}
                        className="text-xs text-white/50"
                    >
                        {tr('Прибрати')}
                    </button>
                </div>
            )}
            {!editing && pickingCard && !card && (
                <div className="mb-2 rounded-xl bg-white/[0.04] p-2">
                    <input
                        value={cardQuery}
                        onChange={(event) => {
                            const value = event.target.value;
                            setCardQuery(value);
                            if (value.trim().length < 2) {
                                setCardHits([]);
                                return;
                            }
                            void api<{ cards: NonNullable<typeof card>[] }>(
                                'GET',
                                `/messages/cards?q=${encodeURIComponent(value.trim())}`,
                            ).then((response) => setCardHits(response.cards));
                        }}
                        placeholder={tr('Гра, фільм або сервер')}
                        className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white"
                    />
                    <div className="mt-1 max-h-36 overflow-y-auto">
                        {cardHits.map((hit) => (
                            <button
                                key={`${hit.kind}-${hit.id}`}
                                type="button"
                                onClick={() => {
                                    setCard(hit);
                                    setPickingCard(false);
                                }}
                                className="flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm text-white hover:bg-white/[0.06]"
                            >
                                {hit.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {!editing && (vanish || publishAt) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs">
                    {vanish && (
                        <button
                            type="button"
                            onClick={() => setVanish(false)}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-chip bg-gc-indigo/15 px-3 text-gc-lilac-200"
                        >
                            <Timer className="size-3.5" />
                            {tr('Зникне за добу')}
                            <X className="size-3.5 opacity-70" />
                        </button>
                    )}
                    {publishAt && (
                        <button
                            type="button"
                            onClick={() => setPublishAt('')}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-chip bg-gc-indigo/15 px-3 text-gc-lilac-200"
                        >
                            <Clock className="size-3.5" />
                            {tr('Надішлеться {date}', {
                                date: new Date(publishAt).toLocaleString(
                                    LOCALE,
                                    {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    },
                                ),
                            })}
                            <X className="size-3.5 opacity-70" />
                        </button>
                    )}
                </div>
            )}
            {context && (
                <div className="mb-2 flex animate-in items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 fade-in slide-in-from-bottom-1">
                    {editing ? (
                        <Pencil className="size-4 shrink-0 text-gc-lilac-400" />
                    ) : (
                        <Reply className="size-4 shrink-0 text-gc-lilac-400" />
                    )}
                    <span className="min-w-0 flex-1 border-l-2 border-gc-lilac-500 pl-2.5 text-[13px]">
                        <span className="block font-semibold text-[#a9b6ff]">
                            {editing
                                ? tr('Редагування')
                                : (context.user?.first_name ??
                                  tr('Повідомлення'))}
                        </span>
                        <span className="block truncate text-white/55">
                            {context.body ||
                                context.preview ||
                                (context.attachments.length
                                    ? tr('Фотографія')
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
                        aria-label={tr('Скасувати')}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}

            {(previews.length > 0 || docs.length > 0) && (
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    {previews.map((url, index) => (
                        <div
                            key={url}
                            className="relative size-[72px] shrink-0 animate-in overflow-hidden rounded-xl ring-1 ring-white/10 zoom-in-90"
                        >
                            <img
                                loading="lazy"
                                decoding="async"
                                src={url}
                                alt=""
                                className="size-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setImages((current) =>
                                        current.filter((_, i) => i !== index),
                                    )
                                }
                                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                                aria-label={tr('Прибрати')}
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                    {docs.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="relative flex h-[72px] w-[188px] shrink-0 animate-in items-center gap-2.5 rounded-xl bg-white/[0.05] pr-7 pl-2.5 ring-1 ring-white/10 zoom-in-90"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gc-blue to-gc-indigo text-white">
                                <FileUp className="size-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-white">
                                    {file.name}
                                </span>
                                <span className="block text-xs text-white/45">
                                    {formatBytes(file.size)}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setDocs((current) =>
                                        current.filter((_, i) => i !== index),
                                    )
                                }
                                className="absolute top-1 right-1 rounded-full bg-black/40 p-0.5 text-white hover:bg-black/70"
                                aria-label={tr('Прибрати')}
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <input
                ref={imageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = '';
                }}
            />
            <input
                ref={docRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                    addFiles(event.target.files, 'document');
                    event.target.value = '';
                }}
            />

            {voice.recording ? (
                <div className="flex animate-in items-center gap-2 fade-in">
                    <button
                        type="button"
                        onClick={voice.cancel}
                        className={cn(iconButton, 'hover:text-rose-300')}
                        aria-label={tr('Скасувати запис')}
                        title={tr('Скасувати')}
                    >
                        <Trash2 className="size-5" />
                    </button>
                    <div className="input-glass flex h-11 min-w-0 flex-1 items-center gap-3 rounded-control px-4">
                        <span className="relative flex size-2.5 shrink-0">
                            <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70" />
                            <span className="relative size-2.5 rounded-full bg-rose-500" />
                        </span>
                        <span className="w-10 shrink-0 text-sm font-medium text-white tabular-nums">
                            {formatDuration(voice.elapsed)}
                        </span>
                        <span className="flex h-7 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden">
                            {voice.live.map((level, index) => (
                                <span
                                    key={index}
                                    className="w-[3px] shrink-0 rounded-full bg-gradient-to-t from-gc-indigo to-gc-cyan transition-[height] duration-100"
                                    style={{ height: `${level}%` }}
                                />
                            ))}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={sendRecording}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white shadow-[0_0_24px_-2px_rgb(124_92_255/0.9)] transition hover:brightness-110"
                        aria-label={tr('Надіслати голосове')}
                    >
                        <SendHorizonal className="size-5" />
                    </button>
                </div>
            ) : (
                <div className="flex items-end gap-1.5">
                    {!editing && (
                        <div ref={attachRef} className="relative mb-0.5">
                            <button
                                type="button"
                                onClick={() => setAttachOpen((v) => !v)}
                                className={cn(
                                    iconButton,
                                    attachOpen && 'bg-white/[0.07] text-white',
                                )}
                                aria-label={tr('Прикріпити')}
                                title={tr('Прикріпити')}
                            >
                                <Paperclip
                                    className={cn(
                                        'size-5 transition',
                                        attachOpen && 'rotate-45',
                                    )}
                                />
                            </button>
                            {attachOpen && (
                                <div className="glass-strong absolute bottom-12 left-0 z-30 w-52 animate-rise rounded-2xl p-1.5">
                                    {[
                                        {
                                            label: tr('Фото'),
                                            hint: 'JPG, PNG, WebP, GIF',
                                            icon: ImagePlus,
                                            tone: 'from-gc-blue to-gc-cyan',
                                            run: () =>
                                                imageRef.current?.click(),
                                        },
                                        {
                                            label: tr('Файл'),
                                            hint: tr('до {v} МБ', {
                                                v:
                                                    site.max_message_file_mb ||
                                                    50,
                                            }),
                                            icon: FileUp,
                                            tone: 'from-gc-indigo to-gc-purple',
                                            run: () => docRef.current?.click(),
                                        },
                                        {
                                            label: tr('Контакт'),
                                            hint: tr('Пошук на GameCon'),
                                            icon: UserRound,
                                            tone: 'from-gc-mint to-gc-cyan',
                                            run: () => setContactOpen(true),
                                        },
                                        {
                                            label: tr('Картка'),
                                            hint: tr('Гра, фільм, сервер'),
                                            icon: LayoutGrid,
                                            tone: 'from-gc-amber to-gc-coral',
                                            run: () => setPickingCard(true),
                                        },
                                    ].map((item) => (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => {
                                                setAttachOpen(false);
                                                item.run();
                                            }}
                                            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06]"
                                        >
                                            <span
                                                className={cn(
                                                    'flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                                                    item.tone,
                                                )}
                                            >
                                                <item.icon className="size-4" />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-medium text-white">
                                                    {item.label}
                                                </span>
                                                <span className="block text-xs text-white/40">
                                                    {item.hint}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="input-glass flex min-w-0 flex-1 items-end rounded-control pr-1">
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
                            placeholder={tr('Напишіть повідомлення…')}
                            className="[field-sizing:content] max-h-[180px] min-h-11 min-w-0 flex-1 resize-none bg-transparent py-[11px] pl-4 text-[14.5px] leading-[1.45] text-white placeholder:text-white/35 focus:outline-none"
                        />
                        <div ref={emojiRef} className="relative mb-1">
                            <button
                                type="button"
                                onClick={() => setEmojiOpen((value) => !value)}
                                className={cn(
                                    'flex size-9 items-center justify-center rounded-full text-white/50 transition hover:text-white',
                                    emojiOpen && 'text-gc-gold',
                                )}
                                aria-label={tr('Емодзі та стікери')}
                                title={tr('Емодзі та стікери')}
                            >
                                <Smile className="size-5" />
                            </button>
                            {emojiOpen && (
                                <div className="absolute right-0 bottom-12 z-30">
                                    <EmojiPanel
                                        allowStickers={!editing}
                                        onEmoji={insertEmoji}
                                        onSticker={(sticker) => {
                                            setEmojiOpen(false);
                                            onSend({
                                                kind: 'sticker',
                                                sticker,
                                            });
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {showMic ? (
                        <button
                            type="button"
                            onClick={startRecording}
                            className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-gradient-brand hover:text-white hover:shadow-[0_0_24px_-2px_rgb(124_92_255/0.9)]"
                            aria-label={tr('Записати голосове')}
                            title={tr('Голосове повідомлення')}
                        >
                            <Mic className="size-5" />
                        </button>
                    ) : (
                        <div ref={sendRef} className="relative mb-0.5">
                            {sendMenu && (
                                <div className="glass-strong absolute right-0 bottom-12 z-30 w-64 animate-rise space-y-1 rounded-2xl p-1.5">
                                    {vanishOn && (
                                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 text-sm text-white hover:bg-white/[0.06]">
                                            <Timer className="size-4 text-gc-lilac-300" />
                                            <span className="flex-1">
                                                {tr('Зникне за добу')}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={vanish}
                                                onChange={(event) =>
                                                    setVanish(
                                                        event.target.checked,
                                                    )
                                                }
                                                className="size-4 accent-gc-lilac-400"
                                            />
                                        </label>
                                    )}
                                    {scheduleOn && (
                                        <div className="space-y-2 rounded-xl px-2.5 py-2">
                                            <span className="flex items-center gap-3 text-sm text-white">
                                                <Clock className="size-4 text-gc-lilac-300" />
                                                {tr('Відкласти')}
                                            </span>
                                            <input
                                                type="datetime-local"
                                                value={publishAt}
                                                onChange={(event) =>
                                                    setPublishAt(
                                                        event.target.value,
                                                    )
                                                }
                                                aria-label={tr(
                                                    'Час надсилання',
                                                )}
                                                className="input-glass h-10 w-full rounded-lg px-2 text-sm text-white"
                                            />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSendMenu(false);
                                            submit();
                                        }}
                                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand text-sm font-semibold text-white"
                                    >
                                        <SendHorizonal className="size-4" />
                                        {publishAt
                                            ? tr('Надіслати пізніше')
                                            : tr('Надіслати')}
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (sendHeld.current) {
                                        sendHeld.current = false;

                                        return;
                                    }
                                    submit();
                                }}
                                onPointerDown={() => {
                                    sendHeld.current = false;
                                    if (
                                        editing ||
                                        !canSubmit ||
                                        (!vanishOn && !scheduleOn)
                                    ) {
                                        return;
                                    }
                                    sendTimer.current = window.setTimeout(
                                        () => {
                                            sendHeld.current = true;
                                            setSendMenu(true);
                                            navigator.vibrate?.(10);
                                        },
                                        420,
                                    );
                                }}
                                onPointerUp={stopSendHold}
                                onPointerLeave={stopSendHold}
                                onPointerCancel={stopSendHold}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    if (
                                        !editing &&
                                        canSubmit &&
                                        (vanishOn || scheduleOn)
                                    ) {
                                        setSendMenu(true);
                                    }
                                }}
                                disabled={!canSubmit}
                                className={cn(
                                    'flex size-11 shrink-0 items-center justify-center rounded-full text-white transition duration-300 select-none [-webkit-touch-callout:none]',
                                    canSubmit
                                        ? 'scale-100 bg-gradient-brand shadow-[0_0_24px_-2px_rgb(124_92_255/0.9)] hover:brightness-110'
                                        : 'scale-95 bg-white/[0.06] text-white/35',
                                )}
                                aria-label={
                                    editing ? tr('Зберегти') : tr('Надіслати')
                                }
                                title={
                                    !editing && (vanishOn || scheduleOn)
                                        ? tr(
                                              'Утримуйте, щоб відкласти або зробити тимчасовим',
                                          )
                                        : undefined
                                }
                            >
                                <SendHorizonal className="size-5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            <ContactShareDialog
                open={contactOpen}
                onOpenChange={setContactOpen}
                onShare={(contact) => onSend({ kind: 'contact', contact })}
            />
        </div>
    );
}
