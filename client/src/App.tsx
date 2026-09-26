import { lazy } from 'react';
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

function NotFound() {
  return (
    <div className="card">
      <Empty title="Страница не найдена">Проверьте адрес или вернитесь в ленту.</Empty>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
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
      <Aurora />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="id/:id" element={<ProfilePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="im" element={<MessengerPage />} />
          <Route path="im/:peerId" element={<MessengerPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="club/:id" element={<GroupPage />} />
          <Route path="photos/:id" element={<PhotosPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="wall/:id" element={<PostPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  );
}
