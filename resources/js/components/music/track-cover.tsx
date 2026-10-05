import { Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const palettes = [
    'from-gc-blue via-gc-indigo to-gc-purple',
    'from-gc-mint via-gc-cyan to-gc-blue',
    'from-gc-pink via-gc-purple to-gc-indigo',
    'from-gc-coral via-gc-pink to-gc-purple',
];

export function TrackCover({
    url,
    seed = '',
    className,
}: {
    url: string | null | undefined;
    seed?: string | number;
    className?: string;
}) {
    if (url) {
        return (
            <img
                src={url}
                alt=""
                loading="lazy"
                className={cn('shrink-0 object-cover', className)}
            />
        );
    }

    const palette =
        palettes[
            String(seed)
                .split('')
                .reduce((sum, c) => sum + c.charCodeAt(0), 0) % palettes.length
        ];

    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center bg-gradient-to-br',
                palette,
                className,
            )}
        >
            <Music2 className="size-1/2 max-h-6 max-w-6 text-white/85" />
        </span>
    );
}

export function Equalizer({
    paused,
    className,
}: {
    paused?: boolean;
    className?: string;
}) {
    return (
        <span className={cn('gc-eq', paused && 'is-paused', className)}>
            <span />
            <span />
            <span />
        </span>
    );
}

export function SpotifyLogo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn('fill-spotify', className)}
        >
            <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm4.82 15.15a.65.65 0 0 1-.9.22c-2.46-1.5-5.56-1.84-9.21-1.01a.65.65 0 1 1-.29-1.27c4-.91 7.43-.52 10.18 1.16.31.19.41.59.22.9Zm1.28-2.86a.82.82 0 0 1-1.12.27c-2.82-1.73-7.11-2.23-10.44-1.22a.82.82 0 1 1-.47-1.57c3.8-1.15 8.53-.59 11.77 1.4.38.24.5.74.26 1.12Zm.11-2.97C14.83 8.8 9.27 8.62 6.05 9.6a.98.98 0 1 1-.57-1.88c3.7-1.12 9.84-.9 13.72 1.4a.98.98 0 0 1-1 1.7Z" />
        </svg>
    );
}
