import { LayoutGrid, RotateCcw } from 'lucide-react';
import { NotchToggle } from '@/components/NotchedCard';
import { IconButton } from '@/components/ui';
import { useLayout, useSettings } from '@/lib/layout';
import { moduleById } from '@/modules/registry';

/** Control Dock — плаваюча «пігулка» в режимі віджетів (завжди поверх). */
export function DockView() {
    const layout = useLayout();
    const [settings] = useSettings();
    const ids = settings?.modules ?? [];
    return (
        <div className="drag flex h-full items-center gap-1.5 rounded-full bg-obsidian px-3 ring-1 ring-neon-cyan/30 backdrop-blur-xl">
            <span className="mr-1 text-xs font-semibold text-white/70">Control Dock</span>
            {ids.map((id) => {
                const m = moduleById(id);
                if (!m) return null;
                return (
                    <IconButton key={id} label={`${m.title}: показати / сховати`} active={layout?.widgets[id]?.open} onClick={() => void window.gamecon.layout.toggle(id)}>
                        <m.icon size={16} strokeWidth={1.5} />
                    </IconButton>
                );
            })}
            <IconButton label="Скинути розклад" onClick={() => void window.gamecon.layout.reset()}>
                <RotateCcw size={15} strokeWidth={1.5} />
            </IconButton>
            <IconButton label="Зібрати в одне вікно" onClick={() => void window.gamecon.layout.setMode('unified')}>
                <LayoutGrid size={16} strokeWidth={1.5} />
            </IconButton>
            <div className="ml-1 h-6 w-11">
                <NotchToggle on label="Режим віджетів" onChange={(on) => !on && void window.gamecon.layout.setMode('unified')} />
            </div>
        </div>
    );
}
