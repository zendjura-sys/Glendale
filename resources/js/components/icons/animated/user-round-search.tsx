// lucide paths (ISC) + lucide-animated control API (MIT, pqoqubbw pattern)

import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface UserRoundSearchIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface UserRoundSearchIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const UserRoundSearchIcon = forwardRef<UserRoundSearchIconHandle, UserRoundSearchIconProps>(
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
                    <circle cx="10" cy="8" r="5" />
                    <path d="M2 21a8 8 0 0 1 10.434-7.62" />
                    <circle cx="18" cy="18" r="3" />
                    <path d="m22 22-1.9-1.9" />
                </motion.svg>
            </div>
        );
    },
);

UserRoundSearchIcon.displayName = 'UserRoundSearchIcon';

export { UserRoundSearchIcon };
