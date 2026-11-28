import { SendHorizonal } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';

/**
 * «Відправлено»: літачок відлітає вправо-вгору, а з лівого нижнього кута прилітає новий.
 * [sent] — лічильник відправок; кожна зміна запускає політ.
 */
export function FlyingSendIcon({
    sent,
    className = 'size-5',
}: {
    sent: number;
    className?: string;
}) {
    const reduce = useReducedMotion();
    if (reduce) return <SendHorizonal className={className} />;

    return (
        <span className="relative grid place-items-center overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
                <m.span
                    key={sent}
                    initial={{ x: -18, y: 14, opacity: 0, scale: 0.6 }}
                    animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    exit={{
                        x: 26,
                        y: -22,
                        opacity: 0,
                        scale: 0.7,
                        rotate: -12,
                    }}
                    transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                    className="grid place-items-center"
                >
                    <SendHorizonal className={className} />
                </m.span>
            </AnimatePresence>
        </span>
    );
}

/**
 * Кошик у стилі Lucide: поки [eating] — кришка відкидається, всередину падає аркуш, кришка закривається.
 */
export function HungryTrashIcon({
    eating,
    className = 'size-4',
}: {
    eating: boolean;
    className?: string;
}) {
    const reduce = useReducedMotion();
    const run = eating && !reduce;

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            {/* Аркуш падає в кошик */}
            <m.rect
                x={9}
                y={2}
                width={6}
                height={7}
                rx={1}
                initial={false}
                animate={
                    run
                        ? { y: [-6, 2, 10], opacity: [0, 1, 0] }
                        : { y: -6, opacity: 0 }
                }
                transition={{ duration: 0.55, times: [0, 0.45, 1] }}
            />
            {/* Кришка: обертається навколо лівого краю */}
            <m.g
                style={{ originX: '3px', originY: '6px' }}
                initial={false}
                animate={run ? { rotate: [0, -32, -32, 0] } : { rotate: 0 }}
                transition={{ duration: 0.7, times: [0, 0.25, 0.7, 1] }}
            >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </m.g>
            {/* Корпус ледь «ковтає» */}
            <m.g
                style={{ originX: '12px', originY: '22px' }}
                initial={false}
                animate={run ? { scaleY: [1, 1, 0.9, 1] } : { scaleY: 1 }}
                transition={{ duration: 0.7, times: [0, 0.6, 0.8, 1] }}
            >
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
            </m.g>
        </svg>
    );
}
