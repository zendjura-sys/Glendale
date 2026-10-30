import { Link, router } from '@inertiajs/react';
import {
    Ban,
    Check,
    Flag,
    Gavel,
    MessageSquareHeart,
    ShieldCheck,
    UserCheck,
    UserX,
    VolumeX,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import { SpellcheckTextarea } from '@/components/gc/spellcheck';

export type PersonReport = {
    user_id: number;
    user: UserCard;
    count: number;
    reasons: string[];
    comments: string[];
    reporters: string[];
    trusted?: boolean;
    strikes?: number;
    created_at: string;
};

export type AppealItem = {
    id: number;
    kind: string;
    body: string;
    user: UserCard | null;
    banned: boolean;
    ban_reason: string | null;
    muted_until: string | null;
    strikes?: number;
    created_at: string;
    due_at?: string;
    overdue?: boolean;
};

const button =
    'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm transition';

/** Скарги на людей: заблокувати, заборонити писати або відхилити. */
export function PeopleReports({
    people,
    muteHours,
    hoursLabel,
}: {
    people: PersonReport[];
    muteHours: number[];
    hoursLabel: (h: number) => string;
}) {
    const [hours, setHours] = useState<Record<number, number>>({});
    const resolve = (
        row: PersonReport,
        action: 'ban' | 'mute' | 'strike' | 'dismiss',
    ) => {
        if (
            action === 'ban' &&
            !window.confirm(tr('Заблокувати {name}?', { name: row.user.name }))
        ) {
            return;
        }
        router.post(
            `/admin/moderation/people/${row.user_id}`,
            {
                action,
                hours: action === 'mute' ? (hours[row.user_id] ?? 24) : null,
                reason: row.reasons.join(', '),
            },
            { preserveScroll: true },
        );
    };

    return (
        <section className="glass mb-6 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <UserX className="size-5 text-white/60" />
                {tr('Скарги на людей')}
            </h2>
            {people.length === 0 ? (
                <p className="text-sm text-white/45">
                    {tr('Нових скарг немає.')}
                </p>
            ) : (
                <div className="space-y-3">
                    {people.map((row) => (
                        <article
                            key={row.user_id}
                            className="rounded-2xl bg-white/[0.03] p-3"
                        >
                            <div className="flex items-start gap-2.5">
                                <Link href={`/${row.user.username}`}>
                                    <UserAvatar user={row.user} size="sm" />
                                </Link>
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                                        {row.user.name}
                                        <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-normal text-rose-200">
                                            {tr('Скарг: {count}', {
                                                count: row.count,
                                            })}
                                        </span>
                                        {row.trusted && (
                                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-normal text-emerald-200">
                                                {tr('Довірений скаржник')}
                                            </span>
                                        )}
                                        {(row.strikes ?? 0) > 0 && (
                                            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-200">
                                                {tr('Страйків: {count}', {
                                                    count: row.strikes ?? 0,
                                                })}
                                            </span>
                                        )}
                                        <span className="ml-auto text-xs font-normal text-white/45">
                                            {timeAgo(row.created_at)}
                                        </span>
                                    </p>
                                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-white/60">
                                        {row.reasons.map((reason) => (
                                            <span
                                                key={reason}
                                                className="rounded-md bg-white/[0.06] px-2 py-0.5"
                                            >
                                                {tr(reason)}
                                            </span>
                                        ))}
                                    </p>
                                    {row.comments.length > 0 && (
                                        <p className="mt-2 text-xs text-white/50">
                                            {tr('Коментарі:')}{' '}
                                            {row.comments.join(' · ')}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-white/35">
                                        {tr('Поскаржилися:')}{' '}
                                        {row.reporters.join(', ')}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => resolve(row, 'ban')}
                                    className={`${button} bg-rose-500/15 text-rose-200 hover:bg-rose-500/25`}
                                >
                                    <Gavel className="size-4" />
                                    {tr('Заблокувати')}
                                </button>
                                <span className="inline-flex items-center gap-1">
                                    <select
                                        value={hours[row.user_id] ?? 24}
                                        onChange={(e) =>
                                            setHours({
                                                ...hours,
                                                [row.user_id]: Number(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        className="input-glass h-9 rounded-xl px-2 text-sm text-white"
                                        aria-label={tr('На скільки заглушити')}
                                    >
                                        {muteHours.map((h) => (
                                            <option key={h} value={h}>
                                                {hoursLabel(h)}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => resolve(row, 'mute')}
                                        className={`${button} bg-amber-500/15 text-amber-200 hover:bg-amber-500/25`}
                                    >
                                        <VolumeX className="size-4" />
                                        {tr('Заборонити писати')}
                                    </button>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => resolve(row, 'strike')}
                                    className={`${button} bg-white/[0.06] text-white/80 hover:bg-white/[0.1]`}
                                >
                                    <Flag className="size-4" />
                                    {tr('Страйк')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => resolve(row, 'dismiss')}
                                    className={`${button} text-white/55 hover:bg-white/[0.06] hover:text-white`}
                                >
                                    <Ban className="size-4" />
                                    {tr('Відхилити')}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

/** Оскарження рішень: прийняти (знімає блокування чи заборону) або відхилити з відповіддю. */
export function Appeals({ appeals }: { appeals: AppealItem[] }) {
    const [replies, setReplies] = useState<Record<number, string>>({});
    const answer = (item: AppealItem, accept: boolean) =>
        router.post(
            `/admin/moderation/appeals/${item.id}`,
            { accept, reply: replies[item.id] ?? '' },
            { preserveScroll: true },
        );

    return (
        <section
            id="appeals"
            className="glass mb-6 scroll-mt-24 rounded-2xl p-4 sm:p-5"
        >
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <Gavel className="size-5 text-white/60" />
                {tr('Оскарження')}
            </h2>
            {appeals.length === 0 ? (
                <p className="text-sm text-white/45">
                    {tr('Нових оскаржень немає.')}
                </p>
            ) : (
                <div className="space-y-3">
                    {appeals.map((item) => (
                        <article
                            key={item.id}
                            className="rounded-2xl bg-white/[0.03] p-3"
                        >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                                {item.user && (
                                    <Link
                                        href={`/${item.user.username}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-white"
                                    >
                                        <UserAvatar
                                            user={item.user}
                                            size="sm"
                                        />
                                        {item.user.name}
                                    </Link>
                                )}
                                <span className="rounded-md bg-white/[0.06] px-2 py-0.5">
                                    {tr(item.kind)}
                                </span>
                                {item.banned && (
                                    <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-rose-200">
                                        {tr('Заблоковано')}
                                        {item.ban_reason &&
                                            `: ${item.ban_reason}`}
                                    </span>
                                )}
                                {item.muted_until && (
                                    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-200">
                                        {tr('Не може писати до {date}', {
                                            date: formatDate(item.muted_until),
                                        })}
                                    </span>
                                )}
                                {(item.strikes ?? 0) > 0 && (
                                    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-200">
                                        {tr('Страйків: {count}', {
                                            count: item.strikes ?? 0,
                                        })}
                                    </span>
                                )}
                                <span
                                    className={cn(
                                        'ml-auto',
                                        item.overdue &&
                                            'font-medium text-rose-300',
                                    )}
                                >
                                    {item.overdue
                                        ? tr('Прострочено · {ago}', {
                                              ago: timeAgo(item.created_at),
                                          })
                                        : item.due_at
                                          ? tr('Відповісти до {date}', {
                                                date: formatDate(item.due_at),
                                            })
                                          : timeAgo(item.created_at)}
                                </span>
                            </div>
                            <p className="mt-2 text-sm whitespace-pre-line text-white/80">
                                {item.body}
                            </p>
                            <SpellcheckTextarea
                                value={replies[item.id] ?? ''}
                                onValueChange={(v) =>
                                    setReplies({
                                        ...replies,
                                        [item.id]: v,
                                    })
                                }
                                textClassName="px-3 py-2 text-sm"
                                containerClassName="mt-2"
                                rows={2}
                                maxLength={1000}
                                placeholder={tr(
                                    'Відповідь людині (необов’язково)',
                                )}
                                className="input-glass w-full rounded-xl text-white placeholder:text-white/30 focus:outline-none"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => answer(item, true)}
                                    className={`${button} bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25`}
                                >
                                    <Check className="size-4" />
                                    {tr('Прийняти')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => answer(item, false)}
                                    className={`${button} text-white/55 hover:bg-white/[0.06] hover:text-white`}
                                >
                                    <X className="size-4" />
                                    {tr('Відхилити')}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export type FeedbackItem = {
    id: number;
    kind: string;
    body: string;
    url: string | null;
    user: UserCard | null;
    created_at: string;
};

/** Відгуки від людей: прочитане зникає зі списку. */
export function FeedbackList({ feedback }: { feedback: FeedbackItem[] }) {
    return (
        <section className="glass mb-6 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <MessageSquareHeart className="size-5 text-white/60" />
                {tr('Відгуки')}
            </h2>
            {feedback.length === 0 ? (
                <p className="text-sm text-white/45">
                    {tr('Нових відгуків немає.')}
                </p>
            ) : (
                <div className="space-y-3">
                    {feedback.map((item) => (
                        <article
                            key={item.id}
                            className="rounded-2xl bg-white/[0.03] p-3"
                        >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                                {item.user && (
                                    <Link
                                        href={`/${item.user.username}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-white"
                                    >
                                        <UserAvatar
                                            user={item.user}
                                            size="sm"
                                        />
                                        {item.user.name}
                                    </Link>
                                )}
                                <span className="rounded-md bg-white/[0.06] px-2 py-0.5">
                                    {tr(item.kind)}
                                </span>
                                {item.url && (
                                    <Link
                                        href={item.url}
                                        className="truncate text-gc-lilac-300 hover:text-white"
                                    >
                                        {item.url}
                                    </Link>
                                )}
                                <span className="ml-auto">
                                    {timeAgo(item.created_at)}
                                </span>
                            </div>
                            <p className="mt-2 text-sm whitespace-pre-line text-white/80">
                                {item.body}
                            </p>
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/admin/moderation/feedback/${item.id}`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className={`${button} text-white/60 hover:bg-white/[0.06] hover:text-white`}
                                >
                                    <Check className="size-4" />
                                    {tr('Прочитано')}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export type NewcomerItem = UserCard & {
    created_at: string | null;
    posts: number;
    signals: string[];
    risk: number;
};

export type ReporterItem = UserCard & {
    resolved: number;
    dismissed: number;
    trusted: boolean;
    manual: boolean | null;
};

/** Черга новачків: нові акаунти з ознаками ризику — переглянути, заборонити писати чи заблокувати. */
export function Newcomers({ items }: { items: NewcomerItem[] }) {
    if (items.length === 0) return null;
    const act = (id: number, action: 'ban' | 'mute') =>
        (action !== 'ban' || window.confirm(tr('Заблокувати акаунт?'))) &&
        router.post(
            `/admin/moderation/people/${id}`,
            {
                action,
                hours: action === 'mute' ? 24 : null,
                reason: tr('Перевірка нового акаунта'),
            },
            { preserveScroll: true },
        );

    return (
        <section className="glass mb-6 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <UserCheck className="size-5 text-white/60" />
                {tr('Новачки на перевірку')}
            </h2>
            <p className="mb-3 text-sm text-white/45">
                {tr('Акаунти до 7 днів; найризиковіші — зверху.')}
            </p>
            <div className="divide-y divide-white/[0.05]">
                {items.map((u) => (
                    <div
                        key={u.id}
                        className="flex flex-wrap items-center gap-3 py-2.5"
                    >
                        <Link
                            href={`/${u.username}`}
                            className="flex min-w-0 flex-1 items-center gap-2.5"
                        >
                            <UserAvatar user={u} size="sm" />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">
                                    {u.name}
                                </span>
                                <span className="block text-xs text-white/45">
                                    {u.created_at && timeAgo(u.created_at)} ·{' '}
                                    {tr('записів: {count}', { count: u.posts })}
                                </span>
                            </span>
                        </Link>
                        <div className="flex flex-wrap gap-1.5">
                            {u.signals.map((signal) => (
                                <span
                                    key={signal}
                                    className={cn(
                                        'rounded-md px-2 py-0.5 text-xs',
                                        u.risk >= 5
                                            ? 'bg-rose-500/15 text-rose-200'
                                            : 'bg-white/[0.06] text-white/60',
                                    )}
                                >
                                    {tr(signal)}
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        `/admin/moderation/users/${u.id}/reviewed`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                                className={`${button} bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25`}
                            >
                                <Check className="size-4" />
                                {tr('Усе гаразд')}
                            </button>
                            <button
                                type="button"
                                onClick={() => act(u.id, 'mute')}
                                aria-label={tr('Заборонити писати на добу')}
                                className={`${button} bg-amber-500/15 text-amber-200 hover:bg-amber-500/25`}
                            >
                                <VolumeX className="size-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => act(u.id, 'ban')}
                                aria-label={tr('Заблокувати')}
                                className={`${button} bg-rose-500/15 text-rose-200 hover:bg-rose-500/25`}
                            >
                                <Gavel className="size-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** Скаржники за 90 днів: точність скарг і ручна позначка довіри. */
export function Reporters({ items }: { items: ReporterItem[] }) {
    if (items.length === 0) return null;
    const set = (id: number, trusted: boolean | null) =>
        router.post(
            `/admin/moderation/users/${id}/trust`,
            { trusted },
            { preserveScroll: true },
        );

    return (
        <section className="glass mb-6 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <ShieldCheck className="size-5 text-white/60" />
                {tr('Скаржники')}
            </h2>
            <p className="mb-3 text-sm text-white/45">
                {tr(
                    'Довірені (від 10 розглянутих скарг і 80% по ділу) піднімаються в черзі.',
                )}
            </p>
            <div className="divide-y divide-white/[0.05]">
                {items.map((u) => {
                    const total = u.resolved + u.dismissed;
                    return (
                        <div
                            key={u.id}
                            className="flex flex-wrap items-center gap-3 py-2"
                        >
                            <UserAvatar user={u} size="xs" />
                            <span className="min-w-0 flex-1 truncate text-sm text-white">
                                {u.name}
                            </span>
                            <span className="text-xs text-white/50 tabular-nums">
                                {tr('по ділу {ok} з {total}', {
                                    ok: u.resolved,
                                    total,
                                })}
                            </span>
                            {u.trusted && (
                                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
                                    {u.manual === true
                                        ? tr('Довірений (вручну)')
                                        : tr('Довірений')}
                                </span>
                            )}
                            <select
                                value={
                                    u.manual === null
                                        ? 'auto'
                                        : u.manual
                                          ? 'yes'
                                          : 'no'
                                }
                                onChange={(e) =>
                                    set(
                                        u.id,
                                        e.target.value === 'auto'
                                            ? null
                                            : e.target.value === 'yes',
                                    )
                                }
                                aria-label={tr('Довіра')}
                                className="input-glass h-8 rounded-lg px-2 text-xs text-white"
                            >
                                <option value="auto">
                                    {tr('Автоматично')}
                                </option>
                                <option value="yes">{tr('Довіряти')}</option>
                                <option value="no">{tr('Не довіряти')}</option>
                            </select>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
