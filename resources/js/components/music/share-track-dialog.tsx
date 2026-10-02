import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import type { TrackCard } from '@/types';
import { MusicCard } from './music-card';

export function musicPayload(track: TrackCard) {
    return track.source === 'local'
        ? { source: 'local', id: track.id }
        : {
              source: 'spotify',
              id: track.id,
              title: track.title,
              artist: track.artist,
              album: track.album,
              duration: track.duration,
              cover_url: track.cover_url,
          };
}

export function ShareTrackDialog({
    track,
    onOpenChange,
}: {
    track: TrackCard | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const submit = () => {
        if (!track) return;
        setSending(true);
        router.post(
            '/posts',
            { body, visibility: 'public', music: musicPayload(track) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBody('');
                    onOpenChange(false);
                },
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <Dialog open={track !== null} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-lg">
                <DialogTitle className="font-display text-xl">
                    Поділитися на стіні
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    Трек з’явиться у вашій стрічці й на сторінці.
                </DialogDescription>
                <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    autoFocus
                    placeholder="Що скажете про цей трек?"
                    className="input-glass mt-5 w-full resize-none rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
                />
                {track && (
                    <div className="mt-3">
                        <MusicCard track={track} compact />
                    </div>
                )}
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                        Скасувати
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={sending}
                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        Опублікувати
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
