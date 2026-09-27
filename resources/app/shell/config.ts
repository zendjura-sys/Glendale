/** Що сервер (App\Support\ShellNav) передає оболонці на сторінці Vue. */
export interface ShellConfig {
  mode: 'app' | 'admin';
  admin: { label: string; items: { href: string; label: string; icon: string; active: boolean }[] }[];
}

export const shellConfig = (): ShellConfig =>
  (window as unknown as { GC_SHELL?: ShellConfig }).GC_SHELL ?? { mode: 'app', admin: [] };
