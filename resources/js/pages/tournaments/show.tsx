import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    Crown,
    Flag,
    Gift,
    Play,
    Trophy,
    Upload,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    StatusPill,
    type EntryCard,
    type TournamentCard,
} from '@/components/tournaments/tournament-ui';
import { clockTime, formatDate, initials } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Match = {
    id: number;
    round: number;
    slot: number;
    a: EntryCard | null;
    b: EntryCard | null;
    winner_id: number | null;
    score: string | null;
};

type Submission = {
    id: number;
    value: number;
    note: string | null;
    status: 'pending' | 'approved' | 'rejected';
    proof_url: string | null;
    entry: EntryCard | null;
    created_at: string;
};

type Props = {
    tournament: TournamentCard & {
        description: string | null;
        lower_is_better: boolean;
        organizer: UserCard | null;
    };
    entries: EntryCard[];
    rounds: Match[][];
    leaderboard: { place: number; entry: EntryCard; value: number }[];
    winner: EntryCard | null;
    me: {
        entry_id: number | null;
        can_manage: boolean;
        families: { id: number; name: string }[];
        submissions: Submission[];
    };
    pending: Submission[];
};

const when = (iso: string) => `${formatDate(iso, false)}, ${clockTime(iso)}`;

const number = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function EntryAvatar({
    entry,
    className,
}: {
    entry: EntryCard;
    className?: string;
}) {
    return entry.avatar ? (
        <img
            src={entry.avatar}
            alt=""
            loading="lazy"
            className={cn(
                'size-7 shrink-0 object-cover',
                entry.family ? 'rounded-[6px]' : 'rounded-full',
                className,
            )}
        />
    ) : (
        <span
            className={cn(
                'grid size-7 shrink-0 place-items-center bg-white/10 text-[11px] font-semibold text-white/75',
                entry.family ? 'rounded-[6px]' : 'rounded-full',
                className,
            )}
        >
            {initials(entry.name)}
        </span>
    );
}

function roundName(index: number, total: number) {
    const left = total - index;
    if (left === 1) return tr('Фінал');
    if (left === 2) return tr('Півфінал');
    if (left === 3) return tr('Чвертьфінал');

    return tr('Раунд {n}', { n: index + 1 });
}

