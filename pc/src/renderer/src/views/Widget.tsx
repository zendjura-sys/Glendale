import { Maximize2, Pin, PinOff, X } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useLayout } from '@/lib/layout';
import { moduleById } from '@/modules/registry';

/**
 * Режим Б — один модуль в окремому прозорому безрамочному вікні: micro-header для перетягування,
 * Pin («поверх усіх вікон»), «Повернути в загальне вікно» й «Сховати».
 */
export function WidgetView({ id }: { id: string }) {
    const layout = useLayout();
    const module = moduleById(id);
    const pinned = layout?.widgets[id]?.pinned ?? false;
    if (!module) return null;
    const controls = (
        <div className="flex">
            <IconButton label={pinned ? 'Відкріпити від верху' : 'Поверх усіх вікон'} active={pinned || layout?.gameOverlay} onClick={() => void window.gamecon.layout.pin(id, !pinned)}>
                {pinned ? <Pin size={14} strokeWidth={1.6} /> : <PinOff size={14} strokeWidth={1.6} />}
            </IconButton>
            <IconButton label="Повернути в загальне вікно" onClick={() => void window.gamecon.layout.setMode('unified')}>
                <Maximize2 size={14} strokeWidth={1.6} />
            </IconButton>
            <IconButton label="Сховати віджет" onClick={() => void window.gamecon.layout.hide(id)}>
                <X size={14} strokeWidth={1.6} />
            </IconButton>
        </div>
    );
    return <div className="h-full p-1.5 drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] [&>div>div>div:first-child]:drag">{module.render(controls)}</div>;
}
