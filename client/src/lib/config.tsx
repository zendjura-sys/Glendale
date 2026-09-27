import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { hasExplicitLang, setLang, type Lang } from './i18n';
import type { SiteConfig } from './types';

const DEFAULT_ACCENT = '#4c5bf5';

const FALLBACK: SiteConfig = {
  siteTitle: 'Glendale',
  siteDescription: '',
  signupMode: 'open',
  maintenance: false,
  maintenanceMessage: '',
  accentColor: DEFAULT_ACCENT,
  aurora: true,
  spotifyEnabled: false,
  googleEnabled: false,
  demoAccounts: false,
  defaultLanguage: 'uk',
};

const ConfigContext = createContext<{ config: SiteConfig; ready: boolean; reload: () => void }>(null!);

function mix(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * amount);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/** Applies the site-wide appearance chosen in the admin panel (accent color, aurora backdrop, title). */
function applyAppearance(c: SiteConfig) {
  const root = document.documentElement;
  const custom = c.accentColor.toLowerCase() !== DEFAULT_ACCENT;
  const vars: Record<string, string> = {
    '--accent': c.accentColor,
    '--link': c.accentColor,
    '--icon-accent': c.accentColor,
    '--btn-primary': c.accentColor,
    '--btn-primary-hover': mix(c.accentColor, 0.12),
    '--btn-secondary-text': c.accentColor,
    '--chart-1': c.accentColor,
    '--accent-soft': `${c.accentColor}22`,
  };
  for (const [k, v] of Object.entries(vars)) {
    if (custom) root.style.setProperty(k, v);
    else root.style.removeProperty(k);
  }
  root.classList.toggle('no-aurora', !c.aurora);
  // The site default applies until the visitor picks a language themselves.
  if (!hasExplicitLang()) setLang(c.defaultLanguage as Lang, false);
  document.title = c.siteTitle;
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(FALLBACK);
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => {
    api<SiteConfig>('/config')
      .then((c) => {
        setConfig(c);
        applyAppearance(c);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    reload();
    // Any API call that hits maintenance mode refreshes the config so the app can switch screens.
    window.addEventListener('maintenance', reload);
    return () => window.removeEventListener('maintenance', reload);
  }, [reload]);

  return <ConfigContext.Provider value={{ config, ready, reload }}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
