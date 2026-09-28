import { tr } from './lib/i18n';
import { useState } from 'react';
import { RefreshCw, WifiOff, Wrench } from 'lucide-react';
import { lazyRetry } from './lib/lazyRetry';
import { useConfig } from './lib/config';
import { PlayerProvider } from './lib/player';
import { SpotifyProvider } from './lib/spotify';
import { PlayerBar } from './components/Music';
import { isStaffLevel } from './lib/types';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { RealtimeProvider } from './lib/realtime';
import { Layout } from './components/Layout';
import { Aurora, Empty, Spinner } from './components/ui';
import AuthPage from './pages/Auth';
import FeedPage from './pages/Feed';

// Rarely-first pages are split into separate chunks so the initial load stays small.
const ProfilePage = lazyRetry(() => import('./pages/Profile'), 'Profile');
const FriendsPage = lazyRetry(() => import('./pages/Friends'), 'Friends');
const GroupsPage = lazyRetry(() => import('./pages/Groups'), 'Groups');
const GroupPage = lazyRetry(() => import('./pages/Group'), 'Group');
const PhotosPage = lazyRetry(() => import('./pages/Photos'), 'Photos');
const SearchPage = lazyRetry(() => import('./pages/Search'), 'Search');
const NotificationsPage = lazyRetry(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const FamiliesPage = lazyRetry(() => import('./pages/Families'), 'Families');
const FamilyPage = lazyRetry(() => import('./pages/Families').then((m) => ({ default: m.FamilyPage })), 'FamilyPage');
const UnionsPage = lazyRetry(() => import('./pages/Unions'), 'Unions');
const UnionPage = lazyRetry(() => import('./pages/Unions').then((m) => ({ default: m.UnionPage })), 'UnionPage');
const SettingsPage = lazyRetry(() => import('./pages/Settings'), 'Settings');
const PostPage = lazyRetry(() => import('./pages/PostPage'), 'PostPage');
const MusicPage = lazyRetry(() => import('./pages/Music'), 'Music');
const PlaylistPage = lazyRetry(() => import('./pages/Music').then((m) => ({ default: m.PlaylistPage })), 'PlaylistPage');
const CinemaHomePage = lazyRetry(() => import('./pages/Cinema'), 'CinemaHomePage');
const CinemaBrowsePage = lazyRetry(() => import('./pages/Cinema').then((m) => ({ default: m.CinemaBrowsePage })), 'CinemaBrowsePage');
const CinemaTitlePage = lazyRetry(() => import('./pages/Cinema').then((m) => ({ default: m.CinemaTitlePage })), 'CinemaTitlePage');
const CinemaPersonPage = lazyRetry(() => import('./pages/Cinema').then((m) => ({ default: m.CinemaPersonPage })), 'CinemaPersonPage');
const CinemaHistoryPage = lazyRetry(() => import('./pages/Cinema').then((m) => ({ default: m.CinemaHistoryPage })), 'CinemaHistoryPage');
const CinemaWatchlistPage = lazyRetry(() => import('./pages/Cinema').then((m) => ({ default: m.CinemaWatchlistPage })), 'CinemaWatchlistPage');
const SpotifyCallback = lazyRetry(() => import('./pages/Spotify').then((m) => ({ default: m.SpotifyCallback })), 'SpotifyCallback');

function NotFound() {
  return (
    <div className="card">
      <Empty title={tr('Страница не найдена')}>{tr('Проверьте адрес или вернитесь в ленту.')}</Empty>
    </div>
  );
}

function MaintenanceScreen() {
  const { config } = useConfig();
  const { user, signOut } = useAuth();
  const [staffLogin, setStaffLogin] = useState(false);
  if (staffLogin && !user) return <AuthPage staffOnly />;
  return (
    <div className="maintenance-screen">
      <div className="card">
        <span className="announcement-icon" style={{ margin: '0 auto 14px', width: 52, height: 52, borderRadius: 16 }}>
          <Wrench size={26} />
        </span>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>{config.siteTitle} {tr('на обслуживании')}</h2>
        <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{config.maintenanceMessage}</p>
        {user ? (
          <button className="btn secondary" onClick={signOut}>
            {tr('Выйти')}
          </button>
        ) : (
          <button className="more-link" onClick={() => setStaffLogin(true)}>
            {tr('Вход для администрации')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, offline, retry } = useAuth();
  const { config, ready } = useConfig();
  if (ready && config.maintenance && !(user && isStaffLevel(user.level.type)) && !loading)
    return (
      <>
        <Aurora />
        <MaintenanceScreen />
      </>
    );
  if (loading)
    return (
      <>
        <Aurora />
        <Spinner />
      </>
    );
  if (!user && offline)
    return (
      <>
        <Aurora />
        <div className="offline-screen">
          <WifiOff size={44} />
          <h2>{tr('Нет соединения')}</h2>
          <p className="muted">{tr('Проверьте интернет — приложение подключится само, как только сеть появится.')}</p>
          <button className="btn" onClick={retry}>
            <RefreshCw size={16} /> {tr('Повторить')}
          </button>
        </div>
      </>
    );
  if (!user)
    return (
      <>
        <Aurora />
        <AuthPage />
      </>
    );
  return (
    <RealtimeProvider>
      <PlayerProvider>
      <SpotifyProvider>
      <Aurora />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="id/:id" element={<ProfilePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="club/:id" element={<GroupPage />} />
          <Route path="photos/:id" element={<PhotosPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="activity" element={<NotificationsPage />} />
          <Route path="families" element={<FamiliesPage />} />
          <Route path="families/:id" element={<FamilyPage />} />
          <Route path="unions" element={<UnionsPage />} />
          <Route path="unions/:id" element={<UnionPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="wall/:id" element={<PostPage />} />
          <Route path="music" element={<MusicPage />} />
          <Route path="music/playlist/:id" element={<PlaylistPage />} />
          <Route path="cinema" element={<CinemaHomePage />} />
          <Route path="cinema/browse" element={<CinemaBrowsePage />} />
          <Route path="cinema/title/:id" element={<CinemaTitlePage />} />
          <Route path="cinema/person/:id" element={<CinemaPersonPage />} />
          <Route path="cinema/watchlist" element={<CinemaWatchlistPage />} />
          <Route path="cinema/history" element={<CinemaHistoryPage />} />
          <Route path="spotify/callback" element={<SpotifyCallback />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <PlayerBar />
      </SpotifyProvider>
      </PlayerProvider>
    </RealtimeProvider>
  );
}
