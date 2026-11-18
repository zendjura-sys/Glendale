import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { SheenPillButton } from '@/components/ui/sheen-pill-button';

/**
 * Поле входу/реєстрації — 21st Input Group Glass craft (pill + icon).
 */
export function AuthField({
    icon: Icon,
    label,
    className,
    ...props
}: ComponentProps<'input'> & { icon: LucideIcon; label: string }) {
    return (
        <label className="relative block">
            <span className="sr-only">{label}</span>
            <Input
                {...props}
                data-icon=""
                placeholder={props.placeholder ?? label}
                className={className}
            />
            <Icon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-4 size-[17px] -translate-y-1/2 text-white/45"
            />
        </label>
    );
}

/** Submit — 21st Sheen Pill, full width. */
export function AuthSubmit({
    children,
    disabled,
    ...props
}: ComponentProps<'button'> & { children: ReactNode }) {
    return (
        <SheenPillButton
            {...props}
            type="submit"
            disabled={disabled}
            tone="primary"
            className="h-12 w-full"
        >
            {children}
        </SheenPillButton>
    );
}

/** Перехід між входом і реєстрацією — тихий рядок під кнопкою. */
export function AuthSwitch({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="w-full text-center text-sm font-medium text-white/60 transition hover:text-white"
        >
            {children}
        </Link>
    );
}
