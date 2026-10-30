import { Head, Link, router } from '@inertiajs/react';
import { CircleCheck, CircleX, ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Pagination } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Paginated, UserCard } from '@/types';

type Status = 'pending' | 'needs_info' | 'approved' | 'rejected';

type Item = {
    id: number;
    kind: string;
    kind_label: string;
    status: Status;
    links: string[];
    note: string | null;
    has_document: boolean;
    reason: string | null;
    created_at: string;
    decided_at: string | null;
    reviewer: string | null;
    user:
        | (UserCard & {
              account_label: string | null;
              created_at: string | null;
              requirements: { key: string; label: string; ok: boolean }[];
          })
        | null;
};

const TABS: [Status, () => string][] = [
    ['pending', () => tr('Нові')],
    ['needs_info', () => tr('Чекають уточнень')],
    ['approved', () => tr('Схвалені')],
    ['rejected', () => tr('Відхилені')],
];

/** Адмінка → «Верифікація»: заявки з доказами, рішення з причиною. */
export default function AdminVerification({
    requests,
    status,
    counts,
    verified,
}: {
    requests: Paginated<Item>;
    status: Status;
    counts: Partial<Record<Status, number>>;
    verified: number;
}) {
    return (
        <>
            <Head title={tr('Верифікація — адмінка')} />
            <PageHeader
                title={tr('Верифікація')}
                description={tr(
                    'Верифікованих сторінок: {count}. Кожне рішення — у журнал.',
                    {
                        count: verified,
                    },
                )}
            />
            <div className="mb-4 flex flex-wrap gap-2">
                {TABS.map(([value, label]) => (
                    <Link
                        key={value}
                        href={`/admin/verification?status=${value}`}
                        preserveScroll
                        className={cn(
                            'inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium transition',
                            status === value
                                ? 'bg-white/12 text-white'
                                : 'text-white/55 hover:text-white',
                        )}
                    >
                        {label()}
                        {(counts[value] ?? 0) > 0 && (
                            <span className="text-white/45 tabular-nums">
                                {counts[value]}
                            </span>
                        )}
                    </Link>
                ))}
            </div>
            {requests.data.length === 0 ? (
                <p className="glass rounded-2xl p-8 text-center text-sm text-white/50">
                    {tr('Заявок немає.')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {requests.data.map((item) => (
                        <RequestCard key={item.id} item={item} />
                    ))}
                </ul>
            )}
            <div className="mt-4">
                <Pagination data={requests} />
            </div>
        </>
    );
}

function RequestCard({ item }: { item: Item }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const open = item.status === 'pending' || item.status === 'needs_info';
    const decide = (decision: 'approve' | 'reject' | 'needs_info') =>
        router.post(
            `/admin/verification/${item.id}`,
            { decision, reason: reason.trim() || null },
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
            },
        );

    return (
        <li className="glass rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-3">
                {item.user && <UserAvatar user={item.user} size="md" />}
                <div className="min-w-0 flex-1">
                    {item.user && (
                        <Link
                            href={`/${item.user.username}`}
                            className="font-semibold text-white hover:underline"
                        >
                            {item.user.name}
                        </Link>
                    )}
                    <p className="text-xs text-white/45">
                        {[
                            item.user ? `@${item.user.username}` : null,
                            item.user?.account_label,
                            item.user?.created_at
                                ? tr('з {date}', {
                                      date: formatDate(item.user.created_at),
                                  })
                                : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-chip bg-white/[0.06] px-2.5 py-1 text-xs text-white/80">
                        <VerifiedBadge kind={item.kind} className="size-3.5" />
                        {item.kind_label}
                    </span>
                    <span className="text-xs text-white/40">
                        {timeAgo(item.created_at)}
                    </span>
                </div>
            </div>

            {item.user && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {item.user.requirements.map((r) => (
                        <span
                            key={r.key}
                            className="inline-flex items-center gap-1 text-xs text-white/60"
                        >
                            {r.ok ? (
                                <CircleCheck className="size-3.5 text-emerald-300" />
                            ) : (
                                <CircleX className="size-3.5 text-rose-300" />
                            )}
                            {r.label}
                        </span>
                    ))}
                </div>
            )}

            <ul className="mt-3 space-y-1">
                {item.links.map((link) => (
                    <li key={link}>
                        <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1.5 text-sm break-all text-gc-lilac-300 hover:underline"
                        >
                            <ExternalLink className="size-3.5 shrink-0" />
                            {link}
                        </a>
                    </li>
                ))}
            </ul>
            {item.note && (
                <p className="mt-2 text-sm whitespace-pre-line text-white/75">
                    {item.note}
                </p>
            )}
            {item.has_document && (
                <a
                    href={`/admin/verification/${item.id}/document`}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
                >
                    <FileText className="size-4" />
                    {tr('Документ (видалиться після рішення)')}
                </a>
            )}
            {item.reason && (
                <p className="mt-2 text-sm text-white/60">
                    <span className="text-white/40">{tr('Причина:')}</span>{' '}
                    {item.reason}
                </p>
            )}
            {item.decided_at && (
                <p className="mt-1 text-xs text-white/40">
                    {formatDate(item.decided_at)}
                    {item.reviewer && ` · ${item.reviewer}`}
                </p>
            )}

            {open && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={tr('Причина (для відмови чи уточнення)')}
                        maxLength={500}
                        className="input-glass h-10 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30"
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide('approve')}
                            className="btn-glow h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Схвалити')}
                        </button>
                        <button
                            type="button"
                            disabled={busy || !reason.trim()}
                            onClick={() => decide('needs_info')}
                            className="h-10 rounded-xl bg-white/[0.07] px-4 text-sm font-medium text-white transition hover:bg-white/[0.11] disabled:opacity-50"
                        >
                            {tr('Уточнити')}
                        </button>
                        <button
                            type="button"
                            disabled={busy || !reason.trim()}
                            onClick={() => decide('reject')}
                            className="h-10 rounded-xl bg-rose-500/15 px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
                        >
                            {tr('Відхилити')}
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
}
