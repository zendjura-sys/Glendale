import {
    Bell,
    BookOpen,
    CalendarDays,
    Camera,
    Clapperboard,
    Crown,
    Gamepad2,
    Headphones,
    Image,
    Mic,
    Phone,
    Radio,
    UserRound,
    MessageSquare,
    MessagesSquare,
    Music,
    Newspaper,
    Search,
    Server,
    Shield,
    Swords,
    Target,
    Users,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ActivityModule } from './Activity';
import { FeedModule } from './Feed';
import { FriendsModule } from './Friends';
import { MessengerModule } from './Messenger';
import { ProfileModule } from './Profile';
import { SectionModule } from './Section';
import { VoiceModule } from './Voice';
import { FamiliesModule } from './Families';
import { QuestsModule } from './Quests';
import { IconButton } from '@/components/ui';

export type ModuleDef = {
    id: string;
    title: string;
    icon: LucideIcon;
    /** Розділ сайту (config/modules.php), без якого модуля немає; null — завжди. */
    section: string | null;
    /** Плагін (config/plugins.php), без якого модуля немає. */
    plugin?: string;
    /** Модуль є, якщо ввімкнено будь-який із цих розділів (замість одного section). */
    anyOf?: string[];
    /** Повна сторінка розділу в програмі (док-рейл і «Відкрити» ведуть сюди). */
    page?: string;
    render: (header?: ReactNode) => ReactNode;
    wide?: boolean;
    /** Типовий розмір плитки в bento-сітці: s — компактна, m — звичайна, l — велика. */
    size?: 's' | 'm' | 'l';
};

const section = (id: string, title: string, icon: LucideIcon, endpoint: string, webPath: string, subtitle?: string): ModuleDef => ({
    id,
    title,
    icon,
    section: id,
    render: (header) => <SectionModule title={title} subtitle={subtitle} endpoint={endpoint} webPath={webPath} header={header} />,
});

/**
 * Усі модулі GameCon для ПК — по одному на кожен розділ проєкту (config/modules.php, ті самі назви),
 * плюс GameCast і LiveCast (плагіни) та сповіщення. Показуються лише увімкнені людині розділи.
 */
export const MODULES: ModuleDef[] = [
    { id: 'profile', page: '/profile', title: 'Моя сторінка', icon: UserRound, section: 'profile', render: (h) => <ProfileModule header={h} /> },
    { id: 'feed', page: '/feed', title: 'Новини', icon: Newspaper, section: 'feed', render: (h) => <FeedModule header={h} />, wide: true },
    { id: 'messenger', title: 'Повідомлення', icon: MessageSquare, section: 'messages', page: '/messages', render: (h) => <MessengerModule header={h} /> },
    { id: 'friends', page: '/friends', title: 'Друзі', icon: Users, section: 'friends', render: (h) => <FriendsModule header={h} /> },
    { id: 'activity', page: '/notifications', title: 'Сповіщення', icon: Bell, section: null, render: (h) => <ActivityModule header={h} /> },
    // Голос сімей, кланів і спільнот — є, якщо ввімкнено хоч один з цих розділів (див. availableModules).
    { id: 'voice', title: 'Голосові кімнати', icon: Headphones, section: 'families', anyOf: ['families', 'clans', 'communities'], render: (h) => <VoiceModule header={h} /> },
    { ...section('discussions', 'Обговорення', MessagesSquare, '/api/v1/discussions/list', '/discussions', 'Теми й відповіді'), page: '/discussions' },
    { ...section('people', 'Пошук людей', Search, '/api/v1/people', '/people'), page: '/people' },
    { ...section('phone', 'Телефон', Phone, '/api/v1/site/phone', '/phone', 'Дзвінки й контакти'), page: '/phone' },
    { ...section('communities', 'Спільноти', UsersRound, '/api/v1/communities?tab=mine', '/communities'), page: '/communities' },
    { ...section('photos', 'Фотографії', Image, '/api/v1/site/photos', '/photos'), page: '/photos' },
    { ...section('servers', 'Сервери GTA', Server, '/api/v1/servers', '/servers', 'Онлайн і моніторинг'), page: '/servers' },
    { ...section('music', 'Музика', Music, '/api/v1/music', '/music'), page: '/music' },
    { ...section('cinema', 'Кіно', Clapperboard, '/api/v1/cinema', '/cinema'), page: '/cinema' },
    { id: 'families', title: 'Сім’ї', icon: Crown, section: 'families', page: '/families', render: (h) => <FamiliesModule header={h} /> },
    { ...section('games', 'Ігри', Gamepad2, '/api/v1/games', '/games'), page: '/games' },
    { ...section('clans', 'Клани', Shield, '/api/v1/site/clans', '/clans'), page: '/clans' },
    { ...section('events', 'Події', CalendarDays, '/api/v1/site/events', '/events'), page: '/events' },
    { id: 'quests', title: 'Завдання', icon: Target, section: 'quests', render: (h) => <QuestsModule header={h} /> },
    { ...section('moments', 'Моменти', Camera, '/api/v1/site/moments', '/moments'), page: '/moments' },
    { ...section('articles', 'Статті', BookOpen, '/api/v1/site/articles', '/articles'), page: '/articles' },
    { ...section('party', 'Пошук паті', Swords, '/api/v1/site/party', '/party'), page: '/party' },
    { ...section('gamecast', 'GameCast', Mic, '/api/v1/site/shows', '/shows', 'Подкасти наживо'), section: null, plugin: 'live_shows', page: '/shows' },
    {
        ...section('livecast', 'LiveCast', Radio, '/api/v1/site/livecast', '/livecast', 'Стріми камерою чи екраном'),
        section: null,
        plugin: 'livecast',
        page: '/livecast',
        // Студія як OBS: сцени, джерела, мікшер, ефір / RTMP / запис.
        render: (header) => <SectionModule title="LiveCast" subtitle="Стріми камерою чи екраном" endpoint="/api/v1/site/livecast" webPath="/livecast" header={<>{header}<IconButton label="Студія LiveCast" onClick={() => void window.gamecon.studio.open()}><Clapperboard size={15} strokeWidth={1.5} /></IconButton></>} />,
    },
];

/** Розмір за замовчуванням: великі — стрічка й чати, решта — звичайні, прості списки — компактні. */
export const defaultSize = (m: ModuleDef): 's' | 'm' | 'l' => m.size ?? (m.id === 'feed' || m.id === 'messenger' ? 'l' : ['activity', 'families', 'quests', 'voice', 'profile'].includes(m.id) ? 'm' : 's');

export const DEFAULT_MODULES = ['feed', 'messenger', 'friends', 'activity'];

/** Модулі, доступні людині: розділ і плагін увімкнено на сервері (режим, модулі, плагіни). */
export function availableModules(sections: string[] | null, plugins: Record<string, boolean> | null = null): ModuleDef[] {
    return MODULES.filter((m) => (m.section === null || sections === null || (m.anyOf ?? [m.section]).some((s) => sections.includes(s))) && (!m.plugin || plugins === null || plugins[m.plugin] === true));
}

export const moduleById = (id: string): ModuleDef | undefined => MODULES.find((m) => m.id === id);
