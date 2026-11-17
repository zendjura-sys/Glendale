import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Tab = {
    key: string;
    label: string;
    href: string;
    active?: boolean;
};

/**
 * Спільний каркас каталогів соцмережі: вкладки (Мої / Усі…) + пошук + сітка.
 * Контент карток лишається за модулем — міняємо лише оболонку.
 */
export function CatalogShell({
    title,
    description,
    tabs,
    search,
    onSearch,
    filters,
    actions,
    children,
    className,
}: {
    title: string;
    description?: string;
    tabs?: Tab[];
    search?: string;
    onSearch?: (value: string) => void;
    /** Додаткові фільтри поруч із пошуком (сервер, категорія…). */
    filters?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('space-y-4', className)}>
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="gc-type-display text-white">{title}</h1>
                    {description && (
                        <p className="gc-type-meta mt-1 max-w-2xl text-white/55">
                            {description}
                        </p>
                    )}
                </div>
                {actions}
            </header>

            {(tabs?.length || onSearch || filters) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {tabs && tabs.length > 0 && (
                        <nav
                            aria-label={tr('Розділ каталогу')}
                            className="flex [scrollbar-width:none] gap-2 overflow-x-auto"
                        >
                            {tabs.map((tab) => (
                                <a
                                    key={tab.key}
                                    href={tab.href}
                                    aria-current={
                                        tab.active ? 'page' : undefined
                                    }
                                    className={cn(
                                        'flex h-10 shrink-0 items-center rounded-xl px-4 text-sm font-semibold transition',
                                        tab.active
                                            ? 'bg-sky-500 text-white'
                                            : 'gc-solid text-white/70 hover:text-white',
                                    )}
                                >
                                    {tab.label}
                                </a>
                            ))}
                        </nav>
                    )}
                    {onSearch && (
                        <label className="gc-solid relative min-w-0 flex-1 rounded-xl">
                            <Search
                                aria-hidden
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40"
                            />
                            <input
                                value={search ?? ''}
                                onChange={(e) => onSearch(e.target.value)}
                                placeholder={tr('Пошук…')}
                                className="h-10 w-full rounded-xl bg-transparent pr-3 pl-10 text-sm text-white outline-none placeholder:text-white/35"
                            />
                        </label>
                    )}
                    {filters}
                </div>
            )}

            {children}
        </div>
    );
}

/** Сітка карток каталогу — однакова щільність у всіх розділах. */
export function CatalogGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
                className,
            )}
        >
            {children}
        </div>
    );
}
