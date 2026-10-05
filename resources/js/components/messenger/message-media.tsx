import { Link } from '@inertiajs/react';
import {
    Download,
    File as FileIcon,
    FileArchive,
    FileAudio,
    FileCode,
    FileSpreadsheet,
    FileText,
    FileVideo,
    MessageCircle,
    Pause,
    Play,
    UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { formatBytes, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ChatAttachment, ContactCard } from '@/types';
import { tr } from '@/lib/i18n';

let playing: HTMLAudioElement | null = null;

const SPEEDS = [1, 1.5, 2] as const;

export function VoicePlayer({
    attachment,
    own,
}: {
    attachment: ChatAttachment;
    own: boolean;
}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [current, setCurrent] = useState(0);
    const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
    const duration = attachment.duration ?? 0;
    const bars = attachment.waveform?.length
        ? attachment.waveform
        : Array.from({ length: 40 }, (_, i) => 20 + ((i * 37) % 60));

    useEffect(() => {
        const audio = new Audio(attachment.url);
        audio.preload = 'metadata';
        audioRef.current = audio;

        const onTime = () => {
            const total =
                Number.isFinite(audio.duration) && audio.duration > 0
                    ? audio.duration
                    : duration;
            setCurrent(audio.currentTime);
            setProgress(total ? Math.min(1, audio.currentTime / total) : 0);
        };
        const onEnd = () => {
            setPlaying(false);
            setProgress(0);
            setCurrent(0);
        };
        const onPause = () => setPlaying(false);
        const onPlay = () => setPlaying(true);

        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('play', onPlay);

        return () => {
            audio.pause();
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnd);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('play', onPlay);
            if (playing === audio) playing = null;
        };
    }, [attachment.url, duration]);

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            if (playing && playing !== audio) playing.pause();
            playing = audio;
            audio.playbackRate = speed;
            void audio.play();
        } else {
            audio.pause();
        }
    };

    const seek = (event: PointerEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(
            1,
            Math.max(0, (event.clientX - rect.left) / rect.width),
        );
        const total =
            Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : duration;
        audio.currentTime = ratio * total;
        setProgress(ratio);
        if (audio.paused) toggle();
    };

    const cycleSpeed = () => {
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        setSpeed(next);
        if (audioRef.current) audioRef.current.playbackRate = next;
    };

    return (
        <div className="flex w-[min(280px,62vw)] items-center gap-2.5 py-0.5">
            <button
                type="button"
                onClick={toggle}
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full transition hover:scale-105',
                    own
                        ? 'bg-white text-[#5b4cf0]'
                        : 'bg-gradient-brand text-white shadow-[0_0_18px_-4px_rgb(124_92_255/0.9)]',
                )}
                aria-label={isPlaying ? tr('Пауза') : tr('Відтворити')}
            >
                {isPlaying ? (
                    <Pause className="size-[18px] fill-current" />
                ) : (
                    <Play className="ml-0.5 size-[18px] fill-current" />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <div
                    role="slider"
                    tabIndex={0}
                    aria-label={tr('Позиція відтворення')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    onPointerDown={seek}
                    className="flex h-7 cursor-pointer items-center gap-[2px]"
                >
                    {bars.map((value, index) => {
                        const active = index / bars.length < progress;

                        return (
                            <span
                                key={index}
                                className={cn(
                                    'w-[3px] min-w-[2px] flex-1 rounded-full transition-colors',
                                    own
                                        ? active
                                            ? 'bg-white'
                                            : 'bg-white/40'
                                        : active
                                          ? 'bg-[#8fa0ff]'
                                          : 'bg-white/25',
                                )}
                                style={{
                                    height: `${Math.max(12, value)}%`,
                                }}
                            />
                        );
                    })}
                </div>
                <div
                    className={cn(
                        'mt-0.5 flex items-center gap-2 text-xs',
                        own ? 'text-white/75' : 'text-white/45',
                    )}
                >
                    <span className="tabular-nums">
                        {formatDuration(
                            isPlaying || current > 0 ? current : duration,
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={cycleSpeed}
                        className={cn(
                            'rounded-md px-1.5 py-px text-xs font-bold transition',
                            own
                                ? 'bg-white/15 hover:bg-white/25'
                                : 'bg-white/[0.07] hover:bg-white/15',
                        )}
                    >
                        {speed}×
                    </button>
                </div>
            </div>
        </div>
    );
}

function fileVisual(name: string | null | undefined, mime?: string | null) {
    const ext = (name?.split('.').pop() ?? '').toLowerCase();

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return { icon: FileArchive, tone: 'from-amber-400 to-orange-500' };
    }
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
        return { icon: FileSpreadsheet, tone: 'from-emerald-400 to-teal-500' };
    }
    if (mime?.startsWith('audio/')) {
        return { icon: FileAudio, tone: 'from-[#f04fd8] to-[#a855f7]' };
    }
    if (mime?.startsWith('video/')) {
        return { icon: FileVideo, tone: 'from-rose-400 to-[#f04fd8]' };
    }
    if (['js', 'ts', 'php', 'json', 'html', 'css', 'py', 'cs'].includes(ext)) {
        return { icon: FileCode, tone: 'from-[#38e1ff] to-[#4f8bff]' };
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) {
        return { icon: FileText, tone: 'from-[#4f8bff] to-[#6d5dfc]' };
    }

    return { icon: FileIcon, tone: 'from-slate-400 to-slate-600' };
}

export function FileAttachment({
    attachment,
    own,
}: {
    attachment: ChatAttachment;
    own: boolean;
}) {
    const { icon: Icon, tone } = fileVisual(attachment.name, attachment.mime);
    const ext = attachment.name?.split('.').pop()?.toUpperCase();

    return (
        <a
            href={attachment.url}
            download={attachment.name ?? true}
            className={cn(
                'group/file flex w-[min(300px,62vw)] items-center gap-3 rounded-[14px] p-2 transition',
                own ? 'hover:bg-white/10' : 'hover:bg-white/[0.05]',
            )}
        >
            <span
                className={cn(
                    'relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
                    tone,
                )}
            >
                <Icon className="size-5 transition group-hover/file:opacity-0" />
                <Download className="absolute size-5 opacity-0 transition group-hover/file:opacity-100" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                    {attachment.name ?? tr('Файл')}
                </span>
                <span
                    className={cn(
                        'block text-xs',
                        own ? 'text-white/70' : 'text-white/45',
                    )}
                >
                    {formatBytes(attachment.size)}
                    {ext && ` · ${ext}`}
                </span>
            </span>
        </a>
    );
}

export function ContactAttachment({
    contact,
    own,
}: {
    contact: ContactCard | null | undefined;
    own: boolean;
}) {
    if (!contact) {
        return (
            <div className="flex w-[min(260px,62vw)] items-center gap-3 py-1 text-sm opacity-70">
                <span className="flex size-11 items-center justify-center rounded-full bg-white/10">
                    <UserRound className="size-5" />
                </span>
                {tr('Акаунт видалено')}
            </div>
        );
    }

    return (
        <div className="w-[min(260px,62vw)] py-0.5">
            <div className="flex items-center gap-3">
                <UserAvatar user={contact} size="md" />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-[14.5px] font-semibold">
                        {contact.name}
                        {contact.is_verified && <VerifiedBadge />}
                    </span>
                    <span
                        className={cn(
                            'block truncate text-xs',
                            own ? 'text-white/70' : 'text-white/45',
                        )}
                    >
                        @{contact.username}
                    </span>
                </span>
            </div>
            <div
                className={cn(
                    'mt-2.5 grid grid-cols-2 gap-1.5 border-t pt-2',
                    own ? 'border-white/20' : 'border-white/[0.07]',
                )}
            >
                <Link
                    href={`/${contact.username}`}
                    className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition',
                        own
                            ? 'bg-white/15 hover:bg-white/25'
                            : 'bg-white/[0.06] hover:bg-white/10',
                    )}
                >
                    <UserRound className="size-3.5" /> {tr('Профіль')}
                </Link>
                <Link
                    href={`/messages/with/${contact.username}`}
                    className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition',
                        own
                            ? 'bg-white/15 hover:bg-white/25'
                            : 'bg-[#6d5dfc]/20 text-[#c7c0ff] hover:bg-[#6d5dfc]/30',
                    )}
                >
                    <MessageCircle className="size-3.5" /> {tr('Написати')}
                </Link>
            </div>
        </div>
    );
}
