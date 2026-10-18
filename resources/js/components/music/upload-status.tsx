import { m, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/lib/motion';

/**
 * Стан файлу під час завантаження: кільце прогресу з відсотками, потім галочка, що «малюється».
 * Замість Lottie — SVG + motion: той самий ефект без окремої бібліотеки й файлів анімацій.
 */

const R = 17;
const C = 2 * Math.PI * R;

export function ProgressRing({ value }: { value: number }) {
    return (
        <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            className="relative flex size-11 items-center justify-center"
        >
            <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                <circle
                    cx="20"
                    cy="20"
                    r={R}
                    fill="none"
                    stroke="rgb(255 255 255 / 0.1)"
                    strokeWidth="3"
                />
                <circle
                    cx="20"
                    cy="20"
                    r={R}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - value / 100)}
                    className="transition-[stroke-dashoffset] duration-300 ease-out"
                />
            </svg>
            <span className="text-[10px] font-semibold text-white tabular-nums">
                {value}%
            </span>
        </span>
    );
}

export function SuccessCheck() {
    const reduce = useReducedMotion();

    return (
        <m.span
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="flex size-11 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
            aria-label="OK"
        >
            <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <m.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.1 }}
                />
            </svg>
        </m.span>
    );
}
