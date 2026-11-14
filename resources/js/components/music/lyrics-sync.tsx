import { Check, Pause, Play, RotateCcw, Undo2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { parseLyrics } from '@/lib/lyrics';
import { playQueue, seek, toggle, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { LocalTrack } from '@/types';

/** 83.4 → «01:23.40» для LRC. */
function stamp(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;

    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/**
 * Синхронізація тексту з піснею: трек грає, людина натискає «Позначити» (або пробіл), коли
 * звучить рядок, — і отримує LRC. Рядки без тексту (паузи) теж можна позначити.
 */
export function LyricsSync({
    open,
    onOpenChange,
    track,
    text,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    track: LocalTrack;
    text: string;
    onDone: (lrc: string) => void;
}) {
    const reduce = useReducedMotion();
    const player = usePlayer();
    const lines = useMemo(
        () =>
            parseLyrics(text)
                .lines.map((l) => l.text)
                .filter((l) => l.trim() !== ''),
        [text],
    );
    const [marks, setMarks] = useState<number[]>([]);
    const listRef = useRef<HTMLOListElement>(null);
    const current = player.current?.key === track.key;

    // Відкрили — вмикаємо цей трек з початку.
    useEffect(() => {
        if (!open) return;
        setMarks([]);
        playQueue([track], 0, { label: tr('Синхронізація тексту') });
        window.setTimeout(() => seek(0), 50);
    }, [open, track]);

    const mark = () => {
        if (!current || marks.length >= lines.length) return;
        setMarks((m) => [...m, Math.max(0, player.position - 0.15)]);
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                mark();
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                setMarks((m) => m.slice(0, -1));
            }
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    useEffect(() => {
        listRef.current
            ?.querySelector<HTMLElement>('[data-next="true"]')
            ?.scrollIntoView({
                block: 'center',
                behavior: reduce ? 'auto' : 'smooth',
            });
    }, [marks.length, reduce]);

    const done = marks.length === lines.length && lines.length > 0;
    const save = () => {
        onDone(
            lines
                .map((line, i) => `[${stamp(marks[i] ?? 0)}] ${line}`)
                .join('\n'),
        );
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90dvh] flex-col gap-3 sm:max-w-lg">
                <DialogTitle className="font-display text-lg font-semibold text-white">
                    {tr('Синхронізація тексту')}
                </DialogTitle>
                <DialogDescription className="text-sm text-white/55">
                    {tr(
                        'Натискайте «Позначити» або пробіл, щойно починає звучати підсвічений рядок. Backspace — скасувати останню позначку.',
                    )}
                </DialogDescription>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggle}
                        aria-label={player.playing ? tr('Пауза') : tr('Грати')}
                        className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-white"
                    >
                        {player.playing && current ? (
                            <Pause className="size-4" />
                        ) : (
                            <Play className="size-4" />
                        )}
                    </button>
                    <span className="font-mono text-sm text-white/70 tabular-nums">
                        {stamp(current ? player.position : 0)}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{
                                width: `${lines.length ? (marks.length / lines.length) * 100 : 0}%`,
                            }}
                        />
                    </div>
                    <span className="text-xs text-white/50 tabular-nums">
                        {marks.length}/{lines.length}
                    </span>
                </div>

                <ol
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl bg-white/[0.03] p-2"
                >
                    {lines.map((line, i) => {
                        const next = i === marks.length;

                        return (
                            <motion.li
                                key={i}
                                data-next={next}
                                animate={
                                    reduce
                                        ? undefined
                                        : { scale: next ? 1.02 : 1 }
                                }
                                className={cn(
                                    'flex items-baseline gap-3 rounded-lg px-2.5 py-1.5 text-sm',
                                    next
                                        ? 'bg-primary/20 font-semibold text-white'
                                        : i < marks.length
                                          ? 'text-white/45'
                                          : 'text-white/70',
                                )}
                            >
                                <span className="w-14 shrink-0 font-mono text-xs text-white/40 tabular-nums">
                                    {marks[i] !== undefined
                                        ? stamp(marks[i])
                                        : '—'}
                                </span>
                                {line}
                            </motion.li>
                        );
                    })}
                </ol>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={mark}
                        disabled={!current || done}
                        className="btn-glow inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Позначити рядок')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMarks((m) => m.slice(0, -1))}
                        disabled={marks.length === 0}
                        aria-label={tr('Скасувати останню')}
                        className="grid size-11 place-items-center rounded-xl bg-white/[0.06] text-white/80 disabled:opacity-40"
                    >
                        <Undo2 className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMarks([]);
                            seek(0);
                        }}
                        aria-label={tr('Почати спочатку')}
                        className="grid size-11 place-items-center rounded-xl bg-white/[0.06] text-white/80"
                    >
                        <RotateCcw className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={!done}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
                    >
                        <Check className="size-4" />
                        {tr('Готово')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
