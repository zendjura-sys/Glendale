import { usePage } from '@inertiajs/react';
import { GifPicker } from '@/components/gc/gif-picker';
import {
    BarChart3,
    Eye,
    Camera,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlyingSendIcon } from '@/components/gc/animated-icons';
import { toast } from 'sonner';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { api } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/format';
import { usePlayer } from '@/lib/player';
import { fitTextarea } from '@/lib/textarea';
import { cn, dockedAboveNav } from '@/lib/utils';
import type { ChatMessage, OutgoingMessage } from '@/types';
import { CreatePollDialog } from './chat-poll';
import { ContactShareDialog } from './contact-share-dialog';
import { AiWriter } from './ai-writer';
import { EmojiPanel } from './emoji-panel';
import { VideoNoteRecorder } from './video-note';
import { useDraft, writeDraft } from '@/lib/drafts';
import { LOCALE, tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

const MAX_ATTACHMENTS = 10;
const MAX_LENGTH = 4096;

type Props = {
    canWrite: boolean;
    /** Чому писати не можна (за замовчуванням — обмеження в особистих). */
    lockedText?: string | null;
    replyTo: ChatMessage | null;
    editing: ChatMessage | null;
    onCancel: () => void;
    onSend: (message: OutgoingMessage) => void;
    onEdit: (message: ChatMessage, body: string) => void;
    onTyping: () => void;
    onEditLast: () => void;
    draft?: string | null;
    /** Ключ чернетки незакінченого повідомлення (на цьому пристрої). */
    draftKey?: string | null;
    /** Групова бесіда, де можна створити опитування (null — пункт ховається). */
    pollConversationId?: number | null;
    onPollCreated?: (message: ChatMessage) => void;
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
    lockedText = null,
    replyTo,
    editing,
    onCancel,
    onSend,
    onEdit,
    onTyping,
    onEditLast,
    draft = null,
    draftKey = null,
    pollConversationId = null,
    onPollCreated,
}: Props) {
    const { site, modules } = usePage().props;
    // Картки — лише розділів режиму (гра, фільм, сервер); без жодного пункт ховається.
    const cardWords = [
        modules.includes('games') && tr('гра'),
        modules.includes('cinema') && tr('фільм'),
        modules.includes('servers') && tr('сервер'),
    ].filter((word): word is string => Boolean(word));
    const cardScope = cardWords.join(', ');
    const vanishOn = usePlugin('disappearing_messages');
    const scheduleOn = usePlugin('scheduled_messages');
    const videoNotesPlugin = usePlugin('video_notes');
    const [body, setBody] = useState(draft ?? '');
    // Лічильник відправок — літачок на кнопці «відлітає» з кожним повідомленням.
    const [sentCount, setSentCount] = useState(0);
    const draftsOn = usePlugin('local_drafts');
    useDraft(draftsOn && !editing ? draftKey : null, body, setBody);
    const aiWriterOn = usePlugin('ai_writer');
    const [publishAt, setPublishAt] = useState('');
    const [vanish, setVanish] = useState(false);
    // Одне фото можна надіслати «на один перегляд».
    const onceOn = usePlugin('view_once');
    const [once, setOnce] = useState(false);
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
    const gifOn = usePlugin('gif_search');
    const [pickingGif, setPickingGif] = useState(false);
    const [images, setImages] = useState<File[]>([]);
    const [docs, setDocs] = useState<File[]>([]);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [attachOpen, setAttachOpen] = useState(false);
    const [sendMenu, setSendMenu] = useState(false);
    const sendRef = useRef<HTMLDivElement>(null);
    const sendTimer = useRef<number | null>(null);
    const sendHeld = useRef(false);
    const [contactOpen, setContactOpen] = useState(false);
    const [pollOpen, setPollOpen] = useState(false);
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
    const videoNotesOn =
        videoNotesPlugin &&
        typeof MediaRecorder !== 'undefined' &&
        !!navigator.mediaDevices;
    const [noteOpen, setNoteOpen] = useState(false);
    const closeNote = useCallback(() => setNoteOpen(false), []);

    const reset = () => {
        setBody('');
        if (draftKey) writeDraft(draftKey, '');
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
                once: once && images.length === 1 && docs.length === 0,
                card,
            });
            setOnce(false);
            setSentCount((n) => n + 1);
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
            <div className={cn('px-4 pt-4', dockedAboveNav(playing))}>
                <p className="flex items-center justify-center gap-2 text-center text-sm text-white/45">
                    <Lock className="size-4" />
                    {lockedText ??
                        tr(
                            'Користувач обмежив коло осіб, які можуть надсилати йому повідомлення.',
                        )}
                </p>
            </div>
        );
    }

    const context = editing ?? replyTo;
    const iconButton =
        'flex size-10 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-[var(--gc-l3)] hover:text-white disabled:opacity-40';

    return (
        <div
            className={cn(
                'relative bg-transparent px-3 pt-2 sm:px-4',
                dockedAboveNav(playing),
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
            }}
        >
            {!editing && pickingGif && (
                <div className="mb-2">
                    <GifPicker
                        onPick={(gif) => {
                            setCard({
                                kind: 'gif',
                                id: 0,
                                title: gif.title,
                                hint: 'GIF',
                                href: gif.url,
                                image: gif.url,
                            });
                            setPickingGif(false);
                        }}
                        onClose={() => setPickingGif(false)}
                    />
                </div>
            )}
            {!editing && card?.kind === 'gif' && (
                <div className="relative mb-2 w-fit max-w-full">
                    <img
                        src={card.href}
                        alt={card.title}
                        className="max-h-40 rounded-xl"
                    />
                    <button
                        type="button"
                        onClick={() => setCard(null)}
                        aria-label={tr('Прибрати')}
                        className="absolute top-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                    >
                        ×
                    </button>
                </div>
            )}
            {!editing && card && card.kind !== 'gif' && (
                <div className="gc-solid-2 mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
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
                <div className="gc-solid-2 mb-2 rounded-xl p-2">
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
                        placeholder={
                            cardScope.charAt(0).toUpperCase() +
                            cardScope.slice(1)
                        }
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
                                className="flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm text-white hover:bg-[var(--gc-l3)]"
                            >
                                {hit.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {!editing &&
                onceOn &&
                images.length === 1 &&
                docs.length === 0 &&
                !publishAt && (
                    <div className="mb-2 px-1">
                        <button
                            type="button"
                            onClick={() => setOnce(!once)}
                            aria-pressed={once}
                            className={cn(
                                'inline-flex min-h-8 items-center gap-1.5 rounded-chip px-3 text-xs transition',
                                once
                                    ? 'bg-primary text-white'
                                    : 'bg-white/[0.07] text-white/70 hover:text-white',
                            )}
                        >
                            <Eye className="size-3.5" />
                            {tr('На один перегляд')}
                        </button>
                    </div>
                )}
            {!editing && (vanish || publishAt) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs">
                    {vanish && (
                        <button
                            type="button"
                            onClick={() => setVanish(false)}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-chip bg-gc-indigo/15 px-3 text-sky-400"
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
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-chip bg-gc-indigo/15 px-3 text-sky-400"
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
                <div className="gc-solid-2 mb-2 flex animate-in items-center gap-3 rounded-xl px-3 py-2 fade-in slide-in-from-bottom-1">
                    {editing ? (
                        <Pencil className="size-4 shrink-0 text-sky-400" />
                    ) : (
                        <Reply className="size-4 shrink-0 text-sky-400" />
                    )}
                    <span className="min-w-0 flex-1 border-l-2 pl-2.5 text-[13px]">
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
                            className="relative size-[72px] shrink-0 animate-in overflow-hidden rounded-xl zoom-in-90"
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
                            className="gc-solid-2 relative flex h-[72px] w-[188px] shrink-0 animate-in items-center gap-2.5 rounded-xl pr-7 pl-2.5 zoom-in-90"
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
                        className={cn(iconButton, 'hover:text-red-400')}
                        aria-label={tr('Скасувати запис')}
                        title={tr('Скасувати')}
                    >
                        <Trash2 className="size-5" />
                    </button>
                    <div className="input-glass flex h-11 min-w-0 flex-1 items-center gap-3 rounded-control px-4">
                        <span className="relative flex size-2.5 shrink-0">
                            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/70" />
                            <span className="relative size-2.5 rounded-full bg-red-500" />
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
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition hover:brightness-110"
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
                                        ...(pollConversationId
                                            ? [
                                                  {
                                                      label: tr('Опитування'),
                                                      hint: tr(
                                                          'Голосування в групі',
                                                      ),
                                                      icon: BarChart3,
                                                      tone: 'from-gc-amber to-gc-coral',
                                                      run: () =>
                                                          setPollOpen(true),
                                                  },
                                              ]
                                            : []),
                                        {
                                            label: tr('Контакт'),
                                            hint: tr('Пошук на GameCon'),
                                            icon: UserRound,
                                            tone: 'from-gc-mint to-gc-cyan',
                                            run: () => setContactOpen(true),
                                        },
                                        ...(cardWords.length > 0
                                            ? [
                                                  {
                                                      label: tr('Картка'),
                                                      hint:
                                                          cardScope
                                                              .charAt(0)
                                                              .toUpperCase() +
                                                          cardScope.slice(1),
                                                      icon: LayoutGrid,
                                                      tone: 'from-gc-amber to-gc-coral',
                                                      run: () =>
                                                          setPickingCard(true),
                                                  },
                                              ]
                                            : []),
                                    ].map((item) => (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => {
                                                setAttachOpen(false);
                                                item.run();
                                            }}
                                            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--gc-l3)]"
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
                            placeholder={
                                hasAttachments
                                    ? tr('Додайте підпис…')
                                    : tr('Напишіть повідомлення…')
                            }
                            className="[field-sizing:content] max-h-[180px] min-h-11 min-w-0 flex-1 resize-none bg-transparent py-[11px] pl-4 text-[14.5px] leading-[1.45] text-white placeholder:text-white/35 focus:outline-none"
                        />
                        {aiWriterOn && !editing && (
                            <AiWriter text={body} onResult={setBody} />
                        )}
                        {gifOn && !editing && (
                            <button
                                type="button"
                                onClick={() => setPickingGif((v) => !v)}
                                aria-label="GIF"
                                title="GIF"
                                className={cn(
                                    'mb-1 flex h-9 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white/50 transition hover:text-white',
                                    pickingGif && 'text-[#7ee0b5]',
                                )}
                            >
                                GIF
                            </button>
                        )}
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

                    {showMic && videoNotesOn && (
                        <button
                            type="button"
                            onClick={() => setNoteOpen(true)}
                            className="gc-solid-2 mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                            aria-label={tr('Записати відеокружок')}
                            title={tr('Відеокружок')}
                        >
                            <Camera className="size-5" />
                        </button>
                    )}
                    {noteOpen && (
                        <VideoNoteRecorder
                            onClose={closeNote}
                            onSend={(blob, duration) =>
                                onSend({ kind: 'video_note', blob, duration })
                            }
                        />
                    )}
                    {showMic ? (
                        <button
                            type="button"
                            onClick={startRecording}
                            className="gc-solid-2 mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-sky-500 hover:text-white"
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
                                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 text-sm text-white hover:bg-[var(--gc-l3)]">
                                            <Timer className="size-4 text-sky-400" />
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
                                                className="size-4 accent-sky-400"
                                            />
                                        </label>
                                    )}
                                    {scheduleOn && (
                                        <div className="space-y-2 rounded-xl px-2.5 py-2">
                                            <span className="flex items-center gap-3 text-sm text-white">
                                                <Clock className="size-4 text-sky-400" />
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
                                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-semibold text-white"
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
                                        ? 'scale-100 bg-sky-500 hover:brightness-110'
                                        : 'gc-solid-2 scale-95 text-white/35',
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
                                <FlyingSendIcon sent={sentCount} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {pollConversationId && (
                <CreatePollDialog
                    open={pollOpen}
                    onOpenChange={setPollOpen}
                    conversationId={pollConversationId}
                    onCreated={(m) => onPollCreated?.(m)}
                />
            )}
            <ContactShareDialog
                open={contactOpen}
                onOpenChange={setContactOpen}
                onShare={(contact) => onSend({ kind: 'contact', contact })}
            />
        </div>
    );
}
