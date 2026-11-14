import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import type { MovieCard } from '@/types';
import { MovieCardEmbed } from './movie-card';
import { tr } from '@/lib/i18n';

export function ShareMovieDialog({
    movie,
    description,
    open,
    onOpenChange,
}: {
    movie: MovieCard;
    description: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const submit = () => {
        setSending(true);
        router.post(
            '/posts',
            { body, visibility: 'public', movie_id: movie.id },
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong gap-0 rounded-dialog border-white/10 p-6 text-white sm:max-w-lg">
                <DialogTitle className="font-display text-xl">
                    {tr('Порадити друзям')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    {tr('Фільм з’явиться на вашій стіні та в стрічці друзів.')}
                </DialogDescription>
                <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    autoFocus
                    placeholder={tr('Чим вас зачепив цей фільм?')}
                    className="input-glass mt-5 w-full resize-none rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
                />
                <MovieCardEmbed
                    movie={{ ...movie, description, available: true }}
                    className="pointer-events-none mt-3"
                />
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={sending}
                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Опублікувати')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
