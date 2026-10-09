import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { LocalTrack } from '@/types';
import { tr } from '@/lib/i18n';

export function LyricsDialog({
    track,
    onOpenChange,
}: {
    track: LocalTrack | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [text, setText] = useState('');

    useEffect(() => {
        if (!track) return;
        setText('');
        void api<{ lyrics: string | null }>('GET', `/music/tracks/${track.id}/lyrics`).then((response) =>
            setText(response.lyrics ?? ''),
        );
    }, [track]);

    return (
        <Dialog open={track !== null} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-md">
                <DialogTitle className="font-display text-xl">{track?.title}</DialogTitle>
                <p className="mt-1 text-sm text-white/45">{track?.artist}</p>
                <pre className="mt-4 max-h-80 overflow-y-auto text-sm whitespace-pre-wrap text-white/80">
                    {text || tr('Тексту в каталозі немає.')}
                </pre>
            </DialogContent>
        </Dialog>
    );
}
