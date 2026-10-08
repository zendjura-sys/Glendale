import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

const reactions = [
    { id: 'like', glyph: '♥', label: 'Подобається' },
    { id: 'fire', glyph: '🔥', label: 'Вогонь' },
    { id: 'laugh', glyph: '😂', label: 'Смішно' },
    { id: 'gg', glyph: 'GG', label: 'Добре зіграно' },
    { id: 'sad', glyph: '😢', label: 'Шкода' },
] as const;

export function ReactionBar({
    reaction,
    count,
    onPick,
}: {
    reaction: string | null;
    count: number;
    onPick: (reaction: string) => void;
}) {
    return (
        <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.045] p-1">
            {reactions.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    title={tr(item.label)}
                    aria-pressed={reaction === item.id}
                    onClick={() => onPick(item.id)}
                    className={cn(
                        'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm transition',
                        reaction === item.id
                            ? 'bg-white/15 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )}
                >
                    {item.glyph}
                </button>
            ))}
            {count > 0 && <span className="px-1.5 text-xs text-white/45 tabular-nums">{count}</span>}
        </div>
    );
}
