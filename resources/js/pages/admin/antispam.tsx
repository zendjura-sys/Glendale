import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Ban,
    Globe2,
    History,
    Search,
    ShieldAlert,
    ShieldOff,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type BanRow = {
    id: number;
    ip: string | null;
    guest: string | null;
    community: string | null;
    reason: string | null;
    expires_at: string | null;
    created_at: string;
    by: string | null;
};

type AddressRow = {
    ip: string;
    logins: number;
    last_at: string | null;
    others: number;
    banned: boolean;
};

type AccountRow = {
    user: UserCard;
    ip: string;
    logins: number;
    last_at: string | null;
    banned: boolean;
};

type Props = {
    links: {
        mode: 'blocklist' | 'allowlist';
        blocked: string[];
        allowed: string[];
        on: boolean;
    };
    bans_on: boolean;
    bans: BanRow[];
    log: {
        query: string;
        kind: 'ip' | 'user' | 'none';
        user: UserCard | null;
        rows: (AddressRow | AccountRow)[];
    };
    recent: {
        id: number;
        kind: string;
        user: UserCard | null;
        detail: string | null;
        created_at: string;
    }[];
};

const field = 'input-glass w-full rounded-xl px-3 text-sm text-white';

/** Адмінка → Антиспам: фільтр доменів, бани за IP і гостей, журнал IP, що зупинив антиспам. */
export default function AdminAntispam({
    links,
    bans_on,
    bans,
    log,
    recent,
}: Props) {
    const linkForm = useForm({
        mode: links.mode,
        blocked: links.blocked.join('\n'),
        allowed: links.allowed.join('\n'),
    });
    const banForm = useForm({ ip: '', reason: '', days: '' as string });
    const [query, setQuery] = useState(log.query);

    const saveLinks = (event: FormEvent) => {
        event.preventDefault();
        linkForm.put('/admin/antispam/links', { preserveScroll: true });
    };
    const ban = (event: FormEvent) => {
        event.preventDefault();
        banForm.transform((data) => ({
            ...data,
            days: data.days === '' ? null : Number(data.days),
        }));
        banForm.post('/admin/antispam/bans', {
            preserveScroll: true,
            onSuccess: () => banForm.reset(),
        });
    };
    const search = (event: FormEvent) => {
        event.preventDefault();
        router.get('/admin/antispam', query.trim() ? { q: query.trim() } : {}, {
            preserveScroll: true,
            preserveState: true,
        });
    };
    const banAddress = (ip: string) =>
        router.post(
            '/admin/antispam/bans',
            { ip, reason: tr('З журналу IP'), days: 30 },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={tr('Антиспам — адмінка')} />
            <PageHeader
                title={tr('Антиспам')}
                description={tr(
                    'Фільтр доменів, бани за IP і гостей, журнал адрес і все, що зупинив захист за останній час.',
                )}
            />

            <div className="grid gap-6 xl:grid-cols-2">
                <section className="glass rounded-2xl p-4 sm:p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <Globe2 className="size-5 text-gc-lilac-300" />
                        {tr('Фільтр доменів')}
                    </h2>
                    <p className="mb-4 text-sm text-white/50">
                        {links.on
                            ? tr(
                                  'Діє в чатах, записах, коментарях і статтях. Піддомени теж рахуються.',
                              )
                            : tr(
                                  'Плагін «Фільтр доменів» вимкнено — списки збережуться, але не діятимуть.',
                              )}
                    </p>
                    <form onSubmit={saveLinks} className="space-y-3">
                        <div className="flex rounded-xl bg-white/[0.04] p-1">
                            {(
                                [
                                    ['blocklist', tr('Чорний список')],
                                    ['allowlist', tr('Лише дозволені')],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        linkForm.setData('mode', value)
                                    }
                                    className={cn(
                                        'h-9 flex-1 rounded-lg text-sm font-medium transition',
                                        linkForm.data.mode === value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <label className="block text-sm text-white/70">
                            {tr('Заборонені домени')}
                            <textarea
                                value={linkForm.data.blocked}
                                onChange={(e) =>
                                    linkForm.setData('blocked', e.target.value)
                                }
                                rows={4}
                                placeholder="free-skins.example&#10;bit.ly"
                                className={cn(field, 'mt-1.5 py-2 font-mono')}
                            />
                        </label>
                        {linkForm.data.mode === 'allowlist' && (
                            <label className="block text-sm text-white/70">
                                {tr(
                                    'Дозволені домени (усі інші посилання не пройдуть)',
                                )}
                                <textarea
                                    value={linkForm.data.allowed}
                                    onChange={(e) =>
                                        linkForm.setData(
                                            'allowed',
                                            e.target.value,
                                        )
                                    }
                                    rows={4}
                                    placeholder="youtube.com&#10;twitch.tv&#10;steamcommunity.com"
                                    className={cn(
                                        field,
                                        'mt-1.5 py-2 font-mono',
                                    )}
                                />
                            </label>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={linkForm.processing}
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Зберегти')}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="glass rounded-2xl p-4 sm:p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <Ban className="size-5 text-rose-300" />
                        {tr('Бани за IP')}
                    </h2>
                    <p className="mb-4 text-sm text-white/50">
                        {bans_on
                            ? tr(
                                  'З забаненої адреси сайт можна читати, але не можна входити, писати й реєструватися.',
                              )
                            : tr('Плагін «Бани за IP» вимкнено.')}
                    </p>
                    <form
                        onSubmit={ban}
                        className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"
                    >
                        <input
                            value={banForm.data.ip}
                            onChange={(e) =>
                                banForm.setData('ip', e.target.value)
                            }
                            placeholder={tr('1.2.3.4 або 1.2.3.0/24')}
                            className={cn(field, 'h-10 font-mono')}
                        />
                        <select
                            value={banForm.data.days}
                            onChange={(e) =>
                                banForm.setData('days', e.target.value)
                            }
                            className={selectClass}
                        >
                            <option value="1">{tr('1 день')}</option>
                            <option value="7">{tr('7 днів')}</option>
                            <option value="30">{tr('30 днів')}</option>
                            <option value="365">{tr('Рік')}</option>
                            <option value="">{tr('Назавжди')}</option>
                        </select>
                        <button
                            type="submit"
                            disabled={
                                banForm.processing ||
                                banForm.data.ip.trim() === ''
                            }
                            className="h-10 rounded-xl bg-rose-500/20 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-50"
                        >
                            {tr('Забанити')}
                        </button>
                        <input
                            value={banForm.data.reason}
                            onChange={(e) =>
                                banForm.setData('reason', e.target.value)
                            }
                            maxLength={200}
                            placeholder={tr('Причина (необов’язково)')}
                            className={cn(field, 'h-10 sm:col-span-3')}
                        />
                        {banForm.errors.ip && (
                            <p className="text-sm text-rose-300 sm:col-span-3">
                                {banForm.errors.ip}
                            </p>
                        )}
                    </form>

                    <ul className="mt-4 space-y-2">
                        {bans.length === 0 && (
                            <li className="text-sm text-white/45">
                                {tr('Активних банів немає.')}
                            </li>
                        )}
                        {bans.map((row) => (
                            <li
                                key={row.id}
                                className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3"
                            >
                                {row.guest ? (
                                    <UserRound className="mt-0.5 size-4 shrink-0 text-white/45" />
                                ) : (
                                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-300" />
                                )}
                                <div className="min-w-0 flex-1 text-sm">
                                    <p className="font-medium text-white">
                                        {row.guest
                                            ? tr('Гість «{name}»', {
                                                  name: row.guest,
                                              })
                                            : row.ip}
                                        {row.community && (
                                            <span className="ml-2 text-xs font-normal text-white/45">
                                                {tr('лише в «{name}»', {
                                                    name: row.community,
                                                })}
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-white/45">
                                        {[
                                            row.reason,
                                            row.expires_at
                                                ? tr('до {date}', {
                                                      date: formatDate(
                                                          row.expires_at,
                                                          false,
                                                      ),
                                                  })
                                                : tr('назавжди'),
                                            row.by,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.delete(
                                            `/admin/antispam/bans/${row.id}`,
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                                >
                                    <ShieldOff className="size-3.5" />
                                    {tr('Зняти')}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            <section className="glass mt-6 rounded-2xl p-4 sm:p-5">
                <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <Search className="size-5 text-gc-lilac-300" />
                    {tr('Журнал IP')}
                </h2>
                <p className="mb-4 text-sm text-white/50">
                    {tr(
                        'Нік чи email — адреси акаунта й скільки інших акаунтів з них входило. IP чи підмережа — хто з неї входив.',
                    )}
                </p>
                <form onSubmit={search} className="flex gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tr('@нік, email або 1.2.3.4')}
                        className={cn(field, 'h-10')}
                    />
                    <button
                        type="submit"
                        className="btn-glow h-10 shrink-0 rounded-xl px-5 text-sm font-semibold"
                    >
                        {tr('Знайти')}
                    </button>
                </form>

                {log.kind !== 'none' && log.rows.length === 0 && (
                    <p className="mt-4 text-sm text-white/45">
                        {log.kind === 'user' && log.user === null
                            ? tr('Такого акаунта немає.')
                            : tr('Записів немає.')}
                    </p>
                )}
                {log.kind === 'user' && log.user && log.rows.length > 0 && (
                    <div className="mt-4">
                        <p className="mb-2 flex items-center gap-2 text-sm text-white/70">
                            <UserAvatar user={log.user} size="xs" />
                            {log.user.name}
                        </p>
                        <ul className="divide-y divide-white/[0.06]">
                            {(log.rows as AddressRow[]).map((row) => (
                                <li
                                    key={row.ip}
                                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery(row.ip);
                                            router.get(
                                                '/admin/antispam',
                                                { q: row.ip },
                                                { preserveScroll: true },
                                            );
                                        }}
                                        className="font-mono text-white hover:text-gc-sky"
                                    >
                                        {row.ip}
                                    </button>
                                    <span className="text-white/45">
                                        {tr('входів: {count}', {
                                            count: row.logins,
                                        })}
                                    </span>
                                    {row.last_at && (
                                        <span className="text-white/45">
                                            {timeAgo(row.last_at)}
                                        </span>
                                    )}
                                    {row.others > 0 && (
                                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                                            {tr('ще акаунтів: {count}', {
                                                count: row.others,
                                            })}
                                        </span>
                                    )}
                                    <span className="ml-auto">
                                        {row.banned ? (
                                            <span className="text-xs text-rose-300">
                                                {tr('забанено')}
                                            </span>
                                        ) : (
                                            bans_on && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        banAddress(row.ip)
                                                    }
                                                    className="text-xs text-white/50 hover:text-rose-300"
                                                >
                                                    {tr('Забанити на 30 днів')}
                                                </button>
                                            )
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {log.kind === 'ip' && log.rows.length > 0 && (
                    <ul className="mt-4 divide-y divide-white/[0.06]">
                        {(log.rows as AccountRow[]).map((row) => (
                            <li
                                key={row.user.id}
                                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm"
                            >
                                <Link
                                    href={`/admin/users?search=${row.user.username}`}
                                    className="flex items-center gap-2 text-white hover:text-gc-sky"
                                >
                                    <UserAvatar user={row.user} size="xs" />
                                    {row.user.name}
                                    <span className="text-white/40">
                                        @{row.user.username}
                                    </span>
                                </Link>
                                <span className="font-mono text-white/45">
                                    {row.ip}
                                </span>
                                <span className="text-white/45">
                                    {tr('входів: {count}', {
                                        count: row.logins,
                                    })}
                                </span>
                                {row.last_at && (
                                    <span className="text-white/45">
                                        {timeAgo(row.last_at)}
                                    </span>
                                )}
                                {row.banned && (
                                    <span className="ml-auto text-xs text-rose-300">
                                        {tr('акаунт заблоковано')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="glass mt-6 rounded-2xl p-4 sm:p-5">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <History className="size-5 text-gc-lilac-300" />
                    {tr('Що зупинив антиспам')}
                </h2>
                {recent.length === 0 ? (
                    <p className="text-sm text-white/45">
                        {tr('Поки тихо — спроб не було.')}
                    </p>
                ) : (
                    <ul className="divide-y divide-white/[0.06]">
                        {recent.map((row) => (
                            <li
                                key={row.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                            >
                                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/70">
                                    {row.kind}
                                </span>
                                <span className="text-white/80">
                                    {row.user?.name ?? tr('Гість')}
                                </span>
                                {row.detail && (
                                    <span className="truncate font-mono text-xs text-white/45">
                                        {row.detail}
                                    </span>
                                )}
                                <span className="ml-auto text-xs text-white/40">
                                    {timeAgo(row.created_at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
