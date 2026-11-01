import { Music, Pause, Pencil, Play, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Widget } from '@/components/gc/widget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { playTrack, toggle, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { TrackCard } from '@/types/music';

/** Пісня профілю: грає лише після натискання; власник обирає з медіатеки. */
export function ProfileTrack({
    track: initial,
    isSelf,
}: {
    track: TrackCard | null;
    isSelf: boolean;
}) {
    const [track, setTrack] = useState(initial);
    const [picking, setPicking] = useState(false);
    const [q, setQ] = useState('');
    const [choices, setChoices] = useState<TrackCard[] | null>(null);
    const player = usePlayer();
    const current = track !== null && player.current?.key === track.key;

    useEffect(() => setTrack(initial), [initial]);
    useEffect(() => {
        if (!picking) return;
        const t = setTimeout(() => {
            api<{ tracks: TrackCard[] }>(
                'GET',
                `/settings/profile-track?q=${encodeURIComponent(q)}`,
            )
                .then((d) => setChoices(d.tracks))
                .catch(() => setChoices([]));
        }, 250);
        return () => clearTimeout(t);
    }, [picking, q]);

    if (!track && !isSelf) return null;

    const save = (id: number | null) =>
        api<{ track: TrackCard | null; message: string }>(
            'PUT',
            '/settings/profile-track',
            { track_id: id },
        )
            .then((d) => {
                setTrack(d.track);
                setPicking(false);
                toast.success(tr(d.message));
            })
            .catch((e: Error) => toast.error(e.message));

    return (
        <Widget title={tr('Пісня профілю')}>
            {track ? (
                <div className="flex items-center gap-3 px-1">
                    <button
                        type="button"
                        onClick={() => (current ? toggle() : playTrack(track))}
                        className="group relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]"
                        aria-label={
                            current && player.playing
                                ? tr('Пауза')
                                : tr('Слухати')
                        }
                    >
                        {'cover_url' in track && track.cover_url ? (
                            <img
                                src={track.cover_url}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : (
                            <Music className="m-auto size-6 text-white/40" />
                        )}
                        <span
                            className={cn(
                                'absolute inset-0 flex items-center justify-center bg-black/45 transition',
                                current && player.playing
                                    ? 'opacity-100'
                                    : 'opacity-80 group-hover:opacity-100',
                            )}
                        >
                            {current && player.playing ? (
                                <Pause className="size-5 fill-white text-white" />
                            ) : (
                                <Play className="size-5 fill-white text-white" />
                            )}
                        </span>
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                            {track.title}
                        </p>
                        <p className="truncate text-xs text-white/50">
                            {track.artist}
                        </p>
                    </div>
                    {isSelf && (
                        <button
                            type="button"
                            onClick={() => setPicking(true)}
                            className="rounded-md p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
                            aria-label={tr('Змінити пісню')}
                        >
                            <Pencil className="size-4" />
                        </button>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left text-sm text-white/60 hover:text-white"
                >
                    <span className="flex size-12 items-center justify-center rounded-xl bg-white/[0.06]">
                        <Music className="size-5" />
                    </span>
                    {tr('Додайте пісню — гості послухають її одним натиском.')}
                </button>
            )}
            <Dialog open={picking} onOpenChange={setPicking}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto sm:max-w-md">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Пісня профілю')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Зі своїх треків і медіатеки. Сама не вмикається — лише після натискання.',
                            )}
                        </DialogDescription>
                    </div>
                    <label className="relative block">
                        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-white/35" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={tr('Назва чи виконавець')}
                            className="input-glass h-10 w-full rounded-xl pr-3 pl-9 text-sm text-white placeholder:text-white/30"
                        />
                    </label>
                    <div className="space-y-1">
                        {choices?.length === 0 && (
                            <p className="py-6 text-center text-sm text-white/45">
                                {tr('У медіатеці нічого не знайдено.')}
                            </p>
                        )}
                        {choices?.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => save(Number(t.id))}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.06]',
                                    track?.key === t.key && 'bg-primary/15',
                                )}
                            >
                                <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                                    {'cover_url' in t && t.cover_url && (
                                        <img
                                            src={t.cover_url}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">
                                        {t.title}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        {t.artist}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                    {track && (
                        <button
                            type="button"
                            onClick={() => save(null)}
                            className="inline-flex items-center gap-1.5 self-start text-xs text-white/50 hover:text-white"
                        >
                            <X className="size-3.5" />
                            {tr('Прибрати пісню з профілю')}
                        </button>
                    )}
                </DialogContent>
            </Dialog>
        </Widget>
    );
}
