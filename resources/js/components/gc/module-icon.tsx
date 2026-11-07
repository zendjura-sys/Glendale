import {
    Bell,
    Menu,
    Moon,
    ShieldCheck,
    Sparkles,
    Sun,
    Box,
    CalendarDays,
    Clapperboard,
    Target,
    UserRoundSearch,
    Crown,
    Film,
    Gamepad2,
    Image,
    MessageCircle,
    Music,
    Newspaper,
    Phone,
    Search,
    Server,
    Shield,
    Swords,
    UserRound,
    UsersRound,
} from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { m, useAnimation, useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ComponentType, RefAttributes } from 'react';
import { BellIcon } from '@/components/icons/animated/bell';
import { MenuIcon } from '@/components/icons/animated/menu';
import { MoonIcon } from '@/components/icons/animated/moon';
import { ShieldCheckIcon } from '@/components/icons/animated/shield-check';
import { SparklesIcon } from '@/components/icons/animated/sparkles';
import { SunIcon } from '@/components/icons/animated/sun';
import { CalendarDaysIcon } from '@/components/icons/animated/calendar-days';
import { MessageCircleIcon } from '@/components/icons/animated/message-circle';
import { PhoneIcon } from '@/components/icons/animated/phone';
import { SearchIcon } from '@/components/icons/animated/search';
import { ServerIcon } from '@/components/icons/animated/server';
import { UserIcon } from '@/components/icons/animated/user';
import { UsersRoundIcon } from '@/components/icons/animated/users-round';
import { cn } from '@/lib/utils';

const icons: Record<string, LucideIcon> = {
    'user-round': UserRound,
    newspaper: Newspaper,
    phone: Phone,
    'users-round': UsersRound,
    search: Search,
    'message-circle': MessageCircle,
    shield: Shield,
    image: Image,
    music: Music,
    film: Film,
    server: Server,
    crown: Crown,
    'gamepad-2': Gamepad2,
    swords: Swords,
    'calendar-days': CalendarDays,
    clapperboard: Clapperboard,
    target: Target,
    'user-round-search': UserRoundSearch,
    bell: Bell,
    menu: Menu,
    moon: Moon,
    sun: Sun,
    sparkles: Sparkles,
    'shield-check': ShieldCheck,
};

export type AnimatedIconHandle = {
    startAnimation: () => void;
    stopAnimation: () => void;
};

type AnimatedIcon = ComponentType<
    { className?: string; size?: number } & RefAttributes<AnimatedIconHandle>
>;

/** Анімовані іконки lucide-animated (pqoqubbw/icons, MIT) — там, де вони є в наборі. */
const animated: Record<string, AnimatedIcon> = {
    'user-round': UserIcon,
    phone: PhoneIcon,
    'users-round': UsersRoundIcon,
    search: SearchIcon,
    'message-circle': MessageCircleIcon,
    server: ServerIcon,
    'calendar-days': CalendarDaysIcon,
    bell: BellIcon,
    menu: MenuIcon,
    moon: MoonIcon,
    sun: SunIcon,
    sparkles: SparklesIcon,
    'shield-check': ShieldCheckIcon,
};

/** Для решти — та сама манера руху: легке погойдування з пружинним збільшенням. */
const Wiggle = forwardRef<
    AnimatedIconHandle,
    { icon: LucideIcon; size: number; className?: string }
>(({ icon: Icon, size, className }, ref) => {
    const controls = useAnimation();
    useImperativeHandle(ref, () => ({
        startAnimation: () =>
            void controls.start({
                scale: 1.08,
                rotate: [0, -8, 8, 0],
                transition: {
                    rotate: { duration: 0.5, ease: 'easeInOut' },
                    scale: { type: 'spring', stiffness: 400, damping: 10 },
                },
            }),
        stopAnimation: () => void controls.start({ scale: 1, rotate: 0 }),
    }));

    return (
        <m.span animate={controls} className={cn('inline-flex', className)}>
            <Icon size={size} />
        </m.span>
    );
});
Wiggle.displayName = 'Wiggle';

/**
 * Іконка розділу. З `animated` грає анімацію, коли курсор наводять на найближче посилання чи кнопку
 * (пункт меню, вкладка); з prefers-reduced-motion — звичайна статична іконка.
 */
export function ModuleIcon({
    name,
    animated: wantAnimated = false,
    size = 20,
    className,
    ...props
}: { name: string; animated?: boolean; size?: number } & LucideProps) {
    const reduce = useReducedMotion();
    const handle = useRef<AnimatedIconHandle>(null);
    const host = useRef<HTMLSpanElement>(null);
    const on = wantAnimated && !reduce;

    useEffect(() => {
        if (!on) return;
        const target = host.current?.closest('a, button');
        if (!target) return;
        const start = () => handle.current?.startAnimation();
        const stop = () => handle.current?.stopAnimation();
        target.addEventListener('mouseenter', start);
        target.addEventListener('mouseleave', stop);
        target.addEventListener('focus', start);
        target.addEventListener('blur', stop);

        return () => {
            target.removeEventListener('mouseenter', start);
            target.removeEventListener('mouseleave', stop);
            target.removeEventListener('focus', start);
            target.removeEventListener('blur', stop);
        };
    }, [on]);

    const Icon = icons[name] ?? Box;
    if (!on) {
        return <Icon size={size} className={className} {...props} />;
    }
    const Animated = animated[name];

    return (
        <span
            ref={host}
            className={cn('inline-flex shrink-0 items-center', className)}
        >
            {Animated ? (
                <Animated ref={handle} size={size} className="inline-flex" />
            ) : (
                <Wiggle ref={handle} icon={Icon} size={size} />
            )}
        </span>
    );
}
