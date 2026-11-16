// lucide paths (ISC) + lucide-animated control API (MIT, pqoqubbw pattern)

import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface SwordsIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface SwordsIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const SwordsIcon = forwardRef<SwordsIconHandle, SwordsIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(ref, () => {
            isControlledRef.current = true;

            return {
                startAnimation: () => void controls.start('animate'),
                stopAnimation: () => void controls.start('normal'),
            };
        });

        const handleMouseEnter = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (isControlledRef.current) {
                    onMouseEnter?.(e);
                } else {
                    void controls.start('animate');
                }
            },
            [controls, onMouseEnter],
        );

        const handleMouseLeave = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (isControlledRef.current) {
                    onMouseLeave?.(e);
                } else {
                    void controls.start('normal');
                }
            },
            [controls, onMouseLeave],
        );

        return (
            <div
                className={cn(className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...props}
            >
                <motion.svg
                    animate={controls}
                    fill="none"
                    height={size}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    variants={{
                        normal: { rotate: 0, scale: 1 },
                        animate: { rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] },
                    }}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                    viewBox="0 0 24 24"
                    width={size}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                    <line x1="13" x2="19" y1="19" y2="13" />
                    <line x1="16" x2="20" y1="16" y2="20" />
                    <line x1="19" x2="21" y1="21" y2="19" />
                    <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
                    <line x1="5" x2="9" y1="14" y2="18" />
                    <line x1="7" x2="4" y1="17" y2="20" />
                    <line x1="3" x2="5" y1="19" y2="21" />
                </motion.svg>
            </div>
        );
    },
);

SwordsIcon.displayName = 'SwordsIcon';

export { SwordsIcon };
