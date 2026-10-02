import {
    Box,
    CalendarDays,
    Crown,
    Film,
    Image,
    MessageCircle,
    Music,
    Newspaper,
    Search,
    Server,
    Shield,
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
    'calendar-days': CalendarDays,
};

export function ModuleIcon({ name, ...props }: { name: string } & LucideProps) {
    const Icon = icons[name] ?? Box;

    return <Icon {...props} />;
}
