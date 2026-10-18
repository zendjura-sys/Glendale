import { useMemo, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Прогрес у вигляді хвилі. Форма — декоративна, стала для кожного треку (з його ключа):
 * справжню хвилю довелося б декодувати з усього файлу. Перемотка: клік, перетягування, стрілки.
 */

function seeded(seed: string) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }

    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;

        return (h >>> 0) / 4294967296;
    };
}

function bars(seed: string, count: number): number[] {
    const rand = seeded(seed);
    let previous = 0.5;

    return Array.from({ length: count }, (_, i) => {
        // Плавна «пісня»: тихий вступ, гучніша середина, хвіст.
        const envelope = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / count);
        previous = previous * 0.45 + rand() * 0.55;

        return Math.max(0.12, Math.min(1, previous * envelope * 1.35));
    });
}

export function Waveform({
    seed,
    position,
    duration,
    onSeek,
    count = 72,
    className,
}: {
    seed: string;
    position: number;
    duration: number;
    onSeek: (seconds: number) => void;
    count?: number;
    className?: string;
}) {
    const heights = useMemo(() => bars(seed, count), [seed, count]);
    const box = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

    const seekTo = (clientX: number) => {
        const rect = box.current?.getBoundingClientRect();
        if (!rect || duration <= 0) return;
        const ratio = Math.min(
            Math.max((clientX - rect.left) / rect.width, 0),
            1,
        );
        onSeek(ratio * duration);
    };
    const down = (e: PointerEvent<HTMLDivElement>) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekTo(e.clientX);
    };
    const move = (e: PointerEvent<HTMLDivElement>) => {
        if (dragging.current) seekTo(e.clientX);
    };
    const up = () => {
        dragging.current = false;
    };
    const key = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 15 : 5;
        if (e.key === 'ArrowRight') onSeek(Math.min(position + step, duration));
        else if (e.key === 'ArrowLeft') onSeek(Math.max(position - step, 0));
        else if (e.key === 'Home') onSeek(0);
        else return;
        e.preventDefault();
    };
    const row = (tone: string) => (
        <div className="flex h-full items-center gap-[2px]">
            {heights.map((h, i) => (
                <span
                    key={i}
                    className={cn('flex-1 rounded-full', tone)}
                    style={{ height: `${h * 100}%` }}
                />
            ))}
        </div>
    );

    return (
        <div
            ref={box}
            role="slider"
            tabIndex={0}
            aria-label={tr('Перемотати')}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(position)}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={key}
            className={cn(
                'relative h-12 cursor-pointer touch-none rounded-lg select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60',
                className,
            )}
        >
            {row('bg-white/20')}
            {/* Зіграна частина — той самий ряд, обрізаний по прогресу (без перерахунку смуг). */}
            <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
            >
                {row('bg-white')}
            </div>
        </div>
    );
}
