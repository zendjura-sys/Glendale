import { useEffect, useState } from 'react';
import type { LayoutState, Settings } from '../../../preload';

/** Стан режимів і віджетів із Main (оновлюється в усіх вікнах одночасно). */
export function useLayout(): LayoutState | null {
    const [state, setState] = useState<LayoutState | null>(null);
    useEffect(() => {
        void window.gamecon.layout.state().then(setState);
        return window.gamecon.layout.onChange(setState);
    }, []);
    return state;
}

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
    const [settings, setSettings] = useState<Settings | null>(null);
    useEffect(() => {
        void window.gamecon.settings.get().then(setSettings);
        return window.gamecon.settings.onChange(setSettings);
    }, []);
    return [settings, (patch) => void window.gamecon.settings.set(patch).then(setSettings)];
}
