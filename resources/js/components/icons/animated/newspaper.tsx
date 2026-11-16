// lucide paths (ISC) + lucide-animated control API (MIT, pqoqubbw pattern)

import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface NewspaperIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface NewspaperIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const NewspaperIcon = forwardRef<NewspaperIconHandle, NewspaperIconProps>(
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
                        normal: { x: 0, y: 0 },
                        animate: { x: [0, 0, -2, 0], y: [0, -3, 0, 0] },
                    }}
                    transition={{ duration: 0.55, ease: 'easeInOut' }}
                    viewBox="0 0 24 24"
                    width={size}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                    <path d="M18 14h-8" />
                    <path d="M15 18h-5" />
                    <path d="M10 6h8v4h-8V6Z" />
                </motion.svg>
            </div>
        );
    },
);

NewspaperIcon.displayName = 'NewspaperIcon';

export { NewspaperIcon };
