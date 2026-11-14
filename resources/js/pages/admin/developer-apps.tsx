import { Head, Link, router } from '@inertiajs/react';
import { AppWindow, Ban, CheckCircle2 } from 'lucide-react';
import { PageHeader, Pagination } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { Paginated } from '@/types';

type Item = {
    id: number;
    name: string;
    website: string | null;
    client_id: string;
    owner: { name: string; username: string };
    scopes: string[];
    users: number;
    last_used_at: string | null;
    blocked: boolean;
    blocked_reason: string | null;
    created_at: string | null;
};

/** Адмінка → Застосунки розробників: хто створив, скільки людей підключили, блокування (у журналі). */
export default function DeveloperApps({ apps }: { apps: Paginated<Item> }) {
    const toggle = (app: Item) => {
        const reason = app.blocked
            ? null
            : prompt(tr('Причина блокування (побачить розробник)'));
        if (!app.blocked && reason === null) return;
        router.post(
            `/admin/developer-apps/${app.id}/block`,
            { blocked: !app.blocked, reason },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={tr('Застосунки розробників — Адмін-панель')} />
            <PageHeader
                title={tr('Застосунки розробників')}
                description={tr(
                    'OAuth-застосунки й боти з /developers. Блокування одразу відкликає всі токени застосунку.',
                )}
            />
            {apps.data.length === 0 ? (
                <EmptyState
                    icon={AppWindow}
                    title={tr('Застосунків ще немає')}
                />
            ) : (
                <ul className="gc-solid divide-y divide-white/[0.06] rounded-2xl">
                    {apps.data.map((app) => (
                        <li
                            key={app.id}
                            className="flex flex-wrap items-center gap-3 p-4"
                        >
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                                <AppWindow className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">
                                    {app.name}
                                    <span className="ml-2 font-mono text-xs font-normal text-white/40">
                                        {app.client_id}
                                    </span>
                                </p>
                                <p className="text-xs text-white/50">
                                    <Link
                                        href={`/u/${app.owner.username}`}
                                        className="hover:underline"
                                    >
                                        {app.owner.name}
                                    </Link>
                                    {' · '}
                                    {tr('{n} людей', { n: app.users })}
                                    {app.last_used_at &&
                                        ` · ${tr('останній запит {t}', { t: timeAgo(app.last_used_at) })}`}
                                    {' · '}
                                    <span className="font-mono">
                                        {app.scopes.join(' ')}
                                    </span>
                                </p>
                                {app.blocked && (
                                    <p className="text-xs text-rose-300">
                                        {tr('Заблоковано')}
                                        {app.blocked_reason
                                            ? `: ${app.blocked_reason}`
                                            : ''}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => toggle(app)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/75 hover:bg-white/[0.06]"
                            >
                                {app.blocked ? (
                                    <CheckCircle2 className="size-4 text-emerald-300" />
                                ) : (
                                    <Ban className="size-4 text-rose-300" />
                                )}
                                {app.blocked
                                    ? tr('Розблокувати')
                                    : tr('Заблокувати')}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <Pagination data={apps} />
        </>
    );
}
