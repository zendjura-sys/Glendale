import { tr } from './lib/i18n';
import { lazy, Suspense, useState } from 'react';
import { Wrench } from 'lucide-react';
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
const ProfilePage = lazy(() => import('./pages/Profile'));
const FriendsPage = lazy(() => import('./pages/Friends'));
const MessengerPage = lazy(() => import('./pages/Messenger'));
const GroupsPage = lazy(() => import('./pages/Groups'));
const GroupPage = lazy(() => import('./pages/Group'));
const PhotosPage = lazy(() => import('./pages/Photos'));
const SearchPage = lazy(() => import('./pages/Search'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PostPage = lazy(() => import('./pages/PostPage'));
const AdminApp = lazy(() => import('./admin'));
const MusicPage = lazy(() => import('./pages/Music'));
const PlaylistPage = lazy(() => import('./pages/Music').then((m) => ({ default: m.PlaylistPage })));
const SpotifyCallback = lazy(() => import('./pages/Spotify').then((m) => ({ default: m.SpotifyCallback })));

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
  const { user, loading } = useAuth();
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
        <Route
          path="admin/*"
          element={
            <Suspense fallback={<Spinner />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="id/:id" element={<ProfilePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="im" element={<MessengerPage />} />
          <Route path="im/:peerId" element={<MessengerPage />} />
          <Route path="im/c/:chatId" element={<MessengerPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="club/:id" element={<GroupPage />} />
          <Route path="photos/:id" element={<PhotosPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="wall/:id" element={<PostPage />} />
          <Route path="music" element={<MusicPage />} />
          <Route path="music/playlist/:id" element={<PlaylistPage />} />
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
