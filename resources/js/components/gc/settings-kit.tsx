import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Toggle } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Спільні деталі сторінок налаштувань груп (сім’я, клан, гільдія):
 * смуга переходів між блоками, плитки розділів з перемикачем і панель «Є незбережені зміни».
 */
export function SettingsNav({
    items,
}: {
    items: { id: string; label: string; icon: LucideIcon }[];
}) {
    return (
        <nav
            aria-label={tr('Розділи налаштувань')}
            className="gc-solid sticky top-[calc(88px+env(safe-area-inset-top))] z-20 -mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-2xl p-1.5"
        >
            {items.map(({ id, label, icon: Icon }) => (
                <a
                    key={id}
                    href={`#${id}`}
                    onClick={(e) => {
                        const el = document.getElementById(id);
                        if (!el) {
                            return;
                        }
                        e.preventDefault();
                        el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                        history.replaceState(null, '', `#${id}`);
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-white/65 hover:bg-white/[0.06] hover:text-white"
                >
                    <Icon className="size-4" />
                    {label}
                </a>
            ))}
        </nav>
    );
}

export function SettingsAnchor({
    id,
    children,
}: {
    id: string;
    children: ReactNode;
}) {
    return (
        <div id={id} className="scroll-mt-40">
            {children}
        </div>
    );
}

/** Розділ або функція: іконка, назва, пояснення й перемикач. */
export function FeatureTile({
    icon: Icon,
    label,
    text,
    on,
    onChange,
    disabled,
}: {
    icon: LucideIcon;
    label: string;
    text: string;
    on: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl p-3 transition-colors',
                on ? 'bg-primary/10' : 'gc-solid-2',
                disabled && 'cursor-not-allowed opacity-50',
            )}
        >
            <span
                className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl',
                    on
                        ? 'bg-primary/20 text-primary'
                        : 'bg-white/[0.06] text-white/45',
                )}
            >
                <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">
                    {label}
                </span>
                <span className="block text-xs text-white/50">{text}</span>
            </span>
            <Toggle
                checked={on}
                onChange={onChange}
                disabled={disabled}
                label={label}
            />
        </label>
    );
}

/** Нижня панель, коли є незбережені зміни: «Скасувати» й «Зберегти». */
export function SaveBar({
    dirty,
    processing,
    onSave,
    onReset,
}: {
    dirty: boolean;
    processing?: boolean;
    onSave: () => void;
    onReset: () => void;
}) {
    const reduce = useReducedMotion();

    return (
        <AnimatePresence>
            {dirty && (
                <m.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 flex justify-center px-4 lg:bottom-6"
                >
                    <div
                        role="status"
                        className="gc-solid pointer-events-auto flex w-full max-w-lg items-center gap-2 rounded-2xl p-2 pl-4 shadow-2xl ring-1 shadow-black/30 ring-primary/30"
                    >
                        <span className="flex-1 text-sm text-white/80">
                            {tr('Є незбережені зміни')}
                        </span>
                        <button
                            type="button"
                            onClick={onReset}
                            className="h-9 rounded-xl px-3 text-sm font-medium text-white/70 hover:bg-white/[0.06]"
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type="button"
                            disabled={processing}
                            onClick={onSave}
                            className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
