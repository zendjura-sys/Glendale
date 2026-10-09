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
                    onClick={() => onChange(value === item.key ? null : item.key)}
                    className={cn(
                        'flex size-9 items-center justify-center rounded-xl text-xl transition hover:bg-white/10',
                        value === item.key && 'bg-white/10 ring-1 ring-white/20',
                    )}
                    aria-pressed={value === item.key}
                >
                    {item.emoji}
                </button>
            ))}
        </div>
    );
}
