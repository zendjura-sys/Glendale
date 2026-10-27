import { Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Toggle } from '@/components/gc/admin';
import { ListSkeleton } from '@/components/gc/skeletons';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

type Target = {
    id: number;
    platform: 'discord' | 'telegram';
    label: string | null;
    events: string[];
    enabled: boolean;
    last_error: string | null;
};

const EVENT_LABELS: Record<string, () => string> = {
    posts: () => tr('Мої записи'),
    streams: () => tr('Початок стріму'),
    news: () => tr('Новини сервера'),
};

/** «Автопостинг»: свої записи, стріми чи новини сервера — у Discord і Telegram. */
export function CrosspostButton({
    owner,
    className,
}: {
    owner: { type: 'user' | 'server'; id: number };
    className?: string;
}) {
    const on = usePlugin('crossposting');
    const [open, setOpen] = useState(false);
    const [targets, setTargets] = useState<Target[] | null>(null);
    const [events, setEvents] = useState<string[]>([]);
    const [platform, setPlatform] = useState<'discord' | 'telegram'>('discord');
    const [target, setTarget] = useState('');
    const [picked, setPicked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const base = `/crosspost/${owner.type}/${owner.id}`;

    const load = useCallback(() => {
        void api<{ targets: Target[]; events: string[] }>('GET', base).then(
            (data) => {
                setTargets(data.targets);
                setEvents(data.events);
                setPicked((current) =>
                    current.length ? current : data.events,
                );
            },
        );
    }, [base]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    if (!on) return null;

    const run = (
        method: 'POST' | 'PATCH' | 'DELETE',
        url: string,
        body?: Record<string, unknown>,
        ok?: string,
    ) => {
        setBusy(true);
        void api<{ targets: Target[] }>(method, url, body)
            .then((data) => {
                setTargets(data.targets);
                if (ok) toast.success(ok);
                if (method === 'POST') setTarget('');
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError ? e.message : tr('Не вдалося.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]',
                    className,
                )}
            >
                <Send className="size-4" />
                {tr('Автопостинг')}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
                    <div>
                        <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                            <Send className="size-5 text-gc-lilac-300" />
                            {tr('Автопостинг')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Discord: вебхук каналу (Налаштування каналу → Інтеграції → Вебхуки). Telegram: додайте бота GameCon адміністратором каналу й вкажіть @канал.',
                            )}
                        </DialogDescription>
                    </div>

                    {targets === null ? (
                        <ListSkeleton rows={2} avatar="square" card={false} />
                    ) : (
                        targets.length > 0 && (
                            <ul className="space-y-2">
                                {targets.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3"
                                    >
                                        <div className="min-w-0 flex-1 text-sm">
                                            <p className="truncate font-medium text-white">
                                                {t.label}
                                            </p>
                                            <p className="mt-0.5 text-xs text-white/45">
                                                {t.events
                                                    .map(
                                                        (e) =>
                                                            EVENT_LABELS[
                                                                e
                                                            ]?.() ?? e,
                                                    )
                                                    .join(' · ')}
                                            </p>
                                            {t.last_error && (
                                                <p className="mt-1 text-xs text-rose-300">
                                                    {t.last_error}
                                                </p>
                                            )}
                                        </div>
                                        <Toggle
                                            checked={t.enabled}
                                            disabled={busy}
                                            onChange={(enabled) =>
                                                run(
                                                    'PATCH',
                                                    `${base}/${t.id}`,
                                                    { enabled },
                                                )
                                            }
                                            label={tr('Увімкнено')}
                                        />
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                run('DELETE', `${base}/${t.id}`)
                                            }
                                            aria-label={tr('Видалити')}
                                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-rose-500/10 hover:text-rose-300"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}

                    <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
                        <div className="flex rounded-xl bg-white/[0.04] p-1">
                            {(['discord', 'telegram'] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setPlatform(value)}
                                    className={cn(
                                        'h-8 flex-1 rounded-lg text-[13px] font-medium transition',
                                        platform === value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    {value === 'discord'
                                        ? 'Discord'
                                        : 'Telegram'}
                                </button>
                            ))}
                        </div>
                        <input
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder={
                                platform === 'discord'
                                    ? 'https://discord.com/api/webhooks/…'
                                    : tr('@назва_каналу')
                            }
                            className="input-glass h-11 w-full rounded-xl px-3.5 font-mono text-xs text-white placeholder:text-white/30"
                        />
                        {events.length > 1 && (
                            <div className="flex flex-wrap gap-3">
                                {events.map((e) => (
                                    <label
                                        key={e}
                                        className="flex items-center gap-2 text-sm text-white/70"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={picked.includes(e)}
                                            onChange={(ev) =>
                                                setPicked(
                                                    ev.target.checked
                                                        ? [...picked, e]
                                                        : picked.filter(
                                                              (x) => x !== e,
                                                          ),
                                                )
                                            }
                                        />
                                        {EVENT_LABELS[e]?.() ?? e}
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                disabled={
                                    busy ||
                                    !target.trim() ||
                                    picked.length === 0
                                }
                                onClick={() =>
                                    run(
                                        'POST',
                                        base,
                                        { platform, target, events: picked },
                                        tr(
                                            'Канал підключено — там уже є пробне повідомлення.',
                                        ),
                                    )
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Підключити')}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
