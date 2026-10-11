import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { PlusMark } from '@/types';

/** Позначка GameCon+ біля імені: плоский квадрат з плюсом в акцентному кольорі. */
export function PlusBadge({ className }: { className?: string }) {
    return (
        <span
            title="GameCon+"
            aria-label="GameCon+"
            className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-[var(--btn-primary,#6366f1)] text-white',
                className,
            )}
        >
            <Plus className="size-3" strokeWidth={3} />
        </span>
    );
}

/** Колір ніку GameCon+: однотонний або градієнт (значення лише з сервера). */
export function plusNameStyle(
    plus: PlusMark | null | undefined,
): CSSProperties | undefined {
    const colors = plus?.name;
    if (!colors?.length) return undefined;
    if (colors.length === 1) return { color: colors[0] };

    return {
        backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
    };
}

/**
 * Анімований нік GameCon+ (профіль, меню, прев’ю оформлення): перелив кольорів або відблиск.
 * Без ефекту — звичайний колір. Анімації вимикаються при «зменшити рух» (app.css).
 */
export function plusNameProps(plus: PlusMark | null | undefined): {
    style?: CSSProperties;
    className?: string;
} {
    if (!plus?.fx) return { style: plusNameStyle(plus) };
    const colors = plus.name?.length ? plus.name : ['#ffffff'];
    const first = colors[0];
    const last = colors[colors.length - 1];
    const stops =
        plus.fx === 'flow'
            ? colors.length > 1
                ? [...colors, first]
                : [first, '#ffffff', first]
            : [
                  `${first} 0%`,
                  `${last} 42%`,
                  '#ffffff 50%',
                  `${last} 58%`,
                  `${first} 100%`,
              ];

    return {
        className: plus.fx === 'flow' ? 'plus-name-flow' : 'plus-name-shine',
        style: {
            backgroundImage: `linear-gradient(100deg, ${stops.join(', ')})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
        },
    };
}

/** Ім’я з кольором GameCon+ і позначкою. */
export function PlusName({
    name,
    plus,
    className,
    badgeClassName,
}: {
    name: string;
    plus: PlusMark | null | undefined;
    className?: string;
    badgeClassName?: string;
}) {
    return (
        <>
            <span className={className} style={plusNameStyle(plus)}>
                {name}
            </span>
            {plus && <PlusBadge className={badgeClassName} />}
        </>
    );
}

/** Рамка аватара: плоске двоколірне кільце. */
export function plusFrameStyle(
    plus: PlusMark | null | undefined,
): CSSProperties | undefined {
    const colors = plus?.frame;
    if (!colors?.length) return undefined;

    return {
        backgroundImage: `linear-gradient(135deg, ${colors.join(', ')})`,
    };
}
