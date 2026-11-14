import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Поле входу/реєстрації: м'яка заливка, тонка рамка, акцентне кільце при фокусі; іконка ліворуч.
 * Підпис — для читачів екрана (sr-only), видимий — плейсхолдер.
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

/** Кнопка форми: на всю ширину, суцільна акцентна. */
export function AuthSubmit({
    children,
    disabled,
    ...props
}: ComponentProps<'button'> & { children: ReactNode }) {
    return (
        <button
            type="submit"
            disabled={disabled}
            {...props}
            className="btn-glow inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:outline-none disabled:opacity-60"
        >
            {children}
        </button>
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
