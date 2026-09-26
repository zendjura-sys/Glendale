import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import type { Me } from './types';

interface AuthState {
  user: Me | null;
  loading: boolean;
  signIn: (token: string, user: Me) => void;
  signOut: () => void;
  setUser: (user: Me) => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  const qc = useQueryClient();

  const reset = useCallback(() => {
    setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    if (!getToken()) return;
    api<{ user: Me }>('/me')
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reset]);

  const signIn = useCallback((token: string, u: Me) => {
    setToken(token);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    reset();
  }, [reset]);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Current user; only use inside authenticated routes. */
export const useMe = () => useContext(AuthContext).user!;
