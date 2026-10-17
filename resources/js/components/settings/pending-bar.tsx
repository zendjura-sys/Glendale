import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import { pluralForm, tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';

/**
 * Панель незбережених змін (налаштування): «3 зміни · Скасувати · Зберегти».
 * Зміни видно одразу як попередній перегляд, але записуються лише після «Зберегти».
 * Рендериться в <body> (портал): предки сторінки анімуються transform-ом, а це ламає position: fixed.
 * На телефоні панель стоїть над нижнім меню, на ПК — внизу екрана над колонкою контенту.
 */
export function PendingBar({
    count,
    processing,
    onDiscard,
    form,
    onSave,
}: {
    count: number;
    processing: boolean;
    onDiscard: () => void;
    /** id форми, яку надсилає «Зберегти». */
    form?: string;
    /** Або власне збереження (коли форми немає, як в Адмінка → Режими). */
    onSave?: () => void;
}) {
    const reduce = useReducedMotion();
    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {count > 0 && (
                <m.div
                    initial={
                        reduce
                            ? { opacity: 0 }
                            : { opacity: 0, y: 24, scale: 0.98 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                        reduce
                            ? { opacity: 0 }
                            : { opacity: 0, y: 24, scale: 0.98 }
                    }
                    transition={motionOr(reduce, RISE)}
                    className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 flex justify-center px-3 lg:bottom-6 lg:pl-[300px]"
                    role="status"
                >
                    <div className="liquid-glass liquid-glass--dense pointer-events-auto flex w-full max-w-[560px] items-center gap-3 rounded-2xl py-2.5 pr-2.5 pl-4">
                        <span aria-hidden className="liquid-glass__glare" />
                        <span className="relative flex size-2 shrink-0">
                            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                            <span className="relative size-2 rounded-full bg-primary" />
                        </span>
                        <m.span
                            key={count}
                            initial={reduce ? false : { opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="min-w-0 flex-1 truncate text-sm text-white/80 tabular-nums"
                        >
                            {count}{' '}
                            {pluralForm(count, ['зміна', 'зміни', 'змін'])}
                        </m.span>
                        <button
                            type="button"
                            onClick={onDiscard}
                            disabled={processing}
                            className="h-9 rounded-xl px-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type={onSave ? 'button' : 'submit'}
                            form={onSave ? undefined : form}
                            onClick={onSave}
                            disabled={processing}
                            className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                            {processing ? tr('Зберігаємо…') : tr('Зберегти')}
                        </button>
                    </div>
                </m.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

/** Скільки полів форми відрізняється від збереженого стану. */
export function countChanges<T extends Record<string, unknown>>(
    data: T,
    saved: T,
): number {
    return Object.keys(data).filter(
        (key) => JSON.stringify(data[key]) !== JSON.stringify(saved[key]),
    ).length;
}
