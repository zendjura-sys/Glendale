import { useEffect, useRef } from 'react';
import { MonitorUp, Video } from 'lucide-react';
import { useVoice } from '@/lib/voice';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Сцена відеодзвінка: камери й демонстрація екрана поверх сайту. */
export function CallStage() {
    const voice = useVoice();
    if (voice.kind !== 'call' || voice.videos.length === 0) return null;

    const tiles = [...voice.videos].sort((a, b) => {
        if (a.screen !== b.screen) return a.screen ? -1 : 1;
        if (a.local !== b.local) return a.local ? 1 : -1;

        return a.name.localeCompare(b.name);
    });
    const [primary, ...rest] = tiles;

    return (
        <div className="pointer-events-none fixed inset-x-3 top-[88px] bottom-24 z-30 sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[min(420px,calc(100vw-2rem))]">
            <div className="pointer-events-auto glass flex h-full max-h-[min(560px,calc(100vh-12rem))] flex-col overflow-hidden rounded-2xl shadow-xl">
                <div className="flex items-center gap-2 px-3 py-2">
                    <Video className="size-4 text-white/70" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                        {voice.roomName}
                    </span>
                </div>
                <div className="relative min-h-0 flex-1 bg-black/50">
                    <VideoMount tile={primary} className="absolute inset-0" />
                    {rest.length > 0 && (
                        <div className="absolute right-2 bottom-2 flex w-28 flex-col gap-2 sm:w-32">
                            {rest.slice(0, 3).map((tile) => (
                                <VideoMount
                                    key={tile.id}
                                    tile={tile}
                                    className="aspect-video overflow-hidden rounded-xl border border-white/10"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function VideoMount({
    tile,
    className,
}: {
    tile: {
        id: string;
        name: string;
        screen: boolean;
        local: boolean;
        el: HTMLVideoElement;
    };
    className?: string;
}) {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = host.current;
        if (!node) return;
        node.replaceChildren(tile.el);
        void tile.el.play().catch(() => undefined);

        return () => {
            if (tile.el.parentElement === node) node.removeChild(tile.el);
        };
    }, [tile.el, tile.id]);

    return (
        <div className={cn('relative bg-[#12141A]', className)}>
            <div ref={host} className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
            <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-lg bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                {tile.screen ? (
                    <span className="inline-flex items-center gap-1">
                        <MonitorUp className="size-3" />
                        {tile.name} · {tr('Екран')}
                    </span>
                ) : tile.local ? (
                    tr('Ви')
                ) : (
                    tile.name
                )}
            </span>
        </div>
    );
}
