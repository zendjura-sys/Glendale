import { Link } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Props = ComponentProps<typeof Link>;

export default function TextLink({
    className = '',
    children,
    ...props
}: Props) {
    return (
        <Link
            className={cn(
                'font-medium text-gc-lilac-300 transition-colors hover:text-white',
                className,
            )}
            {...props}
        >
            {children}
        </Link>
    );
}
