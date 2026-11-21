import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';
import { playBootChime, setSoundsEnabled } from '@/lib/sound-fx';

/** Перемикач «Звуки інтерфейсу» в меню «Система» (акорд входу й тихе клацання вкладок). */
export function SoundRow() {
    const [on, setOn] = useState(true);
    useEffect(() => {
        try {
            setOn(localStorage.getItem('gc_ui_sounds') !== 'off');
        } catch {
            setOn(true);
        }
    }, []);

    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => {
                const next = !on;
                setOn(next);
                setSoundsEnabled(next);
                if (next) playBootChime();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white/80 active:bg-white/[0.06]"
        >
            {on ? (
                <Volume2 className="size-[18px] text-white/50" />
            ) : (
                <VolumeX className="size-[18px] text-white/50" />
            )}
            <span className="flex-1">{tr('Звуки інтерфейсу (OS Chime)')}</span>
            <span
                aria-hidden
                className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-sky-500' : 'bg-white/15'}`}
            >
                <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
            </span>
        </button>
    );
}
