import { Check, Mic } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MoviePlayer } from '@/types';

type Kind = 'all' | 'voice' | 'subtitles';

const TONES = [
    'bg-rose-500',
    'bg-sky-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-orange-500',
    'bg-teal-500',
];

/** Логотип озвучки — перша літера на кольоровому квадраті (колір за назвою). */
function VoiceMark({ name }: { name: string | null }) {
    if (!name) {
        return (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/60">
                <Mic className="size-5" />
            </span>
        );
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);

    return (
        <span
            data-on-dark
            className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white',
                TONES[hash % TONES.length],
            )}
        >
            {name.slice(0, 2).toUpperCase()}
        </span>
    );
}

function kindOf(player: MoviePlayer): Exclude<Kind, 'all'> {
    return /sub/i.test(player.translation_type ?? '') ? 'subtitles' : 'voice';
}

/**
 * «Виберіть варіант»: кнопка з поточною озвучкою відкриває список усіх озвучок і субтитрів
 * усіх плеєрів — логотип, назва, плеєр і якість. Вибір перемикає плеєр нижче.
 */
export function VoicePicker({
    players,
    current,
    onPick,
}: {
    players: MoviePlayer[];
    current: MoviePlayer | undefined;
    onPick: (player: MoviePlayer) => void;
}) {
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<Kind>('all');
    const hasSubs = players.some((p) => kindOf(p) === 'subtitles');
    const list = players.filter((p) => kind === 'all' || kindOf(p) === kind);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex min-w-0 items-center gap-3 rounded-full bg-white/[0.06] py-1.5 pr-4 pl-1.5 text-left hover:bg-white/[0.1]"
            >
                <span className="scale-75">
                    <VoiceMark name={current?.translation ?? null} />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                        {current?.translation ?? tr('Оригінал')}
                    </span>
                    <span className="block text-xs text-white/50">
                        {tr('Змінити озвучку · {n}', { n: players.length })}
                    </span>
                </span>
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto rounded-[28px] p-5">
                    <DialogTitle className="text-xl font-semibold text-white">
                        {tr('Виберіть варіант')}
                    </DialogTitle>
                    {hasSubs && (
                        <div className="flex gap-2">
                            {(
                                [
                                    ['all', tr('Усі')],
                                    ['voice', tr('Озвучки')],
                                    ['subtitles', tr('Субтитри')],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setKind(key)}
                                    className={cn(
                                        'inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold',
                                        kind === key
                                            ? 'border-transparent bg-[var(--vkui--color_background_accent)]/25 text-white'
                                            : 'border-white/20 text-white/80',
                                    )}
                                >
                                    {kind === key && (
                                        <Check className="size-4" />
                                    )}
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                    <ul className="-mx-2 divide-y divide-white/[0.06]">
                        {list.map((player) => (
                            <li key={player.key}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onPick(player);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        'flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-white/[0.04]',
                                        current?.key === player.key &&
                                            'bg-white/[0.06]',
                                    )}
                                >
                                    <VoiceMark name={player.translation} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[15px] font-semibold text-white">
                                            {player.translation ??
                                                tr('Оригінал')}
                                        </span>
                                        <span className="mt-0.5 flex items-center gap-2 text-[13px] text-white/50">
                                            {player.provider_label}
                                            {player.quality && (
                                                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-white/80">
                                                    {player.quality}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                    {current?.key === player.key && (
                                        <Check className="size-5 text-[var(--vkui--color_text_accent)]" />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </DialogContent>
            </Dialog>
        </>
    );
}
