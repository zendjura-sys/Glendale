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
    Layers,
    UserRoundSearch,
    Crown,
    Film,
    Gamepad2,
    Image,
    MessageCircle,
    MessagesSquare,
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
import { CalendarDaysIcon } from '@/components/icons/animated/calendar-days';
import { ClapperboardIcon } from '@/components/icons/animated/clapperboard';
import { CrownIcon } from '@/components/icons/animated/crown';
import { FilmIcon } from '@/components/icons/animated/film';
import { Gamepad2Icon } from '@/components/icons/animated/gamepad-2';
import { ImageIcon } from '@/components/icons/animated/image';
import { LayersIcon } from '@/components/icons/animated/layers';
import { MenuIcon } from '@/components/icons/animated/menu';
import { MessageCircleIcon } from '@/components/icons/animated/message-circle';
import { MoonIcon } from '@/components/icons/animated/moon';
import { MusicIcon } from '@/components/icons/animated/music';
import { NewspaperIcon } from '@/components/icons/animated/newspaper';
import { PhoneIcon } from '@/components/icons/animated/phone';
import { SearchIcon } from '@/components/icons/animated/search';
import { ServerIcon } from '@/components/icons/animated/server';
import { ShieldIcon } from '@/components/icons/animated/shield';
import { ShieldCheckIcon } from '@/components/icons/animated/shield-check';
import { SparklesIcon } from '@/components/icons/animated/sparkles';
import { SunIcon } from '@/components/icons/animated/sun';
import { SwordsIcon } from '@/components/icons/animated/swords';
import { TargetIcon } from '@/components/icons/animated/target';
import { UserIcon } from '@/components/icons/animated/user';
import { UserRoundSearchIcon } from '@/components/icons/animated/user-round-search';
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
    'messages-square': MessagesSquare,
    layers: Layers,
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

/** Усі модульні іконки — один формат lucide-animated (pqoqubbw API). */
const animated: Record<string, AnimatedIcon> = {
    'user-round': UserIcon,
    newspaper: NewspaperIcon,
    phone: PhoneIcon,
    'users-round': UsersRoundIcon,
    search: SearchIcon,
    'message-circle': MessageCircleIcon,
    shield: ShieldIcon,
    image: ImageIcon,
    music: MusicIcon,
    film: FilmIcon,
    server: ServerIcon,
    crown: CrownIcon,
    'gamepad-2': Gamepad2Icon,
    swords: SwordsIcon,
    'calendar-days': CalendarDaysIcon,
    clapperboard: ClapperboardIcon,
    target: TargetIcon,
    layers: LayersIcon,
    'user-round-search': UserRoundSearchIcon,
    bell: BellIcon,
    menu: MenuIcon,
    moon: MoonIcon,
    sun: SunIcon,
    sparkles: SparklesIcon,
    'shield-check': ShieldCheckIcon,
};

/** Запасний варіант у тому ж API, якщо імені ще немає в наборі. */
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
            <Icon size={size} strokeWidth={2} />
        </m.span>
    );
});
Wiggle.displayName = 'Wiggle';

/**
 * Іконка розділу. З `animated` — один формат lucide-animated; тригери на hover/focus/touch
 * найближчого посилання чи кнопки (пункт меню, вкладка); з prefers-reduced-motion — статична.
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
        target.addEventListener('pointerdown', start);
        target.addEventListener('pointerup', stop);
        target.addEventListener('pointercancel', stop);
        target.addEventListener('touchstart', start, { passive: true });
        target.addEventListener('touchend', stop);
        target.addEventListener('touchcancel', stop);

        // Активна вкладка — короткий «пульс» при появі.
        if (
            target.getAttribute('aria-current') === 'page' ||
            target.getAttribute('aria-selected') === 'true' ||
            target.classList.contains('vkuiTabbarItem--selected')
        ) {
            start();
            const t = window.setTimeout(stop, 600);
            return () => {
                window.clearTimeout(t);
                target.removeEventListener('mouseenter', start);
                target.removeEventListener('mouseleave', stop);
                target.removeEventListener('focus', start);
                target.removeEventListener('blur', stop);
                target.removeEventListener('pointerdown', start);
                target.removeEventListener('pointerup', stop);
                target.removeEventListener('pointercancel', stop);
                target.removeEventListener('touchstart', start);
                target.removeEventListener('touchend', stop);
                target.removeEventListener('touchcancel', stop);
            };
        }

        return () => {
            target.removeEventListener('mouseenter', start);
            target.removeEventListener('mouseleave', stop);
            target.removeEventListener('focus', start);
            target.removeEventListener('blur', stop);
            target.removeEventListener('pointerdown', start);
            target.removeEventListener('pointerup', stop);
            target.removeEventListener('pointercancel', stop);
            target.removeEventListener('touchstart', start);
            target.removeEventListener('touchend', stop);
            target.removeEventListener('touchcancel', stop);
        };
    }, [on, name]);

    const Icon = icons[name] ?? Box;
    if (!on) {
        return (
            <Icon
                size={size}
                className={className}
                strokeWidth={2}
                {...props}
            />
        );
    }
    const Animated = animated[name];

    return (
        <span
            ref={host}
            className={cn(
                'inline-flex shrink-0 items-center justify-center',
                className,
            )}
            style={{ width: size, height: size }}
        >
            {Animated ? (
                <Animated ref={handle} size={size} className="inline-flex" />
            ) : (
                <Wiggle ref={handle} icon={Icon} size={size} />
            )}
        </span>
    );
}