/** Сітка на вибування: раунди колонками, гортається вбік на телефоні. */
function Bracket({
    rounds,
    canManage,
    onPick,
}: {
    rounds: Match[][];
    canManage: boolean;
    onPick: (match: Match) => void;
}) {
    return (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-4">
                {rounds.map((matches, index) => (
                    <div key={index} className="flex w-56 flex-col">
                        <h3 className="mb-2 text-xs font-medium text-white/50">
                            {roundName(index, rounds.length)}
                        </h3>
                        <div className="flex flex-1 flex-col justify-around gap-3">
                            {matches.map((match) => {
                                const ready =
                                    match.a !== null && match.b !== null;
                                const clickable = canManage && ready;
                                const side = (entry: EntryCard | null) => (
                                    <div
                                        className={cn(
                                            'flex min-h-9 items-center gap-2 px-2.5 py-1.5 text-sm',
                                            entry === null && 'text-white/30',
                                            match.winner_id !== null &&
                                                entry?.id !== match.winner_id &&
                                                'text-white/40',
                                            entry?.id === match.winner_id &&
                                                'font-semibold text-white',
                                        )}
                                    >
                                        {entry ? (
                                            <>
                                                <EntryAvatar
                                                    entry={entry}
                                                    className="size-5"
                                                />
                                                <span className="min-w-0 flex-1 break-words">
                                                    {entry.name}
                                                </span>
                                                {entry.id ===
                                                    match.winner_id && (
                                                    <>
                                                        {match.score && (
                                                            <span className="text-[11px] font-normal text-white/55 tabular-nums">
                                                                {match.score}
                                                            </span>
                                                        )}
                                                        <Check className="size-3.5 text-primary" />
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <span className="truncate">
                                                {match.round === 1 ||
                                                (match.winner_id !== null &&
                                                    !ready)
                                                    ? tr('Вільний прохід')
                                                    : tr('Очікується')}
                                            </span>
                                        )}
                                    </div>
                                );

                                return (
                                    <button
                                        key={match.id}
                                        type="button"
                                        disabled={!clickable}
                                        onClick={() => onPick(match)}
                                        className={cn(
                                            'divide-y divide-white/[0.06] overflow-hidden rounded-control bg-white/[0.04] text-left ring-1 ring-white/[0.06] transition',
                                            clickable &&
                                                'hover:bg-white/[0.07] hover:ring-primary/40',
                                            ready &&
                                                match.winner_id === null &&
                                                'ring-primary/30',
                                        )}
                                    >
                                        {side(match.a)}
                                        {side(match.b)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReportDialog({
    tournamentId,
    match,
    onClose,
}: {
    tournamentId: number;
    match: Match | null;
    onClose: () => void;
}) {
    const [score, setScore] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => setScore(match?.score ?? ''), [match]);
    const report = (winner: EntryCard) => {
        if (!match) return;
        setBusy(true);
        router.post(
            `/tournaments/${tournamentId}/matches/${match.id}`,
            { winner_id: winner.id, score: score.trim() || null },
            {
                preserveScroll: true,
                onSuccess: onClose,
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <Dialog
            open={match !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="glass-strong rounded-dialog border-white/10 text-white sm:max-w-sm">
                <DialogTitle className="font-display text-lg">
                    {tr('Хто переміг?')}
                </DialogTitle>
                <input
                    value={score}
                    maxLength={20}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder={tr('Рахунок, наприклад 2:1 (необов’язково)')}
                    className="input-glass h-10 w-full rounded-control px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <div className="grid gap-2">
                    {[match?.a, match?.b].map(
                        (entry) =>
                            entry && (
                                <button
                                    key={entry.id}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => report(entry)}
                                    className={cn(
                                        'flex h-12 items-center gap-3 rounded-control bg-white/[0.06] px-3 text-left text-sm font-medium text-white transition hover:bg-primary/20 disabled:opacity-50',
                                        match?.winner_id === entry.id &&
                                            'ring-1 ring-primary/60',
                                    )}
                                >
                                    <EntryAvatar entry={entry} />
                                    <span className="min-w-0 flex-1 break-words">
                                        {entry.name}
                                    </span>
                                    <Crown className="size-4 text-white/40" />
                                </button>
                            ),
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SubmitForm({ tournament }: { tournament: Props['tournament'] }) {
    const form = useForm<{
        value: string;
        note: string;
        proof: File | null;
    }>({ value: '', note: '', proof: null });

    return (
        <form
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(`/tournaments/${tournament.id}/submissions`, {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: () => form.reset(),
                });
            }}
        >
            <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                value={form.data.value}
                onChange={(e) => form.setData('value', e.target.value)}
                placeholder={tournament.metric ?? tr('Результат')}
                className="input-glass h-10 w-full rounded-control px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
            <label className="input-glass flex h-10 cursor-pointer items-center gap-2 rounded-control px-3 text-sm text-white/60 hover:text-white">
                <Upload className="size-4 shrink-0" />
                <span className="truncate">
                    {form.data.proof?.name ?? tr('Скриншот-доказ')}
                </span>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) =>
                        form.setData('proof', e.target.files?.[0] ?? null)
                    }
                />
            </label>
            <button
                type="submit"
                disabled={form.processing}
                className="btn-glow h-10 rounded-control px-4 text-sm font-semibold disabled:opacity-50"
            >
                {tr('Надіслати')}
            </button>
            <input
                value={form.data.note}
                maxLength={200}
                onChange={(e) => form.setData('note', e.target.value)}
                placeholder={tr('Коментар (необов’язково)')}
                className="input-glass h-10 w-full rounded-control px-3 text-sm text-white placeholder:text-white/30 focus:outline-none sm:col-span-3"
            />
            {Object.values(form.errors)[0] && (
                <p className="text-xs text-rose-300 sm:col-span-3">
                    {Object.values(form.errors)[0]}
                </p>
            )}
        </form>
    );
}

const submissionStatus: Record<Submission['status'], string> = {
    pending: tr('На перевірці'),
    approved: tr('Зараховано'),
    rejected: tr('Відхилено'),
};

export default function TournamentShow({
    tournament,
    entries,
    rounds,
    leaderboard,
    winner,
    me,
    pending,
}: Props) {
    const [picked, setPicked] = useState<Match | null>(null);
    const [family, setFamily] = useState<number | null>(
        me.families[0]?.id ?? null,
    );
    const bracket = tournament.kind === 'bracket';
    const open = tournament.status === 'open';
    const running = tournament.status === 'running';
    const full = bracket && entries.length >= tournament.size;
    const canJoin =
        me.entry_id === null &&
        (open || (!bracket && running)) &&
        !full &&
        (tournament.entry === 'solo' || me.families.length > 0);
    const post = (
        url: string,
        data: Record<string, string | number | boolean | null> = {},
    ) => router.post(url, data, { preserveScroll: true });

    return (
        <>
            <Head title={tournament.title} />
            <div className="mx-auto max-w-5xl space-y-5">
                <Link
                    href={`/servers/${tournament.server.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tournament.server.name}
                </Link>

                <header className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/55">
                        <StatusPill status={tournament.status} />
                        <span>
                            {bracket
                                ? tournament.entry === 'family'
                                    ? tr('Сітка сімей')
                                    : tr('Сітка гравців')
                                : tr('Челендж · {metric}', {
                                      metric: tournament.metric ?? '',
                                  })}
                        </span>
                        <span>
                            {tournament.ends_at
                                ? `${when(tournament.starts_at)} — ${when(tournament.ends_at)}`
                                : when(tournament.starts_at)}
                        </span>
                    </div>
                    <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
                        {tournament.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
                        <span className="inline-flex items-center gap-1.5">
                            <UsersRound className="size-4" />
                            {bracket
                                ? tr('{n} з {max} учасників', {
                                      n: entries.length,
                                      max: tournament.size,
                                  })
                                : tr('Учасників: {n}', { n: entries.length })}
                        </span>
                        {tournament.prize && (
                            <span className="inline-flex items-center gap-1.5">
                                <Gift className="size-4" />
                                {tournament.prize}
                            </span>
                        )}
                        {tournament.organizer && (
                            <Link
                                href={`/${tournament.organizer.username}`}
                                className="hover:text-white"
                            >
                                {tr('Організатор: {name}', {
                                    name: tournament.organizer.name,
                                })}
                            </Link>
                        )}
                    </div>
                    {tournament.description && (
                        <p className="max-w-2xl text-sm whitespace-pre-line text-white/70">
                            {tournament.description}
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {canJoin && tournament.entry === 'family' && (
                            <select
                                value={family ?? ''}
                                onChange={(e) =>
                                    setFamily(Number(e.target.value))
                                }
                                className="input-glass h-10 rounded-control px-3 text-sm text-white"
                                aria-label={tr('Сім’я')}
                            >
                                {me.families.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {canJoin && (
                            <button
                                type="button"
                                onClick={() =>
                                    post(`/tournaments/${tournament.id}/join`, {
                                        family_id: family,
                                    })
                                }
                                className="btn-glow inline-flex h-10 items-center gap-2 rounded-control px-4 text-sm font-semibold"
                            >
                                <Flag className="size-4" />
                                {tournament.entry === 'family'
                                    ? tr('Записати сім’ю')
                                    : tr('Взяти участь')}
                            </button>
                        )}
                        {me.entry_id !== null && open && (
                            <button
                                type="button"
                                onClick={() =>
                                    router.delete(
                                        `/tournaments/${tournament.id}/join`,
                                        { preserveScroll: true },
                                    )
                                }
                                className="h-10 rounded-control bg-white/[0.06] px-4 text-sm text-white/75 hover:text-white"
                            >
                                {tr('Вийти з турніру')}
                            </button>
                        )}
                        {me.can_manage && open && (
                            <button
                                type="button"
                                onClick={() =>
                                    post(`/tournaments/${tournament.id}/start`)
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-control bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.12]"
                            >
                                <Play className="size-4" />
                                {bracket
                                    ? tr('Запустити й скласти сітку')
                                    : tr('Відкрити челендж зараз')}
                            </button>
                        )}
                        {me.can_manage && running && !bracket && (
                            <button
                                type="button"
                                onClick={() =>
                                    post(`/tournaments/${tournament.id}/finish`)
                                }
                                className="h-10 rounded-control bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.12]"
                            >
                                {tr('Завершити челендж')}
                            </button>
                        )}
                        {me.can_manage && (open || running) && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            tr(
                                                'Скасувати турнір? Учасники отримають сповіщення.',
                                            ),
                                        )
                                    ) {
                                        router.delete(
                                            `/tournaments/${tournament.id}`,
                                            { preserveScroll: true },
                                        );
                                    }
                                }}
                                className="h-10 rounded-control px-3 text-sm text-white/50 hover:text-rose-300"
                            >
                                {tr('Скасувати')}
                            </button>
                        )}
                    </div>
                </header>

                {winner && (
                    <section className="flex items-center gap-4 rounded-xl bg-primary/10 px-4 py-4 ring-1 ring-primary/25">
                        <Trophy className="size-7 shrink-0 text-primary" />
                        <EntryAvatar entry={winner} className="size-10" />
                        <div className="min-w-0">
                            <p className="text-xs text-white/60">
                                {tr('Переможець')}
                            </p>
                            <Link
                                href={winner.url}
                                className="block truncate font-display text-xl font-bold text-white"
                            >
                                {winner.name}
                            </Link>
                        </div>
                    </section>
                )}

                {bracket && rounds.length > 0 && (
                    <section className="glass rounded-xl p-4 sm:p-5">
                        <h2 className="mb-3 font-display text-lg font-semibold text-white">
                            {tr('Сітка')}
                        </h2>
                        {me.can_manage && running && (
                            <p className="mb-3 text-xs text-white/50">
                                {tr(
                                    'Натисніть на матч, щоб внести переможця. Змінити можна, доки наступний матч не зіграно.',
                                )}
                            </p>
                        )}
                        <Bracket
                            rounds={rounds}
                            canManage={me.can_manage}
                            onPick={setPicked}
                        />
                    </section>
                )}

                {!bracket && (
                    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                        <section className="glass rounded-xl p-4 sm:p-5">
                            <h2 className="font-display text-lg font-semibold text-white">
                                {tr('Таблиця')}
                            </h2>
                            <p className="mt-0.5 text-xs text-white/45">
                                {tournament.lower_is_better
                                    ? tr('Найкращий — найменший результат')
                                    : tr('Найкращий — найбільший результат')}
                            </p>
                            {leaderboard.length === 0 ? (
                                <p className="mt-6 mb-4 text-center text-sm text-white/45">
                                    {tr(
                                        'Тут з’являться результати після перевірки організатором.',
                                    )}
                                </p>
                            ) : (
                                <ol className="mt-3 divide-y divide-white/[0.06]">
                                    {leaderboard.map((row) => (
                                        <li
                                            key={row.entry.id}
                                            className={cn(
                                                'flex items-center gap-3 py-2.5',
                                                row.entry.id === me.entry_id &&
                                                    'text-primary',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'w-6 text-center font-display text-sm font-bold tabular-nums',
                                                    row.place <= 3
                                                        ? 'text-white'
                                                        : 'text-white/40',
                                                )}
                                            >
                                                {row.place}
                                            </span>
                                            <EntryAvatar entry={row.entry} />
                                            <Link
                                                href={row.entry.url}
                                                className="min-w-0 flex-1 text-sm font-medium break-words text-white"
                                            >
                                                {row.entry.name}
                                            </Link>
                                            <span className="font-display text-sm font-semibold text-white tabular-nums">
                                                {number(row.value)}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>
                        <div className="space-y-5">
                            {running && (
                                <section className="glass rounded-xl p-4 sm:p-5">
                                    <h2 className="mb-3 font-display text-lg font-semibold text-white">
                                        {tr('Надіслати результат')}
                                    </h2>
                                    <SubmitForm tournament={tournament} />
                                </section>
                            )}
                            {me.submissions.length > 0 && (
                                <section className="glass rounded-xl p-4 sm:p-5">
                                    <h2 className="mb-2 font-display text-lg font-semibold text-white">
                                        {tr('Мої результати')}
                                    </h2>
                                    <ul className="divide-y divide-white/[0.06]">
                                        {me.submissions.map((item) => (
                                            <li
                                                key={item.id}
                                                className="flex items-center gap-3 py-2 text-sm"
                                            >
                                                <span className="font-semibold text-white tabular-nums">
                                                    {number(item.value)}
                                                </span>
                                                <span className="flex-1 text-xs text-white/40">
                                                    {when(item.created_at)}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-xs',
                                                        item.status ===
                                                            'approved' &&
                                                            'text-primary',
                                                        item.status ===
                                                            'rejected' &&
                                                            'text-rose-300',
                                                        item.status ===
                                                            'pending' &&
                                                            'text-white/55',
                                                    )}
                                                >
                                                    {
                                                        submissionStatus[
                                                            item.status
                                                        ]
                                                    }
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </div>
                    </div>
                )}

                {me.can_manage && pending.length > 0 && (
                    <section className="glass rounded-xl p-4 sm:p-5">
                        <h2 className="mb-3 font-display text-lg font-semibold text-white">
                            {tr('На перевірці: {n}', { n: pending.length })}
                        </h2>
                        <ul className="divide-y divide-white/[0.06]">
                            {pending.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex flex-wrap items-center gap-3 py-3"
                                >
                                    {item.proof_url ? (
                                        <a
                                            href={item.proof_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <img
                                                src={item.proof_url}
                                                alt={tr('Скриншот-доказ')}
                                                className="h-14 w-24 rounded-[8px] object-cover"
                                            />
                                        </a>
                                    ) : (
                                        <span className="grid h-14 w-24 place-items-center rounded-[8px] bg-white/[0.04] text-[11px] text-white/35">
                                            {tr('Без скриншота')}
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">
                                            {item.entry?.name}
                                        </p>
                                        <p className="font-display text-sm font-semibold text-white tabular-nums">
                                            {number(item.value)}
                                        </p>
                                        {item.note && (
                                            <p className="truncate text-xs text-white/50">
                                                {item.note}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            type="button"
                                            aria-label={tr('Зарахувати')}
                                            onClick={() =>
                                                post(
                                                    `/tournaments/${tournament.id}/submissions/${item.id}`,
                                                    { approve: true },
                                                )
                                            }
                                            className="grid size-9 place-items-center rounded-control bg-primary/15 text-primary hover:bg-primary/25"
                                        >
                                            <Check className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={tr('Відхилити')}
                                            onClick={() =>
                                                post(
                                                    `/tournaments/${tournament.id}/submissions/${item.id}`,
                                                    { approve: false },
                                                )
                                            }
                                            className="grid size-9 place-items-center rounded-control bg-white/[0.06] text-white/60 hover:text-rose-300"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {bracket && rounds.length === 0 && (
                    <section className="glass rounded-xl p-4 sm:p-5">
                        <h2 className="mb-2 font-display text-lg font-semibold text-white">
                            {tr('Учасники')}
                        </h2>
                        {entries.length === 0 ? (
                            <p className="py-4 text-sm text-white/45">
                                {tr(
                                    'Поки ніхто не записався — будьте першими.',
                                )}
                            </p>
                        ) : (
                            <ul className="grid gap-1 sm:grid-cols-2">
                                {entries.map((entry) => (
                                    <li key={entry.id}>
                                        <Link
                                            href={entry.url}
                                            className="flex items-center gap-2.5 rounded-control px-2 py-2 text-sm text-white hover:bg-white/[0.05]"
                                        >
                                            <EntryAvatar entry={entry} />
                                            <span className="truncate">
                                                {entry.name}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </div>
            <ReportDialog
                tournamentId={tournament.id}
                match={picked}
                onClose={() => setPicked(null)}
            />
        </>
    );
}
