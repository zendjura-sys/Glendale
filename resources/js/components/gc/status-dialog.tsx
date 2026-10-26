import { router } from '@inertiajs/react';
import { Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

/** Готові статуси: емодзі й підпис (підпис можна змінити). */
const PRESETS: { emoji: string; text: () => string }[] = [
    { emoji: '🎮', text: () => tr('Граю') },
    { emoji: '⚔️', text: () => tr('У рейді') },
    { emoji: '🎧', text: () => tr('Слухаю музику') },
    { emoji: '🍿', text: () => tr('Дивлюсь кіно') },
    { emoji: '📚', text: () => tr('Навчаюсь') },
    { emoji: '💼', text: () => tr('Працюю') },
    { emoji: '🚗', text: () => tr('У дорозі') },
    { emoji: '💤', text: () => tr('Сплю') },
    { emoji: '🔕', text: () => tr('Не турбувати') },
    { emoji: '🤒', text: () => tr('Хворію') },
    { emoji: '🎉', text: () => tr('Святкую') },
    { emoji: '🏖️', text: () => tr('У відпустці') },
];

/** Ще кілька емодзі без підпису — для свого статусу. */
const EXTRA = ['🔥', '😎', '🥱', '🤝', '🍕', '☕', '🏆', '❤️', '🎂', '🇺🇦'];

const DURATIONS: { key: string; label: () => string }[] = [
    { key: '30m', label: () => tr('30 хв') },
    { key: '1h', label: () => tr('1 год') },
    { key: '4h', label: () => tr('4 год') },
    { key: 'today', label: () => tr('До кінця дня') },
    { key: 'week', label: () => tr('Тиждень') },
    { key: 'forever', label: () => tr('Без таймера') },
];

/** «до 23:00» сьогодні, інакше «до 3 листопада». */
export function statusUntilLabel(
    iso: string | null | undefined,
): string | null {
    if (!iso) {
        return null;
    }
    const until = new Date(iso);
    // Мова сторінки (uk, en…): 24-годинний час і назви місяців як на решті сайту.
    const locale = document.documentElement.lang || 'uk';
    const sameDay = until.toDateString() === new Date().toDateString();

    return sameDay
        ? tr('до {time}', {
              time: until.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
              }),
          })
        : tr('до {date}', {
              date: until.toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
              }),
          });
}

/** Вікно швидкого статусу: емодзі, підпис і на скільки поставити. */
export function StatusDialog({
    user,
    open,
    onOpenChange,
}: {
    user: UserCard;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [emoji, setEmoji] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [duration, setDuration] = useState('today');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) {
            setEmoji(user.status_emoji ?? null);
            setText(user.status ?? '');
            setDuration(user.status_until ? 'today' : 'forever');
        }
    }, [open, user.status_emoji, user.status, user.status_until]);

    const send = (method: 'PUT' | 'DELETE') => {
        setBusy(true);
        api(
            method,
            '/me/status',
            method === 'PUT' ? { emoji, text, duration } : undefined,
        )
            .then(() => {
                onOpenChange(false);
                toast.success(
                    method === 'PUT'
                        ? tr('Статус оновлено.')
                        : tr('Статус прибрано.'),
                );
                router.reload();
            })
            .catch(() => toast.error(tr('Не вдалося зберегти статус.')))
            .finally(() => setBusy(false));
    };

    const canSave = emoji !== null || text.trim() !== '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogTitle>{tr('Статус')}</DialogTitle>
                <DialogDescription>
                    {tr(
                        'Видно на аватарі, у профілі й чатах. Після таймера зникне сам.',
                    )}
                </DialogDescription>

                <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2">
                    <span className="text-2xl leading-none" aria-hidden>
                        {emoji ?? '🙂'}
                    </span>
                    <input
                        value={text}
                        maxLength={140}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={tr('Що у вас зараз?')}
                        aria-label={tr('Текст статусу')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                    />
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {PRESETS.map((p) => {
                        const active = emoji === p.emoji && text === p.text();

                        return (
                            <button
                                key={p.emoji}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                    setEmoji(p.emoji);
                                    setText(p.text());
                                }}
                                className={cn(
                                    'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition',
                                    active
                                        ? 'bg-primary/20 text-white ring-1 ring-primary/60'
                                        : 'bg-white/[0.04] text-white/80 hover:bg-white/[0.08]',
                                )}
                            >
                                <span className="text-lg leading-none">
                                    {p.emoji}
                                </span>
                                <span className="truncate">{p.text()}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-1">
                    {EXTRA.map((e) => (
                        <button
                            key={e}
                            type="button"
                            aria-pressed={emoji === e}
                            aria-label={e}
                            onClick={() => setEmoji(emoji === e ? null : e)}
                            className={cn(
                                'flex size-9 items-center justify-center rounded-lg text-lg transition',
                                emoji === e
                                    ? 'bg-primary/20 ring-1 ring-primary/60'
                                    : 'hover:bg-white/[0.08]',
                            )}
                        >
                            {e}
                        </button>
                    ))}
                </div>

                <div>
                    <p className="mb-1.5 text-xs font-medium text-white/50">
                        {tr('Прибрати через')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {DURATIONS.map((d) => (
                            <button
                                key={d.key}
                                type="button"
                                aria-pressed={duration === d.key}
                                onClick={() => setDuration(d.key)}
                                className={cn(
                                    'h-8 rounded-lg px-3 text-xs font-semibold transition',
                                    duration === d.key
                                        ? 'bg-white text-gc-ink'
                                        : 'bg-white/[0.06] text-white/75 hover:bg-white/10',
                                )}
                            >
                                {d.label()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    {(user.status || user.status_emoji) && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => send('DELETE')}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-rose-300"
                        >
                            <Trash2 className="size-4" /> {tr('Прибрати')}
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={busy || !canSave}
                        onClick={() => send('PUT')}
                        className="btn-glow ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {tr('Зберегти')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
