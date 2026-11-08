import { Head, router } from '@inertiajs/react';
import {
    Archive,
    Bug,
    Check,
    DatabaseBackup,
    Download,
    ListChecks,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { formatBytes, formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Backup = { name: string; size: number; created_at: string };
type FailedJob = {
    uuid: string;
    queue: string;
    job: string;
    error: string;
    failed_at: string;
};
type Queue = {
    pending: number;
    oldest: number | null;
    failed_total: number;
    failed: FailedJob[];
};
type ErrorRow = {
    id: number;
    class: string;
    message: string;
    file: string | null;
    line: number | null;
    url: string | null;
    method: string | null;
    count: number;
    first_seen_at: string;
    last_seen_at: string;
    resolved: boolean;
};

/** Адмінка → Система: резервні копії бази й журнал помилок. */
export default function AdminSystem({
    backups,
    backup_stale,
    errors,
    queue,
    show,
    stats,
}: {
    backups: Backup[];
    backup_stale: boolean;
    errors: ErrorRow[];
    queue: Queue;
    show: 'open' | 'resolved';
    stats: { open: number; today: number };
}) {
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState<number | null>(null);

    const backup = () => {
        setBusy(true);
        router.post(
            '/admin/system/backups',
            {},
            { preserveScroll: true, onFinish: () => setBusy(false) },
        );
    };

    return (
        <>
            <Head title={tr('Система — Адмін-панель')} />
            <PageHeader
                title={tr('Система')}
                description={tr(
                    'Резервні копії бази (щодня о 04:10, зберігаються останні 14), черга фонових задач і журнал помилок сервера.',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatCard
                    label={tr('Відкритих помилок')}
                    value={stats.open}
                    icon={Bug}
                />
                <StatCard
                    label={tr('Помилок сьогодні')}
                    value={stats.today}
                    icon={Bug}
                    delay={50}
                />
                <StatCard
                    label={tr('Резервних копій')}
                    value={backups.length}
                    icon={Archive}
                    delay={100}
                />
            </div>

            <section className="gc-solid mb-5 rounded-2xl p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="flex-1 font-semibold text-white">
                        {tr('Резервні копії')}
                    </h2>
                    <button
                        type="button"
                        onClick={backup}
                        disabled={busy}
                        className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        <DatabaseBackup className="size-4" />
                        {busy ? tr('Створюється…') : tr('Створити зараз')}
                    </button>
                </div>
                {backup_stale && (
                    <p className="mb-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                        {tr(
                            'Остання копія старша за дві доби. Перевірте, що на сервері працює планувальник (schedule:run).',
                        )}
                    </p>
                )}
                {backups.length === 0 ? (
                    <p className="text-sm text-white/45">
                        {tr('Копій ще немає.')}
                    </p>
                ) : (
                    <ul className="divide-y divide-white/[0.06]">
                        {backups.map((b) => (
                            <li
                                key={b.name}
                                className="flex items-center gap-3 py-2 text-sm"
                            >
                                <span className="min-w-0 flex-1 truncate text-white/85">
                                    {b.name}
                                </span>
                                <span className="text-xs text-white/45">
                                    {formatBytes(b.size)} ·{' '}
                                    {formatDate(b.created_at)}
                                </span>
                                <a
                                    href={`/admin/system/backups/${b.name}`}
                                    className="rounded-lg p-1.5 text-white/60 hover:bg-[var(--gc-l3)] hover:text-white"
                                    aria-label={tr('Завантажити')}
                                >
                                    <Download className="size-4" />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="gc-solid mb-5 rounded-2xl p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="flex flex-1 items-center gap-2 font-semibold text-white">
                        <ListChecks className="size-4 text-sky-400" />
                        {tr('Черга задач')}
                    </h2>
                    {queue.failed_total > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        '/admin/system/jobs/all/retry',
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                                className="flex h-9 items-center gap-2 rounded-xl bg-[var(--gc-l2)] px-3 text-sm font-semibold text-white hover:bg-[var(--gc-l3)]"
                            >
                                <RotateCcw className="size-4" />
                                {tr('Повторити всі')}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    router.delete('/admin/system/jobs/all', {
                                        preserveScroll: true,
                                    })
                                }
                                className="flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-white/60 hover:bg-[var(--gc-l3)] hover:text-white"
                            >
                                <Trash2 className="size-4" />
                                {tr('Очистити')}
                            </button>
                        </>
                    )}
                </div>
                <p className="mb-3 text-sm text-white/60 tabular-nums">
                    {tr('Чекають: {n}', { n: queue.pending })}
                    {queue.oldest !== null &&
                        queue.pending > 0 &&
                        ' · ' +
                            tr('найстаріша — {ago}', {
                                ago: timeAgo(
                                    new Date(queue.oldest * 1000).toISOString(),
                                ),
                            })}
                    {' · '}
                    {tr('Впали: {n}', { n: queue.failed_total })}
                </p>
                {queue.pending > 100 && (
                    <p className="mb-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                        {tr(
                            'У черзі понад 100 задач. Перевірте, що на сервері працює обробник черги (queue:work).',
                        )}
                    </p>
                )}
                {queue.failed.length === 0 ? (
                    <p className="text-sm text-white/45">
                        {tr('Задач, що впали, немає.')}
                    </p>
                ) : (
                    <ul className="divide-y divide-white/[0.06]">
                        {queue.failed.map((j) => (
                            <li
                                key={j.uuid}
                                className="flex items-start gap-3 py-2 text-sm"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium break-words text-white/85">
                                        {j.job || tr('Задача')}{' '}
                                        <span className="text-xs text-white/40">
                                            {j.queue} · {timeAgo(j.failed_at)}
                                        </span>
                                    </span>
                                    <span className="block text-xs break-words text-red-300/80">
                                        {j.error}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/admin/system/jobs/${j.uuid}/retry`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="rounded-lg p-1.5 text-white/60 hover:bg-[var(--gc-l3)] hover:text-white"
                                    aria-label={tr('Повторити')}
                                >
                                    <RotateCcw className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.delete(
                                            `/admin/system/jobs/${j.uuid}`,
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="rounded-lg p-1.5 text-white/60 hover:bg-[var(--gc-l3)] hover:text-white"
                                    aria-label={tr('Прибрати')}
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="gc-solid rounded-2xl p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="flex-1 font-semibold text-white">
                        {tr('Журнал помилок')}
                    </h2>
                    {(['open', 'resolved'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() =>
                                router.get(
                                    '/admin/system',
                                    tab === 'open' ? {} : { show: tab },
                                    { preserveScroll: true },
                                )
                            }
                            className={cn(
                                'h-9 rounded-xl px-3 text-sm',
                                show === tab
                                    ? 'bg-primary text-white'
                                    : 'gc-solid-2 text-white/70 hover:text-white',
                            )}
                        >
                            {tab === 'open' ? tr('Відкриті') : tr('Вирішені')}
                        </button>
                    ))}
                    {show === 'resolved' && errors.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                confirm(
                                    tr('Прибрати вирішені помилки з журналу?'),
                                ) &&
                                router.delete('/admin/system/errors', {
                                    preserveScroll: true,
                                })
                            }
                            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/60 hover:text-red-400"
                        >
                            <Trash2 className="size-4" />
                            {tr('Очистити')}
                        </button>
                    )}
                </div>
                {errors.length === 0 ? (
                    <p className="text-sm text-white/45">
                        {show === 'open'
                            ? tr('Помилок немає — усе працює.')
                            : tr('Вирішених помилок немає.')}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {errors.map((e) => (
                            <li
                                key={e.id}
                                className="gc-solid-2 rounded-xl p-3"
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setOpen(open === e.id ? null : e.id)
                                    }
                                    className="flex w-full items-start gap-3 text-left"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-mono text-xs text-sky-400">
                                            {e.class}
                                        </span>
                                        <span className="mt-0.5 line-clamp-2 block text-sm text-white/85">
                                            {e.message || tr('(без тексту)')}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right text-xs text-white/45">
                                        <span className="block font-semibold text-white/80 tabular-nums">
                                            ×{e.count}
                                        </span>
                                        {timeAgo(e.last_seen_at)}
                                    </span>
                                </button>
                                {open === e.id && (
                                    <div className="mt-3 space-y-1 pt-3 font-mono text-xs text-white/60">
                                        <p>
                                            {e.file}:{e.line}
                                        </p>
                                        <p>
                                            {e.method} {e.url}
                                        </p>
                                        <p>
                                            {tr('Уперше: {first}', {
                                                first: formatDate(
                                                    e.first_seen_at,
                                                ),
                                            })}
                                        </p>
                                        {!e.resolved && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.post(
                                                        `/admin/system/errors/${e.id}/resolve`,
                                                        {},
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 font-sans text-white hover:bg-white/[0.12]"
                                            >
                                                <Check className="size-3.5" />
                                                {tr('Вирішено')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
