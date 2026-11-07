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

/**
 * Перелік для фраз на кшталт «пости, ігри й сервери»: лише слова розділів режиму
 * (`false` — розділу немає), останнє — через «і».
 */
export function listWords(words: (string | false)[]): string {
    const parts = words.filter((word): word is string => Boolean(word));
    if (parts.length < 2) {
        return parts[0] ?? '';
    }

    return tr('{list} і {last}', {
        list: parts.slice(0, -1).join(', '),
        last: parts[parts.length - 1],
    });
}

/** Ігрові розділи (як NetworkModes::GAMING): без жодного з них ігрових згадок не показуємо. */
export const GAMING_MODULES = [
    'servers',
    'games',
    'clans',
    'quests',
    'moments',
    'party',
    'families',
];

/** Списки друзів «Рейд» і «Кіно» — лише коли в режимі є ігри чи кіно. */
export function friendListAllowed(list: string, modules: string[]): boolean {
    if (list === 'raid') {
        return GAMING_MODULES.some((key) => modules.includes(key));
    }
    if (list === 'cinema') {
        return modules.includes('cinema');
    }

    return true;
}
