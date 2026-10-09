import { usePage } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    Globe,
    ImagePlus,
    Loader2,
    Plus,
    Send,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api, ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import { tr } from '@/lib/i18n';

export type StoryItem = {
    id: number;
    media_type: 'image' | 'video';
    url: string;
    duration: number;
    caption: string | null;
    privacy: 'friends' | 'close' | 'everyone';
    created_at: string;
    seen: boolean;
    views_count: number | null;
};

export type StoryGroup = {
    user: UserCard;
    own: boolean;
    all_seen: boolean;
    stories: StoryItem[];
};

type Viewer = UserCard & { reaction: string | null; viewed_at: string };

const failed = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

/** Кільце довкола аватарки: кольорове — є нові історії, сіре — усе переглянуто. */
function Ring({
    seen,
    children,
}: {
    seen: boolean;
    children: React.ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex rounded-full p-[2.5px]',
                seen
                    ? 'bg-white/15'
                    : 'bg-gradient-to-tr from-gc-blue via-gc-violet-400 to-gc-pink',
            )}
        >
            <span className="inline-flex rounded-full bg-[var(--card-solid,#0b0d1d)] p-[2px]">
                {children}
            </span>
        </span>
    );
}

/** Нова історія: фото чи відео, підпис, хто бачить. */
function Composer({
    onClose,
    onPosted,
}: {
    onClose: () => void;
    onPosted: () => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [caption, setCaption] = useState('');
    const [privacy, setPrivacy] = useState<'friends' | 'close' | 'everyone'>(
        'friends',
    );
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        input.current?.click();
    }, []);
    useEffect(
        () => () => (preview ? URL.revokeObjectURL(preview) : undefined),
        [preview],
    );

    const video = file?.type.startsWith('video/') ?? false;

    const publish = async () => {
        if (!file) return;
        setBusy(true);
        const form = new FormData();
        form.append('media', file);
        if (caption.trim()) form.append('caption', caption.trim());
        form.append('privacy', privacy);
        if (video && duration)
            form.append(
                'duration',
                String(Math.min(60, Math.max(1, Math.round(duration)))),
            );
        try {
            await api('POST', '/stories', form);
            toast.success(tr('Історію опубліковано на 24 години'));
            onPosted();
            onClose();
        } catch (e) {
            failed(e, tr('Не вдалося опублікувати'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className="glass-strong w-full max-w-sm rounded-3xl p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-center">
                    <h2 className="flex-1 font-display text-base font-semibold text-white">
                        {tr('Нова історія')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={tr('Закрити')}
                        className="text-white/60 hover:text-white"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                <input
                    ref={input}
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                        const next = e.target.files?.[0] ?? null;
                        setFile(next);
                        setDuration(null);
                        setPreview(next ? URL.createObjectURL(next) : null);
                    }}
                />
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="relative flex aspect-[9/16] max-h-[50vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04]"
                >
                    {preview ? (
                        video ? (
                            <video
                                src={preview}
                                className="size-full object-cover"
                                muted
                                autoPlay
                                loop
                                playsInline
                                onLoadedMetadata={(e) =>
                                    setDuration(e.currentTarget.duration)
                                }
                            />
                        ) : (
                            <img
                                src={preview}
                                alt=""
                                className="size-full object-cover"
                            />
                        )
                    ) : (
                        <span className="flex flex-col items-center gap-2 text-sm text-white/50">
                            <ImagePlus className="size-8" />{' '}
                            {tr('Фото або відео до 60 с')}
                        </span>
                    )}
                </button>
                <input
                    value={caption}
                    maxLength={200}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={tr('Підпис (необов’язково)')}
                    className="input-glass mt-3 h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <div className="mt-3 flex rounded-xl bg-white/[0.04] p-1 text-sm">
                    {(
                        [
                            ['friends', tr('Друзям'), Users],
                            ['close', tr('Близьким'), Users],
                            ['everyone', tr('Усім'), Globe],
                        ] as const
                    ).map(([key, label, Icon]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setPrivacy(key)}
                            className={cn(
                                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition',
                                privacy === key
                                    ? 'bg-gradient-brand text-white'
                                    : 'text-white/55',
                            )}
                        >
                            <Icon className="size-4" /> {label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    disabled={!file || busy}
                    onClick={() => void publish()}
                    className="btn-glow mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                    {busy && <Loader2 className="size-4 animate-spin" />}{' '}
                    {tr('Опублікувати')}
                </button>
            </div>
        </div>
    );
}

/** Повноекранний перегляд: смужки прогресу, дотик ліворуч/праворуч, утримання — пауза. */
function StoryViewer({
    groups,
    start,
    reactions,
    onClose,
    onChanged,
}: {
    groups: StoryGroup[];
    start: number;
    reactions: string[];
    onClose: () => void;
    onChanged: () => void;
}) {
    const [g, setG] = useState(start);
    const [i, setI] = useState(() =>
        Math.max(0, groups[start]?.stories.findIndex((s) => !s.seen) ?? 0),
    );
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [reply, setReply] = useState('');
    const [viewers, setViewers] = useState<Viewer[] | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const group = groups[g];
    const story = group?.stories[i];

    const next = useCallback(() => {
        if (!group) return;
        if (i < group.stories.length - 1) setI(i + 1);
        else if (g < groups.length - 1) {
            setG(g + 1);
            setI(0);
        } else onClose();
    }, [g, i, group, groups.length, onClose]);

    const prev = () => {
        if (i > 0) setI(i - 1);
        else if (g > 0) {
            setG(g - 1);
            setI(0);
        }
    };

    // Позначаємо перегляд і запускаємо таймер (для відео — за часом відео).
    useEffect(() => {
        if (!story) return;
        setProgress(0);
        setViewers(null);
        if (!group.own && !story.seen) {
            story.seen = true;
            void api('POST', `/stories/${story.id}/view`).catch(
                () => undefined,
            );
        }
    }, [story, group]);

    useEffect(() => {
        if (!story || paused || story.media_type === 'video' || viewers) return;
        const step = 100 / ((story.duration || 6) * 20);
        const timer = window.setInterval(
            () => setProgress((p) => p + step),
            50,
        );

        return () => window.clearInterval(timer);
    }, [story, paused, viewers]);

    useEffect(() => {
        if (progress >= 100) next();
    }, [progress, next]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        if (paused || viewers) v.pause();
        else void v.play().catch(() => undefined);
    }, [paused, viewers, story]);

    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', key);

        return () => window.removeEventListener('keydown', key);
    });

    if (!group || !story) return null;

    const send = async (body: string) => {
        try {
            await api('POST', `/stories/${story.id}/reply`, { body });
            toast.success(tr('Відповідь надіслано в особисті'));
            setReply('');
        } catch (e) {
            failed(e, tr('Не надіслано'));
        }
    };
    const react = async (reaction: string) => {
        try {
            await api('POST', `/stories/${story.id}/react`, { reaction });
            toast.success(tr('{reaction} надіслано', { reaction }));
        } catch (e) {
            failed(e, tr('Не надіслано'));
        }
    };
    const remove = async () => {
        if (!confirm(tr('Видалити історію?'))) return;
        try {
            await api('DELETE', `/stories/${story.id}`);
            onChanged();
            onClose();
        } catch (e) {
            failed(e, tr('Не вдалося видалити'));
        }
    };
    const openViewers = async () => {
        try {
            const data = await api<{ viewers: Viewer[] }>(
                'GET',
                `/stories/${story.id}/viewers`,
            );
            setViewers(data.viewers);
        } catch (e) {
            failed(e, tr('Не вдалося завантажити'));
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95">
            <div className="relative flex h-full max-h-[100dvh] w-full max-w-[min(100vw,calc(100dvh*9/16))] flex-col overflow-hidden bg-black sm:rounded-2xl">
                {/* Прогрес */}
                <div className="absolute inset-x-2 top-2 z-20 flex gap-1">
                    {group.stories.map((s, n) => (
                        <span
                            key={s.id}
                            className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
                        >
                            <span
                                className="block h-full bg-white"
                                style={{
                                    width: `${n < i ? 100 : n === i ? Math.min(100, progress) : 0}%`,
                                }}
                            />
                        </span>
                    ))}
                </div>
                <div className="absolute inset-x-3 top-5 z-20 flex items-center gap-2">
                    <UserAvatar
                        user={group.user}
                        size="sm"
                        showOnline={false}
                    />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                            {group.user.name}
                        </span>
                        <span className="block text-xs text-white/60">
                            {timeAgo(story.created_at)}
                        </span>
                    </span>
                    {group.own && (
                        <button
                            type="button"
                            onClick={() => void remove()}
                            aria-label={tr('Видалити')}
                            className="p-1 text-white/80 hover:text-white"
                        >
                            <Trash2 className="size-5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={tr('Закрити')}
                        className="p-1 text-white/80 hover:text-white"
                    >
                        <X className="size-6" />
                    </button>
                </div>

                {/* Вміст: дотик ліворуч — назад, праворуч — далі, утримання — пауза */}
                <div
                    className="relative flex min-h-0 flex-1 items-center justify-center"
                    onPointerDown={() => setPaused(true)}
                    onPointerUp={() => setPaused(false)}
                    onPointerLeave={() => setPaused(false)}
                >
                    {story.media_type === 'video' ? (
                        <video
                            ref={videoRef}
                            key={story.id}
                            src={story.url}
                            className="max-h-full max-w-full"
                            autoPlay
                            playsInline
                            onTimeUpdate={(e) => {
                                const v = e.currentTarget;
                                if (v.duration)
                                    setProgress(
                                        (v.currentTime / v.duration) * 100,
                                    );
                            }}
                            onEnded={next}
                        />
                    ) : (
                        <img
                            key={story.id}
                            src={story.url}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                        />
                    )}
                    <button
                        type="button"
                        aria-label={tr('Попередня')}
                        onClick={prev}
                        className="absolute inset-y-0 left-0 w-1/3"
                    />
                    <button
                        type="button"
                        aria-label={tr('Наступна')}
                        onClick={next}
                        className="absolute inset-y-0 right-0 w-2/3"
                    />
                    {story.caption && (
                        <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-black/45 px-3 py-2 text-center text-sm text-white backdrop-blur">
                            {story.caption}
                        </p>
                    )}
                </div>

                {/* Низ: автор бачить перегляди, інші — відповідь і реакції */}
                <div className="z-20 p-3">
                    {group.own ? (
                        <button
                            type="button"
                            onClick={() => void openViewers()}
                            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
                        >
                            <Eye className="size-4" /> {story.views_count ?? 0}{' '}
                            {tr('переглядів')}
                        </button>
                    ) : (
                        <>
                            <div className="mb-2 flex justify-center gap-2">
                                {reactions.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => void react(r)}
                                        className="text-2xl transition hover:scale-110 motion-reduce:hover:scale-100"
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (reply.trim()) void send(reply.trim());
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    onFocus={() => setPaused(true)}
                                    onBlur={() => setPaused(false)}
                                    maxLength={1000}
                                    placeholder={tr('Відповісти {first_name}', {
                                        first_name: group.user.first_name,
                                    })}
                                    className="h-10 min-w-0 flex-1 rounded-full border border-white/25 bg-transparent px-4 text-sm text-white placeholder:text-white/50 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    aria-label={tr('Надіслати')}
                                    className="inline-flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
                                >
                                    <Send className="size-4" />
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {viewers && (
                    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] overflow-y-auto rounded-t-3xl bg-[#0d1222] p-4">
                        <div className="mb-2 flex items-center">
                            <h3 className="flex-1 text-sm font-semibold text-white">
                                {tr('Переглянули (')}
                                {viewers.length})
                            </h3>
                            <button
                                type="button"
                                onClick={() => setViewers(null)}
                                aria-label={tr('Закрити')}
                                className="text-white/60"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        {viewers.length === 0 && (
                            <p className="py-4 text-center text-sm text-white/45">
                                {tr('Ще ніхто не переглянув')}
                            </p>
                        )}
                        {viewers.map((v) => (
                            <div
                                key={v.id}
                                className="flex items-center gap-3 py-1.5"
                            >
                                <UserAvatar user={v} size="sm" />
                                <span className="min-w-0 flex-1 truncate text-sm text-white">
                                    {v.name}
                                </span>
                                {v.reaction && (
                                    <span className="text-lg">
                                        {v.reaction}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={prev}
                    aria-label={tr('Попередня')}
                    className="absolute top-1/2 -left-14 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white sm:block"
                >
                    <ChevronLeft className="size-6" />
                </button>
                <button
                    type="button"
                    onClick={next}
                    aria-label={tr('Наступна')}
                    className="absolute top-1/2 -right-14 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white sm:block"
                >
                    <ChevronRight className="size-6" />
                </button>
            </div>
        </div>
    );
}

/** Смуга історій над стрічкою. */
export function StoriesBar() {
    const me = usePage().props.auth.user;
    const [groups, setGroups] = useState<StoryGroup[] | null>(null);
    const [reactions, setReactions] = useState<string[]>([]);
    const [open, setOpen] = useState<number | null>(null);
    const [composing, setComposing] = useState(false);

    const load = useCallback(() => {
        void api<{ groups: StoryGroup[]; reactions: string[] }>(
            'GET',
            '/stories',
        )
            .then((data) => {
                setGroups(data.groups);
                setReactions(data.reactions);
            })
            .catch(() => setGroups([]));
    }, []);

    useEffect(load, [load]);

    if (groups === null) return null;
    const own = groups.find((x) => x.own);

    return (
        <>
            <div className="glass flex [scrollbar-width:none] gap-3 overflow-x-auto rounded-3xl p-3">
                <button
                    type="button"
                    onClick={() =>
                        own ? setOpen(groups.indexOf(own)) : setComposing(true)
                    }
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                    <span className="relative">
                        {own ? (
                            <Ring seen={own.all_seen}>
                                <UserAvatar
                                    user={me}
                                    size="md"
                                    showOnline={false}
                                />
                            </Ring>
                        ) : (
                            <span className="inline-flex p-[4.5px]">
                                <UserAvatar
                                    user={me}
                                    size="md"
                                    showOnline={false}
                                />
                            </span>
                        )}
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                setComposing(true);
                            }}
                            className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-[#0b0d1d] bg-gradient-brand text-white"
                            aria-label={tr('Нова історія')}
                        >
                            <Plus className="size-3" />
                        </span>
                    </span>
                    <span className="w-full truncate text-center text-xs text-white/70">
                        {tr('Ваша історія')}
                    </span>
                </button>
                {groups.map((group, n) =>
                    group.own ? null : (
                        <button
                            key={group.user.id}
                            type="button"
                            onClick={() => setOpen(n)}
                            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                        >
                            <Ring seen={group.all_seen}>
                                <UserAvatar
                                    user={group.user}
                                    size="md"
                                    showOnline={false}
                                />
                            </Ring>
                            <span className="w-full truncate text-center text-xs text-white/70">
                                {group.user.first_name}
                            </span>
                        </button>
                    ),
                )}
                {groups.filter((x) => !x.own).length === 0 && (
                    <p className="self-center text-xs text-white/40">
                        {tr('Історії друзів з’являться тут на 24 години')}
                    </p>
                )}
            </div>
            {open !== null && (
                <StoryViewer
                    groups={groups}
                    start={open}
                    reactions={reactions}
                    onClose={() => {
                        setOpen(null);
                        load();
                    }}
                    onChanged={load}
                />
            )}
            {composing && (
                <Composer onClose={() => setComposing(false)} onPosted={load} />
            )}
        </>
    );
}
