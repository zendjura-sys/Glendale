// lucide paths (ISC) + lucide-animated control API (MIT, pqoqubbw pattern)

import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface Gamepad2IconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface Gamepad2IconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const Gamepad2Icon = forwardRef<Gamepad2IconHandle, Gamepad2IconProps>(
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
                        normal: { scale: 1 },
                        animate: { scale: [1, 1.12, 1] },
                    }}
                    transition={{ type: 'spring', stiffness: 320, damping: 12 }}
                    viewBox="0 0 24 24"
                    width={size}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <line x1="6" x2="10" y1="11" y2="11" />
                    <line x1="8" x2="8" y1="9" y2="13" />
                    <line x1="15" x2="15.01" y1="12" y2="12" />
                    <line x1="18" x2="18.01" y1="10" y2="10" />
                    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
                </motion.svg>
            </div>
        );
    },
);

Gamepad2Icon.displayName = 'Gamepad2Icon';

export { Gamepad2Icon };
