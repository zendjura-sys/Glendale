import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { PlusMark } from '@/types';

/** Позначка GameCon+ біля імені: плоский квадрат з плюсом в акцентному кольорі. */
export function PlusBadge({ className }: { className?: string }) {
    return (
        <span
            title="GameCon+"
            role="img"
            aria-label="GameCon+"
            className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-primary text-white',
                className,
            )}
        >
            <Plus className="size-3" strokeWidth={3} />
        </span>
    );
}

const loadedFonts = new Set<string>();

/** Шрифт ніку: підвантажуємо з Google Fonts один раз (лише кирилиця й латиниця, display=swap). */
export function loadNameFont(family: string | null | undefined): void {
    if (!family || loadedFonts.has(family) || typeof document === 'undefined')
        return;
    loadedFonts.add(family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap&subset=cyrillic`;
    document.head.appendChild(link);
}

function fontStyle(plus: PlusMark | null | undefined): CSSProperties {
    if (!plus?.font) return {};
    loadNameFont(plus.font);

    return { fontFamily: `'${plus.font}', var(--font-sans, sans-serif)` };
}

/** Колір і шрифт ніку GameCon+: однотонний або градієнт (значення лише з сервера). */
export function plusNameStyle(
    plus: PlusMark | null | undefined,
): CSSProperties | undefined {
    const colors = plus?.name;
    const font = fontStyle(plus);
    if (!colors?.length) return plus?.font ? font : undefined;
    if (colors.length === 1) return { ...font, color: colors[0] };

    return {
        ...font,
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
    // Світіння й веселка лягають поверх звичайного кольору ніку.
    if (plus.fx === 'neon' || plus.fx === 'rainbow') {
        return {
            className:
                plus.fx === 'neon' ? 'plus-name-neon' : 'plus-name-rainbow',
            style: {
                ...(plusNameStyle(plus) ?? { color: first }),
                ...fontStyle(plus),
                ['--plus-glow' as string]: first,
            },
        };
    }
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
            ...fontStyle(plus),
            backgroundImage: `linear-gradient(100deg, ${stops.join(', ')})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
        },
    };
}

/**
 * Стиль імені в стрічці, коментарях і картках: нік GameCon+ (з анімацією), інакше — колір
 * з нагород сезону (fallback).
 */
export function nameDisplayProps(
    plus: PlusMark | null | undefined,
    fallback?: CSSProperties,
): { style?: CSSProperties; className?: string } {
    if (!plus) return { style: fallback };
    const props = plusNameProps(plus);

    return props.style ? props : { ...props, style: fallback };
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
        // Для руху рамки «spin»: конічний перелив тих самих кольорів.
        ['--gc-frame-conic' as string]: `conic-gradient(from var(--gc-frame-angle, 0deg), ${colors.join(', ')}, ${colors[0]})`,
    };
}
