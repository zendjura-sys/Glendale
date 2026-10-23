import { Link, useForm } from '@inertiajs/react';
import { Gauge, Trophy, UsersRound } from 'lucide-react';
import { ServerIcon } from '@/components/servers/server-icon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { clockTime, formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type TournamentStatus = 'open' | 'running' | 'finished' | 'cancelled';

export type TournamentCard = {
    id: number;
    title: string;
    kind: 'bracket' | 'challenge';
    entry: 'solo' | 'family';
    status: TournamentStatus;
    size: number;
    metric: string | null;
    prize: string | null;
    starts_at: string;
    ends_at: string | null;
    entries_count: number;
    server: { slug: string; name: string; icon: string | null };
};

export type EntryCard = {
    id: number;
    name: string;
    avatar: string | null;
    url: string;
    family: boolean;
};

export const statusLabel: Record<TournamentStatus, string> = {
    open: tr('Реєстрація'),
    running: tr('Триває'),
    finished: tr('Завершено'),
    cancelled: tr('Скасовано'),
};

export function StatusPill({ status }: { status: TournamentStatus }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-chip px-2 py-0.5 text-xs font-semibold',
                status === 'running' && 'bg-primary/15 text-primary',
                status === 'open' && 'bg-white/10 text-white/80',
                (status === 'finished' || status === 'cancelled') &&
                    'bg-white/[0.05] text-white/45',
            )}
        >
            {status === 'running' && (
                <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
            )}
            {statusLabel[status]}
        </span>
    );
}

