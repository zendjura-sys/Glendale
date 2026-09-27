/**
 * Єдина оболонка сайту на сторінках Vue (кабінет, звіти, банк, адмінка…):
 * та сама шапка, бокове меню й нижня панель, що й у соцмережі (React), —
 * тож сайт виглядає однаково всюди. Сторінка Vue живе поруч у .gc-frame;
 * стилі соцмережі замкнені в .gc-shell (див. shell/scopeCss.ts) і вміст
 * Vue не зачіпають.
 */
import { StrictMode, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router, createPath, type Navigator } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/montserrat';
import styles from './styles.css?inline';
import uiverse from './uiverse.css?inline';
import glass from './glass.css?inline';
import admin from './admin.css?inline';
import { adoptScoped } from './shell/scopeCss';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ConfigProvider } from './lib/config';
import { RealtimeProvider } from './lib/realtime';
import { getLang, loadLang } from './lib/i18n';
import { Header, Sidebar, TabBar, Toasts } from './components/Layout';
import { Aurora } from './components/ui';
import { AdminChips, AdminSidebar } from './shell/AdminNav';
import { shellConfig } from './shell/config';

adoptScoped([styles, uiverse, glass, admin].join('\n'));

/**
 * Посилання оболонки ведуть на інші сторінки сайту (частина — React,
 * частина — Vue), тож кожен перехід — звичайне завантаження сторінки.
 */
const navigator: Navigator = {
  createHref: (to) => (typeof to === 'string' ? to : createPath(to)),
  push: (to) => window.location.assign(typeof to === 'string' ? to : createPath(to)),
  replace: (to) => window.location.replace(typeof to === 'string' ? to : createPath(to)),
  go: (n) => window.history.go(n),
};

// Inertia міняє адресу без перезавантаження — підсвітка меню стежить за нею.
const subscribe = (cb: () => void) => {
  document.addEventListener('inertia:navigate', cb);
  window.addEventListener('popstate', cb);
  return () => {
    document.removeEventListener('inertia:navigate', cb);
    window.removeEventListener('popstate', cb);
  };
};
const href = () => window.location.pathname + window.location.search;

function ShellRouter({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, href);
  const location = useMemo(() => {
    const u = new URL(current, window.location.origin);
    return { pathname: u.pathname, search: u.search, hash: '', state: null, key: 'shell' };
  }, [current]);
  return (
    <Router location={location} navigator={navigator}>
      {children}
    </Router>
  );
}

function Shell() {
  const { user } = useAuth();
  const cfg = shellConfig();
  const [top, setTop] = useState<HTMLElement | null>(null);
  useEffect(() => setTop(document.getElementById('gc-top')), []);
  if (!user) return <Aurora />;
  return (
    <RealtimeProvider>
      <Aurora />
      <Header />
      <div className="gc-side">{cfg.mode === 'admin' ? <AdminSidebar groups={cfg.admin} /> : <Sidebar />}</div>
      {cfg.mode === 'admin' && top && <AdminChips groups={cfg.admin} target={top} />}
      <TabBar />
      <Toasts />
    </RealtimeProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

const el = document.getElementById('gc-shell');
if (el) {
  void loadLang(getLang()).finally(() =>
    createRoot(el).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ShellRouter>
            <ThemeProvider>
              <ConfigProvider>
                <AuthProvider>
                  <Shell />
                </AuthProvider>
              </ConfigProvider>
            </ThemeProvider>
          </ShellRouter>
        </QueryClientProvider>
      </StrictMode>,
    ),
  );
}
