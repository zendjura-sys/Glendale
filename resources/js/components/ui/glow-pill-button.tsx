import { Link } from '@inertiajs/react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Glow Pill Button — craft adapted from 21st.dev/@louisstudios/glow-button
 * (dark pill with sweeping rim light). Tuned to GameCon Arena Blue.
 */

type Props = {
    children: ReactNode;
    className?: string;
    href?: string;
} & Omit<ComponentProps<'button'>, 'children' | 'className'>;

export function GlowPillButton({
    children,
    className,
    href,
    ...props
}: Props) {
    const classes = cn('glow-pill', className);
    const inner = (
        <>
            <span aria-hidden className="glow-pill__beam" />
            <span className="glow-pill__face">{children}</span>
        </>
    );

    if (href) {
        return (
            <Link href={href} className={classes}>
                {inner}
            </Link>
        );
    }

    return (
        <button type="button" {...props} className={classes}>
            {inner}
        </button>
    );
}
