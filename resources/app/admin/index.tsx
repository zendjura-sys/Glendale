import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from '../lib/auth';
import { isAdminLevel, isStaffLevel } from '../lib/types';
import { AdminLayout } from './AdminLayout';
import DashboardPage from './Dashboard';

const MembersPage = lazy(() => import('./Members'));
const LevelsPage = lazy(() => import('./Levels'));
const ReportsPage = lazy(() => import('./Reports'));
const ContentPage = lazy(() => import('./Content'));
const AnnouncementsPage = lazy(() => import('./Announcements'));
const StatsPage = lazy(() => import('./Stats'));
const LogPage = lazy(() => import('./Log'));
const SettingsPage = lazy(() => import('./SettingsPage'));

/** Admin panel (loaded as a separate chunk only for staff). */
export default function AdminApp() {
  const me = useMe();
  if (!isStaffLevel(me.level.type)) return <Navigate to="/feed" replace />;
  const full = isAdminLevel(me.level.type);
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="content" element={<ContentPage />} />
        {full && (
          <>
            <Route path="members" element={<MembersPage />} />
            <Route path="levels" element={<LevelsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="log" element={<LogPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
