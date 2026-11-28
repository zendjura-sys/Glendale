import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { api, type User } from './api';

export type Me = User & { modules?: string[]; plugins?: Record<string, boolean> };

const MeContext = createContext<{ me: Me | null; sections: string[] | null; plugins: Record<string, boolean> | null }>({ me: null, sections: null, plugins: null });

/** Хто увійшов і які розділи йому увімкнено (режим, модулі, плагіни — з сервера). */
export function MeProvider({ children }: { children: ReactNode }) {
    const [me, setMe] = useState<Me | null>(null);
    useEffect(() => {
        const load = (): void => {
            void api<{ user: Me }>('GET', '/api/v1/me').then(
                (r) => {
                    setMe(r.user);
                    (window as unknown as { gcMe?: number }).gcMe = r.user.id;
                    (window as unknown as { gcUsername?: string }).gcUsername = r.user.username;
                },
                () => undefined,
            );
        };
        load();
        const timer = window.setInterval(load, 5 * 60_000);
        return () => window.clearInterval(timer);
    }, []);
    return <MeContext.Provider value={{ me, sections: me?.modules ?? null, plugins: me?.plugins ?? null }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
