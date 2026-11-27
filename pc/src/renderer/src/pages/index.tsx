import type { ReactNode } from 'react';
import { FamiliesList } from './family/FamiliesList';
import { FamilyPage } from './family/FamilyPage';
import { MessagesPage } from './messages/MessagesPage';
import { FeedPage } from './social/FeedPage';
import { DiscussionsPage } from './discussions/DiscussionsPage';
import { GamePage, GamesList } from './games/Games';
import { CinemaList, MovieView } from './cinema/Cinema';
import { EventsPage } from './events/Events';
import { PartyBoard, PartyPage } from './party/Party';
import { ArticleEditor, ArticleView, ArticlesList } from './articles/Articles';
import { MomentsPage } from './moments/Moments';
import { AlbumPage, PhotosPage } from './photos/Photos';
import { ServerPage, ServersList } from './servers/Servers';
import { MusicCollection, MusicPage } from './music/Music';
import { ClanPage, ClansList } from './groups/Clans';
import { CommunitiesList, CommunityPage } from './groups/Communities';
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
    if (p === '/discussions') return <DiscussionsPage />;
    if ((m = p.match(/^\/discussions\/(\d+)$/))) return <DiscussionsPage key={path} open={Number(m[1])} />;
    if (p === '/music') return <MusicPage />;
    if (/^\/music\/(album|artist|genre|mix|mood|playlists)\b/.test(p)) return <MusicCollection key={path} path={path} />;
    if (p === '/servers') return <ServersList />;
    if ((m = p.match(/^\/servers\/([^/]+)$/)) && m[1] !== 'compare') return <ServerPage key={m[1]} slug={m[1]} />;
    if (p === '/photos') return <PhotosPage username={null} />;
    if ((m = p.match(/^\/photos\/u\/([^/]+)$/))) return <PhotosPage key={m[1]} username={m[1]} />;
    if ((m = p.match(/^\/albums\/(\d+)$/))) return <AlbumPage key={m[1]} id={Number(m[1])} />;
    if (p === '/moments') return <MomentsPage />;
    if (p === '/articles') return <ArticlesList />;
    if (p === '/articles/new' || p === '/articles/create') return <ArticleEditor slug={null} />;
    if ((m = p.match(/^\/articles\/([^/]+)\/edit$/))) return <ArticleEditor key={m[1]} slug={m[1]} />;
    if ((m = p.match(/^\/articles\/([^/]+)$/))) return <ArticleView key={m[1]} slug={m[1]} />;
    if (p === '/party') return <PartyBoard />;
    if ((m = p.match(/^\/party\/(\d+)$/))) return <PartyPage key={m[1]} id={Number(m[1])} />;
    if (p === '/events') return <EventsPage />;
    if (p === '/cinema') return <CinemaList />;
    if ((m = p.match(/^\/cinema\/([^/]+)$/))) return <MovieView key={m[1]} slug={m[1]} />;
    if (p === '/games') return <GamesList />;
    if ((m = p.match(/^\/games\/([^/]+)$/))) return <GamePage key={m[1]} slug={m[1]} />;
    if (p === '/clans') return <ClansList />;
    if ((m = p.match(/^\/clans\/([^/]+)$/)) && m[1] !== 'create') return <ClanPage key={m[1]} slug={m[1]} />;
    if (p === '/communities') return <CommunitiesList />;
    if ((m = p.match(/^\/c\/([^/]+)/))) return <CommunityPage key={m[1]} slug={m[1]} />;
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
