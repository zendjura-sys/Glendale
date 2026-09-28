import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ConfigProvider } from './lib/config';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import { getLang, loadLang, onLangChange } from './lib/i18n';
import { registerServiceWorker } from './lib/install';
import { APP_BASE } from './lib/api';
import { useEffect, useState } from 'react';
import '@fontsource-variable/montserrat';
import './styles.css';
import './uiverse.css';
import './glass.css';
import './admin.css';
import './music.css';
import './cinema.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

/** Re-renders the whole app (keeping caches and providers) when the language changes. */
function LangRoot() {
  const [lang, setLangState] = useState(getLang());
  useEffect(() => {
    document.documentElement.lang = lang;
    return onLangChange(() => setLangState(getLang()));
  }, [lang]);
  return <App key={lang} />;
}

registerServiceWorker();

const root = createRoot(document.getElementById('root')!);
// Render once the saved language's dictionary is in place, so the first paint is already translated.
void loadLang(getLang()).finally(() => root.render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={APP_BASE || undefined}>
          <ThemeProvider>
            <ConfigProvider>
              <AuthProvider>
                <LangRoot />
              </AuthProvider>
            </ConfigProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
));
