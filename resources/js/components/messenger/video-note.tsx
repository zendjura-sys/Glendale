import { Camera, Loader2, Send, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useDataSaver } from '@/lib/data-saver';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ChatAttachment } from '@/types';

export const VIDEO_NOTE_MAX_SECONDS = 60;

/** Кружок у чаті: беззвучне прев’ю по колу; дотик — зі звуком від початку, ще дотик — пауза. */
export function VideoNotePlayer({
    attachment,
}: {
    attachment: ChatAttachment;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    // Економія трафіку: кружок не грає сам і не вантажиться наперед.
    const saver = useDataSaver();
    const [active, setActive] = useState(false);
    const [progress, setProgress] = useState(0);

    const toggle = () => {
        const v = ref.current;
        if (!v) return;
        if (!active) {
            v.currentTime = 0;
            v.muted = false;
            v.loop = false;
            setActive(true);
            void v.play().catch(() => undefined);
        } else if (v.paused) {
            void v.play().catch(() => undefined);
        } else {
            v.pause();
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={tr('Відеоповідомлення')}
            className="relative block size-56 overflow-hidden rounded-full bg-black/40 ring-2 ring-white/10"
        >
            <video
                ref={ref}
                src={attachment.url}
                muted
                autoPlay={!saver}
                loop
                playsInline
                preload={saver ? 'none' : 'metadata'}
                onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (active && v.duration)
                        setProgress((v.currentTime / v.duration) * 100);
                }}
                onEnded={(e) => {
                    const v = e.currentTarget;
                    setActive(false);
                    setProgress(0);
                    v.muted = true;
                    v.loop = true;
                    void v.play().catch(() => undefined);
                }}
                className="size-full object-cover"
            />
            {active && (
                <svg
                    className="pointer-events-none absolute inset-0 -rotate-90"
                    viewBox="0 0 100 100"
                    aria-hidden
                >
                    <circle
                        cx="50"
                        cy="50"
                        r="48.5"
                        fill="none"
                        stroke="white"
                        strokeOpacity={0.9}
                        strokeWidth="2.5"
                        strokeDasharray={`${(progress / 100) * 304.7} 304.7`}
                    />
                </svg>
            )}
            {!active && attachment.duration ? (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white tabular-nums">
                    0:{String(attachment.duration).padStart(2, '0')}
                </span>
            ) : null}
        </button>
    );
}

/**
 * Запис кружка з фронтальної камери: кругле прев’ю, таймер до хвилини, «Надіслати» або «Скасувати».
 */
export function VideoNoteRecorder({
    onClose,
    onSend,
}: {
    onClose: () => void;
    onSend: (blob: Blob, duration: number) => void;
}) {
    const preview = useRef<HTMLVideoElement>(null);
    const recorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const stream = useRef<MediaStream | null>(null);
    const started = useRef(0);
    const [ready, setReady] = useState(false);
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        let cancelled = false;
        navigator.mediaDevices
            ?.getUserMedia({
                video: { facingMode: 'user', width: 480, height: 480 },
                audio: true,
            })
            .then((media) => {
                if (cancelled) {
                    media.getTracks().forEach((t) => t.stop());

                    return;
                }
                stream.current = media;
                if (preview.current) preview.current.srcObject = media;
                setReady(true);
            })
            .catch(() => {
                toast.error(tr('Немає доступу до камери або мікрофона.'));
                onClose();
            });

        return () => {
            cancelled = true;
            stream.current?.getTracks().forEach((t) => t.stop());
        };
    }, [onClose]);

    useEffect(() => {
        if (!recording) return;
        const timer = window.setInterval(() => {
            const s = Math.floor((Date.now() - started.current) / 1000);
            setSeconds(s);
            if (s >= VIDEO_NOTE_MAX_SECONDS) stop(true);
        }, 250);

        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording]);

    const start = () => {
        if (!stream.current) return;
        const type = [
            'video/webm;codecs=vp9,opus',
            'video/webm',
            'video/mp4',
        ].find((t) => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(
            stream.current,
            type ? { mimeType: type, videoBitsPerSecond: 900_000 } : undefined,
        );
        chunks.current = [];
        rec.ondataavailable = (e) =>
            e.data.size > 0 && chunks.current.push(e.data);
        recorder.current = rec;
        started.current = Date.now();
        rec.start(250);
        setSeconds(0);
        setRecording(true);
    };

    const stop = (send: boolean) => {
        const rec = recorder.current;
        if (!rec) return;
        rec.onstop = () => {
            const duration = Math.max(
                1,
                Math.min(
                    VIDEO_NOTE_MAX_SECONDS,
                    Math.round((Date.now() - started.current) / 1000),
                ),
            );
            if (send)
                onSend(
                    new Blob(chunks.current, {
                        type: rec.mimeType || 'video/webm',
                    }),
                    duration,
                );
            onClose();
        };
        rec.stop();
        setRecording(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-black/85 p-6 backdrop-blur">
            <div
                className={cn(
                    'relative size-72 overflow-hidden rounded-full ring-4',
                    recording ? 'ring-rose-500' : 'ring-white/20',
                )}
            >
                <video
                    ref={preview}
                    autoPlay
                    muted
                    playsInline
                    className="size-full -scale-x-100 object-cover"
                />
                {!ready && (
                    <span className="absolute inset-0 grid place-items-center">
                        <Loader2 className="size-8 animate-spin text-white/70 motion-reduce:animate-none" />
                    </span>
                )}
            </div>
            <p className="text-sm text-white/75 tabular-nums">
                {recording
                    ? `0:${String(seconds).padStart(2, '0')} / 1:00`
                    : tr('Відеокружок до хвилини')}
            </p>
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => (recording ? stop(false) : onClose())}
                    className="grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    aria-label={tr('Скасувати')}
                >
                    <X className="size-5" />
                </button>
                {recording ? (
                    <button
                        type="button"
                        onClick={() => stop(true)}
                        className="grid size-16 place-items-center rounded-full bg-primary text-white"
                        aria-label={tr('Надіслати')}
                    >
                        <Send className="size-6" />
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={!ready}
                        onClick={start}
                        className="grid size-16 place-items-center rounded-full bg-rose-500 text-white disabled:opacity-50"
                        aria-label={tr('Почати запис')}
                    >
                        <Camera className="size-6" />
                    </button>
                )}
                {recording && (
                    <button
                        type="button"
                        onClick={() => stop(false)}
                        className="grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                        aria-label={tr('Зупинити без відправки')}
                    >
                        <Square className="size-4" />
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
}
