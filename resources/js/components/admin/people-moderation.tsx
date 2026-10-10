import { Link, router } from '@inertiajs/react';
import { Ban, Check, Gavel, UserX, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type PersonReport = {
    user_id: number;
    user: UserCard;
    count: number;
    reasons: string[];
    comments: string[];
    reporters: string[];
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
    created_at: string;
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
    const resolve = (row: PersonReport, action: 'ban' | 'mute' | 'dismiss') => {
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
        <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
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
        <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
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
                                <span className="ml-auto">
                                    {timeAgo(item.created_at)}
                                </span>
                            </div>
                            <p className="mt-2 text-sm whitespace-pre-line text-white/80">
                                {item.body}
                            </p>
                            <textarea
                                value={replies[item.id] ?? ''}
                                onChange={(e) =>
                                    setReplies({
                                        ...replies,
                                        [item.id]: e.target.value,
                                    })
                                }
                                rows={2}
                                maxLength={1000}
                                placeholder={tr(
                                    'Відповідь людині (необов’язково)',
                                )}
                                className="input-glass mt-2 w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
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
