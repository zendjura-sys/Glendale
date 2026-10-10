import {
    Box,
    CalendarDays,
    Clapperboard,
    UserRoundSearch,
    Crown,
    Film,
    Gamepad2,
    Image,
    MessageCircle,
    Music,
    Newspaper,
    Search,
    Server,
    Shield,
    Swords,
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
    music: Music,
    film: Film,
    server: Server,
    crown: Crown,
    'gamepad-2': Gamepad2,
    swords: Swords,
    'calendar-days': CalendarDays,
    clapperboard: Clapperboard,
    'user-round-search': UserRoundSearch,
};

export function ModuleIcon({ name, ...props }: { name: string } & LucideProps) {
    const Icon = icons[name] ?? Box;

    return <Icon {...props} />;
}
