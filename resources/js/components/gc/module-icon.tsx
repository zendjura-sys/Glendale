import {
    Box,
    CalendarDays,
    Clapperboard,
    Film,
    Gamepad2,
    Image,
    MessageCircle,
    Music,
    Newspaper,
    Search,
    Shield,
    ShoppingBag,
    UserRound,
    UsersRound,
} from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
    'user-round': UserRound,
    newspaper: Newspaper,
    'users-round': UsersRound,
    search: Search,
    'message-circle': MessageCircle,
    shield: Shield,
    image: Image,
    clapperboard: Clapperboard,
    music: Music,
    film: Film,
    'gamepad-2': Gamepad2,
    'shopping-bag': ShoppingBag,
    'calendar-days': CalendarDays,
};

export function ModuleIcon({ name, ...props }: { name: string } & LucideProps) {
    const Icon = icons[name] ?? Box;

    return <Icon {...props} />;
}
