import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Накручує число 0 → value за ~800ms при появі в кадрі.
 * Підтримує рядки на кшталт «2,1K» — анімує числову частину.
 */
export function GcAnimatedNumber({
    value,
    className,
    duration = 800,
}: {
    value: number | string;
    className?: string;
    duration?: number;
}) {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLSpanElement>(null);
    const [text, setText] = useState(() =>
        reduce ? String(value) : format(0, value),
    );

    useEffect(() => {
        if (reduce) {
            setText(String(value));
            return;
        }
        const el = ref.current;
        if (!el) return;
        let frame = 0;
        let start = 0;
        const target = parseTarget(value);
        const io = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting) return;
                io.disconnect();
                start = performance.now();
                const tick = (now: number) => {
                    const t = Math.min(1, (now - start) / duration);
                    const eased = 1 - Math.pow(1 - t, 3);
                    setText(format(target * eased, value));
                    if (t < 1) frame = requestAnimationFrame(tick);
                    else setText(String(value));
                };
                frame = requestAnimationFrame(tick);
            },
            { threshold: 0.4 },
        );
        io.observe(el);
        return () => {
            io.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [value, duration, reduce]);

    return (
        <span ref={ref} className={cn('tabular-nums', className)}>
            {text}
        </span>
    );
}

function parseTarget(value: number | string): number {
    if (typeof value === 'number') return value;
    const n = parseFloat(value.replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function format(n: number, template: number | string): string {
    if (typeof template === 'number') {
        return String(Math.round(n));
    }
    const hasK = /k/i.test(template);
    const decimals = template.includes(',') || template.includes('.') ? 1 : 0;
    const body = n.toFixed(decimals).replace('.', ',');
    return hasK ? `${body}K` : body + template.replace(/[\d.,]+/, '');
}
