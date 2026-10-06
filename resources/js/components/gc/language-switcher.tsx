import { usePage } from '@inertiajs/react';
import { Check, Languages } from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiError, api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Зміна мови зберігається і сторінка завантажується повністю: словник і переклад приходять разом. */
export function setLocale(code: string) {
    void api('POST', '/locale', { locale: code })
        .then(() => window.location.reload())
        .catch((error: unknown) => {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : tr('Щось пішло не так. Спробуйте ще раз.'),
            );
        });
}

function useLocales() {
    const { locale, locales } = usePage().props;

    return { locale, locales: locales ?? [] };
}

/** Компактний вибір мови (сторінки входу, мобільне меню, налаштування). */
export function LanguageSelect({ className }: { className?: string }) {
    const { locale, locales } = useLocales();
    if (locales.length < 2) {
        return null;
    }

    return (
        <label
            className={cn(
                'inline-flex items-center gap-2 text-sm text-white/60',
                className,
            )}
        >
            <Languages className="size-4 shrink-0 text-white/45" />
            <span className="sr-only">{tr('Мова')}</span>
            <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="input-glass h-9 min-w-0 rounded-xl px-2.5 text-sm text-white"
            >
                {locales.map((l) => (
                    <option key={l.code} value={l.code}>
                        {l.native}
                    </option>
                ))}
            </select>
        </label>
    );
}

/** Підменю «Мова» у меню профілю. */
export function LanguageMenu() {
    const { locale, locales } = useLocales();
    if (locales.length < 2) {
        return null;
    }
    const current = locales.find((l) => l.code === locale);

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-lg focus:bg-white/[0.06]">
                <Languages className="size-4" />
                <span className="flex-1">{tr('Мова')}</span>
                <span className="text-xs text-white/40">{current?.native}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                {locales.map((l) => (
                    <DropdownMenuItem
                        key={l.code}
                        onSelect={() => l.code !== locale && setLocale(l.code)}
                        className="rounded-lg focus:bg-white/[0.06]"
                    >
                        <span className="flex-1">{l.native}</span>
                        {l.code === locale && (
                            <Check className="size-4 text-gc-lilac-200" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
}
