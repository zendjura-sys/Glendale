import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Пошук-пігулка: кругле поле з іконкою й хрестиком очищення. */
export function SearchPill({
    value,
    onValueChange,
    className,
    ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: string;
    onValueChange: (value: string) => void;
}) {
    return (
        <label
            className={cn(
                'gc-search-pill flex h-12 min-w-0 items-center gap-3 rounded-full px-4',
                className,
            )}
        >
            <Search className="size-5 shrink-0 text-white/45" />
            <input
                {...props}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                className="h-full min-w-0 flex-1 !border-0 !bg-transparent text-[15px] text-white !shadow-none outline-none placeholder:text-white/40"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onValueChange('')}
                    aria-label={tr('Очистити')}
                    className="text-white/40 hover:text-white"
                >
                    <X className="size-4" />
                </button>
            )}
        </label>
    );
}
