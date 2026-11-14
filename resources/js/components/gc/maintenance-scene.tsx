import { m, useReducedMotion } from 'motion/react';
import { tr } from '@/lib/i18n';

/**
 * Технічні роботи: контурний кран повільно гойдає блок на тросі, внизу — пунктир «фундаменту».
 * Лінії як в іконках Lucide, тихий рух; із «менше руху» — нерухома картинка.
 */
export function MaintenanceScene({ className = '' }: { className?: string }) {
    const reduce = useReducedMotion();
    const swing = reduce
        ? {}
        : {
              animate: { rotate: [-6, 6, -6] },
              transition: {
                  duration: 4.8,
                  repeat: Infinity,
                  ease: 'easeInOut' as const,
              },
          };

    return (
        <svg
            viewBox="0 0 220 150"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            role="img"
            aria-label={tr('Кран піднімає блок')}
        >
            {/* Щогла */}
            <path d="M60 140V22" />
            <path d="M52 140V22" />
            {[38, 58, 78, 98, 118].map((y) => (
                <path key={y} d={`M52 ${y}l8 -16`} opacity={0.6} />
            ))}
            {/* Стріла й противага */}
            <path d="M30 22h150" />
            <path d="M30 30h150" opacity={0.45} />
            <rect x={30} y={30} width={18} height={12} rx={2} />
            <path d="M56 22L56 8L180 22" opacity={0.6} />
            {/* Візок на стрілі */}
            <rect x={136} y={30} width={14} height={6} rx={2} />
            {/* Трос і блок гойдаються навколо візка */}
            <m.g style={{ originX: '143px', originY: '36px' }} {...swing}>
                <path d="M143 36v54" />
                <path d="M138 90h10l-5 6z" />
                <rect
                    x={124}
                    y={96}
                    width={38}
                    height={22}
                    rx={3}
                    className="text-sky-400"
                    stroke="currentColor"
                />
                <path
                    d="M131 107h24"
                    className="text-sky-400"
                    stroke="currentColor"
                    opacity={0.6}
                />
            </m.g>
            {/* Земля */}
            <path d="M14 140h192" opacity={0.5} strokeDasharray="4 6" />
            <rect x={40} y={134} width={32} height={6} rx={1} />
        </svg>
    );
}
