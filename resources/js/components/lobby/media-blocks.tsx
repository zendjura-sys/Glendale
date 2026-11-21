import { Link } from '@inertiajs/react';
import {
    Heart,
    MessageCircle,
    Mic,
    Pause,
    Play,
    Send,
    Share2,
    Square,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PostItem } from '@/types';

/** Пропорція зображення для блоку: 1:1, 3:4, 16:9, 9:16… (без даних — 4:3). */
export function ratioOf(width?: number | null, height?: number | null): string {
    return width && height ? `${width} / ${height}` : '4 / 3';
}

/** Допис із фото — заливка всього блоку: блок бере пропорції фото, текст і кнопки — на склі. */
export function isMediaPost(post: PostItem): boolean {
    const first = post.attachments?.[0];
    return !!first && first.type === 'image' && !post.poll && !post.locked;
}

export function MediaPostBlock({ post }: { post: PostItem }) {
    const image = post.attachments[0];
    const [liked, setLiked] = useState<boolean>(
        !!(post.reaction ?? post.liked),
    );
    const [likes, setLikes] = useState(post.likes_count);
    const author = post.publisher
        ? { name: post.publisher.name, href: post.publisher.href, avatar: null }
        : {
              name: post.author.name,
              href: `/${post.author.username}`,
              avatar: post.author,
          };

    const like = () => {
        const next = !liked;
        setLiked(next);
        setLikes((n) => n + (next ? 1 : -1));
        api<{ reaction: string | null; likes_count: number }>(
            'POST',
            `/posts/${post.id}/like`,
            { reaction: 'like' },
        )
            .then((r) => {
                setLiked(r.reaction !== null);
                setLikes(r.likes_count);
            })
            .catch(() => {
                setLiked(!next);
                setLikes((n) => n + (next ? -1 : 1));
            });
    };
    const share = () => {
        const url = `${window.location.origin}/posts/${post.id}`;
        if (navigator.share) {
            void navigator.share({ url }).catch(() => undefined);
        } else {
            void navigator.clipboard?.writeText(url);
            toast.success(tr('Посилання скопійовано.'));
        }
    };

    return (
        <article
            className="gc-media-block"
            style={{ aspectRatio: ratioOf(image.width, image.height) }}
        >
            <img
                src={image.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="gc-media-block__img"
            />
            <Link
                href={`/posts/${post.id}`}
                className="absolute inset-0"
                aria-label={tr('Відкрити допис')}
            />
            <Link
                href={author.href}
                className="gc-glass-s gc-media-block__author"
            >
                {author.avatar && (
                    <UserAvatar
                        user={author.avatar}
                        size="xs"
                        showOnline={false}
                    />
                )}
                <span className="truncate">{author.name}</span>
            </Link>
            {post.attachments.length > 1 && (
                <span className="gc-glass-s gc-media-block__count">
                    1/{post.attachments.length}
                </span>
            )}
            <div className="gc-media-block__bottom">
                <div className="gc-glass-caption" aria-hidden />
                {post.body && (
                    <p className="gc-media-block__caption">{post.body}</p>
                )}
                <div className="relative flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={like}
                        aria-pressed={liked}
                        aria-label={tr('Подобається')}
                        className={cn(
                            'gc-glass-s gc-glass-btn',
                            liked && 'is-on',
                        )}
                    >
                        <Heart
                            className={cn('size-4', liked && 'fill-current')}
                        />
                        <span className="tabular-nums">{likes}</span>
                    </button>
                    <Link
                        href={`/posts/${post.id}`}
                        className="gc-glass-s gc-glass-btn"
                        aria-label={tr('Коментарі')}
                    >
                        <MessageCircle className="size-4" />
                        <span className="tabular-nums">
                            {post.comments_count}
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={share}
                        className="gc-glass-s gc-glass-btn ml-auto"
                        aria-label={tr('Поділитися')}
                    >
                        <Share2 className="size-4" />
                    </button>
                </div>
            </div>
        </article>
    );
}

/** Голосове: кнопка відтворення, прогрес і тривалість. */
export function VoicePlayer({
    url,
    duration,
}: {
    url: string;
    duration: number | null;
}) {
    const audio = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => () => audio.current?.pause(), []);

    const toggle = () => {
        if (!audio.current) {
            audio.current = new Audio(url);
            audio.current.ontimeupdate = () => {
                const a = audio.current;
                if (a && a.duration) setProgress(a.currentTime / a.duration);
            };
            audio.current.onended = () => {
                setPlaying(false);
                setProgress(0);
            };
        }
        if (playing) {
            audio.current.pause();
            setPlaying(false);
        } else {
            void audio.current
                .play()
                .then(() => setPlaying(true))
                .catch(() => toast.error(tr('Не вдалося відтворити.')));
        }
    };
    const secs = duration ?? 0;

    return (
        <div className="relative flex items-center gap-3">
            <button
                type="button"
                onClick={toggle}
                aria-label={playing ? tr('Пауза') : tr('Слухати голосове')}
                className="gc-player-widget__play shrink-0"
            >
                {playing ? (
                    <Pause className="size-5" />
                ) : (
                    <Play className="size-5" />
                )}
            </button>
            <span className="gc-voice-bar" aria-hidden>
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
            <span className="shrink-0 text-xs text-[var(--gc-text-2)] tabular-nums">
                {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
            </span>
        </div>
    );
}

/** Запис голосового відповіддю: натиснути — запис, ще раз — надіслати. */
export function VoiceReplyButton({
    chatId,
    onSent,
}: {
    chatId: number;
    onSent: () => void;
}) {
    const recorder = useRef<MediaRecorder | null>(null);
    const started = useRef(0);
    const [recording, setRecording] = useState(false);
    const [busy, setBusy] = useState(false);

    const start = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const rec = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            rec.ondataavailable = (e) => chunks.push(e.data);
            rec.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                const seconds = Math.max(
                    1,
                    Math.round((Date.now() - started.current) / 1000),
                );
                const blob = new Blob(chunks, {
                    type: rec.mimeType || 'audio/webm',
                });
                const form = new FormData();
                form.append('voice', blob, 'voice.webm');
                form.append('voice_duration', String(seconds));
                setBusy(true);
                api('POST', `/messages/${chatId}`, form)
                    .then(onSent)
                    .catch(() =>
                        toast.error(tr('Не вдалося надіслати голосове.')),
                    )
                    .finally(() => setBusy(false));
            };
            recorder.current = rec;
            started.current = Date.now();
            rec.start();
            setRecording(true);
        } catch {
            toast.error(tr('Немає доступу до мікрофона.'));
        }
    };
    const stop = () => {
        recorder.current?.stop();
        setRecording(false);
    };

    return (
        <button
            type="button"
            onClick={() => (recording ? stop() : void start())}
            disabled={busy}
            aria-label={
                recording ? tr('Надіслати голосове') : tr('Записати голосове')
            }
            className={cn(
                'gc-glass-s gc-glass-btn gc-glass-btn--icon',
                recording && 'is-recording',
            )}
        >
            {recording ? (
                <Square className="size-4" />
            ) : busy ? (
                <Send className="size-4" />
            ) : (
                <Mic className="size-4" />
            )}
        </button>
    );
}
