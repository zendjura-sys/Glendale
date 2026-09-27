import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, PLATFORM, ApiError, bridgeSession, getToken, setToken, setUnauthorizedHandler } from './api';
import type { Me } from './types';

interface AuthState {
  user: Me | null;
  loading: boolean;
  /** Signed in, but the server couldn't be reached (installed app opened without network). */
  offline: boolean;
  retry: () => void;
  signIn: (token: string, user: Me) => void;
  signOut: () => void;
  setUser: (user: Me) => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  // Завжди стартуємо з перевірки: навіть без токена людина могла вже увійти
  // на сайті — тоді bridgeSession() обміняє сесію на токен.
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const qc = useQueryClient();

  const reset = useCallback(() => {
    setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const load = useCallback(async () => {
    setLoading(true);
    if (!getToken() && !(await bridgeSession())) {
      setLoading(false);
      return;
    }
    api<{ user: Me }>('/me')
      .then((r) => {
        setUser(r.user);
        setOffline(false);
      })
      .catch((e) => setOffline(e instanceof ApiError && e.status === 0))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    load();
  }, [reset, load]);

  // Back online: finish signing in automatically.
  useEffect(() => {
    if (!offline) return;
    window.addEventListener('online', load);
    return () => window.removeEventListener('online', load);
  }, [offline, load]);

  const signIn = useCallback((token: string, u: Me) => {
    setToken(token);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    // Разом із токеном закриваємо й сесію сайту, інакше міст сесії
    // (bridgeSession) одразу впустив би назад.
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
    if (csrf) {
      fetch(`${PLATFORM}/logout`, { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' }, credentials: 'same-origin' }).catch(() => {});
    }
    reset();
  }, [reset]);

  return <AuthContext.Provider value={{ user, loading, offline, retry: load, signIn, signOut, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Current user; only use inside authenticated routes. */
export const useMe = () => useContext(AuthContext).user!;
