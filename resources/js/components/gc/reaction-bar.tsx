import { usePage } from '@inertiajs/react';
import { Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { compactNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

const reactions = [
    { id: 'like', glyph: '❤️', label: 'Подобається' },
    { id: 'fire', glyph: '🔥', label: 'Вогонь' },
    { id: 'laugh', glyph: '😂', label: 'Смішно' },
    { id: 'gg', glyph: '🎮', label: 'Добре зіграно' },
    { id: 'sad', glyph: '😢', label: 'Шкода' },
] as const;

/** Додаткові емоції GameCon+ (лише ставити; бачать їх усі). */
const plusReactions = [
    { id: 'love', glyph: '😍', label: 'Обожнюю' },
    { id: 'wow', glyph: '😮', label: 'Вау' },
    { id: 'clap', glyph: '👏', label: 'Браво' },
    { id: 'skull', glyph: '💀', label: 'Я помер' },
    { id: 'crown', glyph: '👑', label: 'Король' },
] as const;

const allReactions = [...reactions, ...plusReactions];

const HOLD_MS = 420;

/**
 * Одна кнопка реакції: дотик ставить «подобається» (або знімає свою реакцію),
 * довге натискання відкриває смужку з емоціями. Після вибору смужка згортається.
 */
export function ReactionBar({
    reaction,
    count,
    onPick,
}: {
    reaction: string | null;
    count: number;
    onPick: (reaction: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const timer = useRef<number | null>(null);
    const held = useRef(false);
    const box = useRef<HTMLDivElement>(null);
    const plus = Boolean(usePage().props.auth.user?.plus);
    const current = allReactions.find((item) => item.id === reaction) ?? null;
    const available = plus ? allReactions : reactions;

    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            if (!box.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) =>
            event.key === 'Escape' && setOpen(false);
        window.addEventListener('pointerdown', close);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', close);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    useEffect(
        () => () => {
            if (timer.current) window.clearTimeout(timer.current);
        },
        [],
    );

    const startHold = () => {
        held.current = false;
        timer.current = window.setTimeout(() => {
            held.current = true;
            setOpen(true);
            navigator.vibrate?.(10);
        }, HOLD_MS);
    };
    const stopHold = () => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = null;
    };
    const pick = (id: string) => {
        setOpen(false);
        onPick(id);
    };

    return (
        <div ref={box} className="relative inline-flex">
            {open && (
                <div
                    role="menu"
                    aria-label={tr('Реакції')}
                    className="glass-strong absolute bottom-full left-0 z-20 mb-2 flex max-w-[calc(100vw-32px)] animate-in items-center gap-1 overflow-x-auto rounded-full border border-white/10 p-1.5 shadow-xl duration-150 fade-in-0 slide-in-from-bottom-1"
                >
                    {available.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            title={tr(item.label)}
                            aria-label={tr(item.label)}
                            aria-pressed={reaction === item.id}
                            onClick={() => pick(item.id)}
                            className={cn(
                                'flex size-10 items-center justify-center rounded-full text-[22px] leading-none transition hover:bg-white/10 motion-safe:hover:-translate-y-0.5',
                                reaction === item.id && 'bg-white/15',
                            )}
                        >
                            {item.glyph}
                        </button>
                    ))}
                </div>
            )}
            <button
                type="button"
                aria-pressed={reaction !== null}
                aria-haspopup="menu"
                aria-expanded={open}
                title={tr('Утримуйте, щоб обрати емоцію')}
                aria-label={current ? tr(current.label) : tr('Подобається')}
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onContextMenu={(event) => {
                    event.preventDefault();
                    setOpen(true);
                }}
                onClick={() => {
                    if (held.current) {
                        held.current = false;

                        return;
                    }
                    onPick(reaction ?? 'like');
                }}
                className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm transition select-none [-webkit-touch-callout:none]',
                    current
                        ? 'bg-white/[0.1] text-white'
                        : 'bg-white/[0.045] text-white/70 hover:bg-white/10 hover:text-white',
                )}
            >
                {current ? (
                    <span className="text-base leading-none">
                        {current.glyph}
                    </span>
                ) : (
                    <Heart className="size-[18px]" />
                )}
                {count > 0 && (
                    <span className="text-xs tabular-nums">
                        {compactNumber(count)}
                    </span>
                )}
            </button>
        </div>
    );
}
