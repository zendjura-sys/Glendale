import { useEffect, useState } from 'react';
import { MeProvider } from './lib/me';
import { AuthView } from './views/Auth';
import { DockView } from './views/Dock';
import { UnifiedView } from './views/Unified';
import { WidgetView } from './views/Widget';
import { StudioView } from './studio/Studio';
import { CallView } from './views/Call';

/** Кожне вікно знає свою роль з адреси: «/» — єдине вікно, «/widget/<id>» — віджет, «/dock» — пігулка. */
export default function App() {
    const [signedIn, setSignedIn] = useState<boolean | null>(null);
    useEffect(() => {
        void window.gamecon.session.signedIn().then(setSignedIn);
        return window.gamecon.session.onChange(setSignedIn);
    }, []);
    const route = window.location.hash.replace(/^#/, '') || '/';
    if (signedIn === null) return null;
    if (route === '/dock') return <DockView />;
    if (!signedIn) {
        return route === '/' ? (
            <div className="h-full overflow-hidden rounded-[22px] bg-obsidian-solid/85 ring-1 ring-white/10 backdrop-blur-2xl">
                <div className="drag h-10" />
                <AuthView />
            </div>
        ) : null;
    }
    if (route === '/call') return <MeProvider><CallView /></MeProvider>;
    if (route === '/studio') return <MeProvider><StudioView /></MeProvider>;
    const widget = route.match(/^\/widget\/([a-z_]+)$/);
    return <MeProvider>{widget ? <WidgetView id={widget[1]} /> : <UnifiedView />}</MeProvider>;
}
