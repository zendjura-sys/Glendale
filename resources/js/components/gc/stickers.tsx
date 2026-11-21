import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/** Ті самі ключі, що в App\Support\Stickers. */
export const STICKERS = [
    { key: 'gg', emoji: '🏆' },
    { key: 'fire', emoji: '🔥' },
    { key: 'heart', emoji: '💜' },
    { key: 'laugh', emoji: '😂' },
    { key: 'clap', emoji: '👏' },
    { key: 'game', emoji: '🎮' },
    { key: 'star', emoji: '⭐' },
    { key: 'cool', emoji: '😎' },
] as const;

export function stickerEmoji(key: string | null | undefined): string | null {
    return STICKERS.find((item) => item.key === key)?.emoji ?? null;
}

export function StickerPicker({
    value,
    onChange,
}: {
    value: string | null;
    onChange: (key: string | null) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1">
            {STICKERS.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                        onChange(value === item.key ? null : item.key)
                    }
                    className={cn(
                        'flex size-9 items-center justify-center rounded-xl text-xl transition hover:bg-white/10',
                        value === item.key && 'bg-white/10',
                    )}
                    aria-pressed={value === item.key}
                >
                    {item.emoji}
                </button>
            ))}
        </div>
    );
}

/** Відеостікер WebM (решта — картинки, зокрема анімовані GIF і WebP). */
export function isVideoSticker(url: string | null | undefined): boolean {
    return !!url && /\.webm(\?|$)/i.test(url);
}

/**
 * Стікер із набору: картинка або відеостікер (беззвучно, по колу). Коли людина просить менше руху,
 * відео стоїть на першому кадрі й грає лише під курсором.
 */
export function StickerMedia({
    url,
    alt,
    className,
    onLoad,
}: {
    url: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
}) {
    const reduce = useReducedMotion();

    if (!isVideoSticker(url)) {
        return (
            <img
                loading="lazy"
                decoding="async"
                src={url}
                alt={alt}
                onLoad={onLoad}
                className={className}
            />
        );
    }

    return (
        <video
            src={url}
            aria-label={alt}
            autoPlay={!reduce}
            loop
            muted
            playsInline
            preload="metadata"
            onLoadedData={onLoad}
            onMouseEnter={
                reduce
                    ? (e) => void e.currentTarget.play().catch(() => undefined)
                    : undefined
            }
            onMouseLeave={reduce ? (e) => e.currentTarget.pause() : undefined}
            className={className}
        />
    );
}
