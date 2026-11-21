import { Quote } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/lib/i18n';

/**
 * Обгортка тексту запису: виділили фрагмент — над ним з’являється «Відповісти цитатою».
 * Кнопка віддає виділений текст (до 300 символів) батькові, той відкриває коментар із цитатою.
 */
export function QuoteSelection({
    children,
    onQuote,
    enabled = true,
}: {
    children: ReactNode;
    onQuote: (text: string) => void;
    enabled?: boolean;
}) {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLDivElement>(null);
    const [spot, setSpot] = useState<{
        x: number;
        y: number;
        text: string;
    } | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const check = () => {
            const sel = window.getSelection();
            const text = sel?.toString().trim() ?? '';
            if (
                !sel ||
                sel.rangeCount === 0 ||
                text.length < 3 ||
                !ref.current?.contains(sel.anchorNode) ||
                !ref.current.contains(sel.focusNode)
            ) {
                setSpot(null);

                return;
            }
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            setSpot({
                x: rect.left + rect.width / 2,
                y: rect.top,
                text: text.slice(0, 300),
            });
        };
        const onUp = () => window.setTimeout(check, 10);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        document.addEventListener('selectionchange', onUp);
        const hide = () => setSpot(null);
        window.addEventListener('scroll', hide, { passive: true });

        return () => {
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchend', onUp);
            document.removeEventListener('selectionchange', onUp);
            window.removeEventListener('scroll', hide);
        };
    }, [enabled]);

    return (
        <div ref={ref}>
            {children}
            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {spot && (
                            <motion.button
                                type="button"
                                initial={
                                    reduce
                                        ? false
                                        : { opacity: 0, y: 4, scale: 0.96 }
                                }
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0 }}
                                // mousedown, а не click: інакше виділення зникне раніше, ніж спрацює кнопка.
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onQuote(spot.text);
                                    window.getSelection()?.removeAllRanges();
                                    setSpot(null);
                                }}
                                onTouchStart={(e) => {
                                    e.preventDefault();
                                    onQuote(spot.text);
                                    setSpot(null);
                                }}
                                style={{
                                    left: spot.x,
                                    top: Math.max(8, spot.y - 46),
                                }}
                                className="fixed z-[70] inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-xl bg-[#1b2340] px-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/10"
                            >
                                <Quote className="size-4 text-primary" />
                                {tr('Відповісти цитатою')}
                            </motion.button>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}
        </div>
    );
}

/** Рядки коментаря, що починаються з «> », — цитата: окремий блок із рискою ліворуч. */
export function splitQuotes(body: string): { quote: boolean; text: string }[] {
    const parts: { quote: boolean; text: string }[] = [];
    for (const line of body.split('\n')) {
        const quote = line.startsWith('> ') || line === '>';
        const text = quote ? line.replace(/^>\s?/, '') : line;
        const last = parts[parts.length - 1];
        if (last && last.quote === quote) last.text += `\n${text}`;
        else parts.push({ quote, text });
    }

    return parts.filter((p) => p.text.trim() !== '' || !p.quote);
}