/** Рядок турніру в списку: сервер, назва, коли, скільки учасників. */
export function TournamentRow({
    tournament,
    showServer = true,
}: {
    tournament: TournamentCard;
    showServer?: boolean;
}) {
    const Icon = tournament.kind === 'bracket' ? Trophy : Gauge;
    const count =
        tournament.kind === 'bracket'
            ? `${tournament.entries_count}/${tournament.size}`
            : String(tournament.entries_count);

    return (
        <Link
            href={`/tournaments/${tournament.id}`}
            className="flex items-center gap-3 rounded-control px-2 py-2.5 transition hover:bg-white/[0.05]"
        >
            {showServer ? (
                <ServerIcon
                    name={tournament.server.name}
                    icon={tournament.server.icon}
                    className="size-10 shrink-0 rounded-control"
                />
            ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-control bg-white/[0.06] text-white/70">
                    <Icon className="size-5" />
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                    {tournament.title}
                </span>
                <span className="block truncate text-xs text-white/50">
                    {[
                        showServer ? tournament.server.name : null,
                        tournament.kind === 'bracket'
                            ? tr('Сітка')
                            : tr('Челендж'),
                        `${formatDate(tournament.starts_at, false)}, ${clockTime(tournament.starts_at)}`,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            </span>
            <span className="hidden items-center gap-1 text-xs text-white/50 tabular-nums sm:inline-flex">
                <UsersRound className="size-3.5" />
                {count}
            </span>
            <StatusPill status={tournament.status} />
        </Link>
    );
}

/** Створення турніру власником сервера: сітка на вибування або челендж із таблицею. */
export function CreateTournamentDialog({
    serverSlug,
    sizes,
    open,
    onOpenChange,
}: {
    serverSlug: string;
    sizes: number[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({
        kind: 'bracket' as 'bracket' | 'challenge',
        title: '',
        description: '',
        entry: 'solo' as 'solo' | 'family',
        size: 16,
        metric: '',
        lower_is_better: false,
        prize: '',
        starts_at: '',
        ends_at: '',
    });
    const input =
        'input-glass h-10 w-full min-w-0 rounded-control px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';
    const challenge = form.data.kind === 'challenge';
    const error = Object.values(form.errors)[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-dialog border-white/10 text-white sm:max-w-lg">
                <DialogTitle className="font-display text-xl">
                    {tr('Новий турнір')}
                </DialogTitle>
                <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(`/servers/${serverSlug}/tournaments`, {
                            onSuccess: () => onOpenChange(false),
                        });
                    }}
                >
                    <div className="grid grid-cols-2 gap-1 rounded-control bg-white/[0.05] p-1">
                        {(
                            [
                                ['bracket', tr('Сітка'), Trophy],
                                ['challenge', tr('Челендж'), Gauge],
                            ] as const
                        ).map(([kind, label, Icon]) => (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => form.setData('kind', kind)}
                                className={cn(
                                    'inline-flex h-9 items-center justify-center gap-2 rounded-[8px] text-sm font-medium transition',
                                    form.data.kind === kind
                                        ? 'bg-white/[0.12] text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                <Icon className="size-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-white/50">
                        {challenge
                            ? tr(
                                  'Учасники надсилають результат зі скриншотом, ви перевіряєте. У таблиці — найкращий результат кожного.',
                              )
                            : tr(
                                  'Гра на вибування: після реєстрації запускаєте турнір, сітка складається сама, ви вносите переможців матчів.',
                              )}
                    </p>
                    <input
                        value={form.data.title}
                        maxLength={80}
                        required
                        onChange={(e) => form.setData('title', e.target.value)}
                        placeholder={tr('Назва турніру')}
                        className={input}
                    />
                    <textarea
                        value={form.data.description}
                        maxLength={2000}
                        rows={3}
                        onChange={(e) =>
                            form.setData('description', e.target.value)
                        }
                        placeholder={tr('Правила й деталі (необов’язково)')}
                        className="input-glass w-full rounded-control px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    {challenge ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <input
                                value={form.data.metric}
                                maxLength={40}
                                onChange={(e) =>
                                    form.setData('metric', e.target.value)
                                }
                                placeholder={tr('Що рахуємо: очки, час, с…')}
                                className={input}
                            />
                            <select
                                value={form.data.lower_is_better ? '1' : '0'}
                                onChange={(e) =>
                                    form.setData(
                                        'lower_is_better',
                                        e.target.value === '1',
                                    )
                                }
                                className={input}
                                aria-label={tr('Хто перемагає')}
                            >
                                <option value="0">
                                    {tr('Перемагає більший результат')}
                                </option>
                                <option value="1">
                                    {tr('Перемагає менший результат')}
                                </option>
                            </select>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <select
                                value={form.data.entry}
                                onChange={(e) =>
                                    form.setData(
                                        'entry',
                                        e.target.value as 'solo' | 'family',
                                    )
                                }
                                className={input}
                                aria-label={tr('Хто грає')}
                            >
                                <option value="solo">{tr('Гравці')}</option>
                                <option value="family">
                                    {tr('Сім’ї сервера')}
                                </option>
                            </select>
                            <select
                                value={form.data.size}
                                onChange={(e) =>
                                    form.setData('size', Number(e.target.value))
                                }
                                className={input}
                                aria-label={tr('Місць у сітці')}
                            >
                                {sizes.map((size) => (
                                    <option key={size} value={size}>
                                        {tr('{n} місць', { n: size })}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-white/55">
                            {tr('Старт (Київ)')}
                            <input
                                type="datetime-local"
                                required
                                value={form.data.starts_at}
                                onChange={(e) =>
                                    form.setData('starts_at', e.target.value)
                                }
                                className={cn(input, 'mt-1')}
                            />
                        </label>
                        {challenge && (
                            <label className="text-xs text-white/55">
                                {tr('Завершення (Київ)')}
                                <input
                                    type="datetime-local"
                                    required
                                    value={form.data.ends_at}
                                    onChange={(e) =>
                                        form.setData('ends_at', e.target.value)
                                    }
                                    className={cn(input, 'mt-1')}
                                />
                            </label>
                        )}
                    </div>
                    <input
                        value={form.data.prize}
                        maxLength={120}
                        onChange={(e) => form.setData('prize', e.target.value)}
                        placeholder={tr('Приз (необов’язково)')}
                        className={input}
                    />
                    {error && <p className="text-xs text-rose-300">{error}</p>}
                    <div className="flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-control px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="btn-glow rounded-control px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Створити')}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
