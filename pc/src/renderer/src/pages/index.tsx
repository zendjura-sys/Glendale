import type { ReactNode } from 'react';
import { FamiliesList } from './family/FamiliesList';
import { FamilyPage } from './family/FamilyPage';
import { MessagesPage } from './messages/MessagesPage';
import { FeedPage } from './social/FeedPage';
import { FriendsPage } from './social/FriendsPage';
import { NotificationsPage } from './social/NotificationsPage';
import { ProfilePage } from './social/ProfilePage';

/**
 * Сторінки програми за шляхом (як адреси сайту): /families, /families/<slug> … Кожен розділ
 * переноситься сюди повністю, нативно; модулі й посилання відкривають сторінки всередині програми.
 */
export function resolvePage(path: string): ReactNode | null {
    const [p, query = ''] = path.split('?');
    const tab = new URLSearchParams(query).get('tab') ?? undefined;
    let m: RegExpMatchArray | null;
    if (p === '/families') return <FamiliesList />;
    if (p === '/feed') return <FeedPage />;
    if (p === '/friends') return <FriendsPage />;
    if (p === '/notifications') return <NotificationsPage />;
    const meName = (window as unknown as { gcUsername?: string }).gcUsername;
    if (p === '/profile' && meName) return <ProfilePage key="me" username={meName} />;
    if ((m = p.match(/^\/(?:u|users)\/([^/]+)$/))) return <ProfilePage key={m[1]} username={decodeURIComponent(m[1])} />;
    if ((m = p.match(/^\/messages(?:\/(\d+))?$/))) return <MessagesPage key={path} initial={m[1] ? Number(m[1]) : undefined} />;
    if ((m = p.match(/^\/(?:families|f)\/([^/]+)/))) return <FamilyPage key={path} slug={m[1]} initialTab={tab} />;
    return null;
}

/** Чи є в програмі сторінка для цього шляху (інакше посилання не робимо клікабельним). */
export const hasPage = (path: string | null | undefined): path is string => !!path && resolvePage(path) !== null;
