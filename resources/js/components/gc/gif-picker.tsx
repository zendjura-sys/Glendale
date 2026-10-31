import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

export type GifItem = {
    id: string;
    title: string;
    url: string;
    preview: string;
    width: number;
    height: number;
};

/** Панель пошуку GIF (Giphy): популярне одразу, пошук — з паузою під час набору. */
export function GifPicker({
    onPick,
    onClose,
}: {
    onPick: (gif: GifItem) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<GifItem[] | null>(null);
    const [configured, setConfigured] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(
            () => {
                void api<{ configured: boolean; gifs: GifItem[] }>(
                    'GET',
                    `/gifs?q=${encodeURIComponent(query)}`,
                )
                    .then((d) => {
                        setConfigured(d.configured);
                        setGifs(d.gifs);
                    })
                    .catch(() => setGifs([]));
            },
            query ? 350 : 0,
        );

        return () => window.clearTimeout(timer);
    }, [query]);

    return (
        <div className="glass-strong mt-2 rounded-2xl p-2.5">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                        placeholder={tr('Пошук GIF')}
                        className="input-glass h-10 w-full rounded-xl pr-3 pl-9 text-sm text-white placeholder:text-white/35"
                    />
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={tr('Закрити')}
                    className="flex size-10 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.06] hover:text-white"
                >
                    <X className="size-4" />
                </button>
            </div>
            {!configured ? (
                <p className="p-3 text-sm text-white/50">
                    {tr('Пошук GIF ще не налаштовано адміністрацією.')}
                </p>
            ) : gifs === null ? (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div
                            key={i}
                            className="skeleton aspect-video rounded-lg"
                        />
                    ))}
                </div>
            ) : gifs.length === 0 ? (
                <p className="p-3 text-sm text-white/50">
                    {tr('Нічого не знайшлося.')}
                </p>
            ) : (
                <div className="mt-2 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto">
                    {gifs.map((gif) => (
                        <button
                            key={gif.id}
                            type="button"
                            onClick={() => onPick(gif)}
                            title={gif.title}
                            className="overflow-hidden rounded-lg bg-white/[0.04]"
                        >
                            <img
                                src={gif.preview}
                                alt={gif.title}
                                loading="lazy"
                                className="aspect-video w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
            <p className="mt-1.5 text-right text-[10px] text-white/30">
                Powered by GIPHY
            </p>
        </div>
    );
}
