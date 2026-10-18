import {
    Clapperboard,
    Compass,
    Feather,
    Gamepad2,
    Heart,
    Layers,
    Music2,
    Sparkles,
    Swords,
    UsersRound,
} from 'lucide-react';
import { tr } from '@/lib/i18n';

/** Режим соцмережі (як NetworkModes на сервері). */
export type NetworkMode = {
    id: string;
    name: string;
    description: string;
    icon: string;
    enabled: boolean;
    builtin: boolean;
    modules: string[];
    plugins_off: string[];
    features: Record<string, boolean>;
};

export const MODE_ICONS: Record<string, typeof Layers> = {
    'gamepad-2': Gamepad2,
    sparkles: Sparkles,
    compass: Compass,
    clapperboard: Clapperboard,
    feather: Feather,
    layers: Layers,
    'music-2': Music2,
    'users-round': UsersRound,
    swords: Swords,
    heart: Heart,
};

/** Модулі ядра: є в кожному режимі, тож у картках їх не перелічуємо. */
export const CORE_MODULES = ['profile', 'feed', 'friends'];

export function FEATURE_LABELS(): Record<string, string> {
    return {
        stories: tr('Історії'),
        live: tr('Трансляції друзів'),
        playing: tr('Ігрові блоки профілю («Граю в…», Steam, платформи)'),
    };
}
