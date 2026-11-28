import { Link } from '@inertiajs/react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sheen Pill Button — craft adapted from 21st.dev/@bidyut10/sheen-pill-button
 * (frosted pill + rim sheen). Arena Black dark variant for GameCon CTAs.
 */

type Common = {
    children: ReactNode;
    className?: string;
    tone?: 'primary' | 'glass' | 'ghost';
};

type AsButton = Common &
    ComponentProps<'button'> & {
        href?: undefined;
    };

type AsLink = Common & {
    href: string;
};

export function SheenPillButton({
    children,
    className,
    tone = 'primary',
    ...props
}: AsButton | AsLink) {
    const classes = cn(
        'sheen-pill group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] transition-[transform,filter] duration-200',
        'focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--primary)_45%,transparent)] focus-visible:outline-none',
        'active:scale-[0.98] hover:scale-[1.02]',
        tone === 'primary' && 'sheen-pill--primary text-white',
        tone === 'glass' && 'sheen-pill--glass text-white',
        tone === 'ghost' && 'sheen-pill--ghost text-white/85 hover:text-white',
        className,
    );

    const sheen = (
        <>
            <span aria-hidden className="sheen-pill__rim" />
            <span aria-hidden className="sheen-pill__band" />
            <span className="relative z-1">{children}</span>
        </>
    );

    if ('href' in props && props.href) {
        return (
            <Link href={props.href} className={classes}>
                {sheen}
            </Link>
        );
    }

    const buttonProps = props as ComponentProps<'button'>;

    return (
        <button type="button" {...buttonProps} className={classes}>
            {sheen}
        </button>
    );
}
