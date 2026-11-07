import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Crown, ExternalLink, Lock, Star } from 'lucide-react';
import { selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    ScreenshotPicker,
    StatusPill,
    Thread,
} from '@/components/support/support-ui';
import type {
    TicketCard,
    TicketMessage,
} from '@/components/support/support-ui';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Requester = {
    id: number;
    name: string;
    username: string;
    avatar_url: string | null;
    email: string;
    created_at: string | null;
    banned: boolean;
    is_plus: boolean;
    tickets: number;
};

/** Адмінка → звернення: листування, нотатки, шаблони, статус і відповідальний. */
export default function AdminSupportTicket({
    ticket,
    messages,
    requester,
    staff,
    templates,
    categories,
}: {
    ticket: TicketCard & { url: string | null; rating_comment: string | null };
    messages: TicketMessage[];
    requester: Requester;
    staff: { id: number; name: string }[];
    templates: string[];
    categories: Record<string, string>;
}) {
    const form = useForm<{
        body: string;
        internal: boolean;
        close: boolean;
        files: File[];
    }>({ body: '', internal: false, close: false, files: [] });
    const update = (data: Record<string, string | number | null>) =>
        router.patch(`/admin/support/${ticket.id}`, data, {
            preserveScroll: true,
        });
    const send = (close: boolean) => {
        form.transform((d) => ({
            ...d,
            close: close ? 1 : 0,
            internal: d.internal ? 1 : 0,
        }));
        form.post(`/admin/support/${ticket.id}/reply`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title={`#${ticket.id} · ${tr('Підтримка')}`} />
            <Link
                href="/admin/support"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
            >
                <ArrowLeft className="size-4" />
                {tr('Черга')}
            </Link>
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <div className="min-w-0 space-y-4">
                    <div className="glass rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="font-display text-lg font-semibold text-white">
                                    #{ticket.id} · {ticket.subject}
                                </h1>
                                <p className="text-xs text-white/45">
                                    {tr(ticket.category_label)} ·{' '}
                                    {formatDate(ticket.created_at)}
                                    {ticket.url && (
                                        <>
                                            {' · '}
                                            <a
                                                href={ticket.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-gc-lilac-300 hover:underline"
                                            >
                                                {tr('сторінка')}{' '}
                                                <ExternalLink className="size-3" />
                                            </a>
                                        </>
                                    )}
                                </p>
                            </div>
                            <StatusPill status={ticket.status} staff />
                        </div>
                        <div className="mt-5">
                            <Thread messages={messages} mineIsStaff />
                        </div>
                    </div>

                    <div
                        className={cn(
                            'glass space-y-3 rounded-2xl p-4',
                            form.data.internal && 'ring-1 ring-amber-300/30',
                        )}
                    >
                        <div className="scrollbar-none flex gap-2 overflow-x-auto">
                            {templates.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() =>
                                        form.setData(
                                            'body',
                                            form.data.body
                                                ? `${form.data.body}\n\n${t}`
                                                : t,
                                        )
                                    }
                                    title={t}
                                    className="h-8 max-w-56 shrink-0 truncate rounded-lg bg-white/[0.06] px-3 text-xs text-white/70 hover:text-white"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={form.data.body}
                            onChange={(e) =>
                                form.setData('body', e.target.value)
                            }
                            rows={5}
                            maxLength={5000}
                            placeholder={
                                form.data.internal
                                    ? tr(
                                          'Нотатка для колег — людина її не побачить',
                                      )
                                    : tr('Відповідь людині')
                            }
                            className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <ScreenshotPicker
                                files={form.data.files}
                                onChange={(files) =>
                                    form.setData('files', files)
                                }
                            />
                            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-sm text-white/70">
                                <input
                                    type="checkbox"
                                    checked={form.data.internal}
                                    onChange={(e) =>
                                        form.setData(
                                            'internal',
                                            e.target.checked,
                                        )
                                    }
                                    className="size-4 accent-amber-400"
                                />
                                <Lock className="size-3.5" />
                                {tr('Нотатка')}
                            </label>
                            <div className="ml-auto flex gap-2">
                                {!form.data.internal && (
                                    <button
                                        type="button"
                                        disabled={
                                            form.processing ||
                                            form.data.body.trim().length < 2
                                        }
                                        onClick={() => send(true)}
                                        className="h-10 rounded-xl bg-white/[0.07] px-4 text-sm text-white hover:bg-white/[0.11] disabled:opacity-40"
                                    >
                                        {tr('Відповісти й закрити')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={
                                        form.processing ||
                                        form.data.body.trim().length < 2
                                    }
                                    onClick={() => send(false)}
                                    className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
                                >
                                    {form.data.internal
                                        ? tr('Додати нотатку')
                                        : tr('Відповісти')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className="glass rounded-2xl p-4">
                        <Link
                            href={`/${requester.username}`}
                            className="flex items-center gap-3"
                        >
                            <UserAvatar
                                user={requester}
                                size="md"
                                showOnline={false}
                            />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                                    {requester.name}
                                    {requester.is_plus && (
                                        <Crown className="size-3.5 text-amber-300" />
                                    )}
                                </span>
                                <span className="block truncate text-xs text-white/45">
                                    @{requester.username}
                                </span>
                            </span>
                        </Link>
                        <dl className="mt-3 space-y-1.5 text-xs">
                            <div className="flex justify-between gap-2">
                                <dt className="text-white/45">Email</dt>
                                <dd className="truncate text-white/80">
                                    {requester.email}
                                </dd>
                            </div>
                            {requester.created_at && (
                                <div className="flex justify-between gap-2">
                                    <dt className="text-white/45">
                                        {tr('З нами з')}
                                    </dt>
                                    <dd className="text-white/80">
                                        {formatDate(
                                            requester.created_at,
                                            false,
                                        )}
                                    </dd>
                                </div>
                            )}
                            <div className="flex justify-between gap-2">
                                <dt className="text-white/45">
                                    {tr('Звернень')}
                                </dt>
                                <dd className="text-white/80">
                                    {requester.tickets}
                                </dd>
                            </div>
                            {requester.banned && (
                                <p className="text-red-300">
                                    {tr('Заблоковано')}
                                </p>
                            )}
                        </dl>
                    </div>
                    <div className="glass space-y-3 rounded-2xl p-4 text-sm">
                        <label className="block">
                            <span className="mb-1 block text-xs text-white/45">
                                {tr('Статус')}
                            </span>
                            <select
                                value={ticket.status}
                                onChange={(e) =>
                                    update({ status: e.target.value })
                                }
                                className={cn(selectClass, 'w-full')}
                            >
                                <option value="open">
                                    {tr('Чекає на нас')}
                                </option>
                                <option value="answered">
                                    {tr('Чекає людину')}
                                </option>
                                <option value="closed">{tr('Закрито')}</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-white/45">
                                {tr('Пріоритет')}
                            </span>
                            <select
                                value={ticket.priority}
                                onChange={(e) =>
                                    update({ priority: e.target.value })
                                }
                                className={cn(selectClass, 'w-full')}
                            >
                                <option value="urgent">
                                    {tr('Терміново')}
                                </option>
                                <option value="high">{tr('Високий')}</option>
                                <option value="normal">
                                    {tr('Звичайний')}
                                </option>
                                <option value="low">{tr('Низький')}</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-white/45">
                                {tr('Тема')}
                            </span>
                            <select
                                value={ticket.category}
                                onChange={(e) =>
                                    update({ category: e.target.value })
                                }
                                className={cn(selectClass, 'w-full')}
                            >
                                {Object.entries(categories).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {tr(v)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-white/45">
                                {tr('Відповідальний')}
                            </span>
                            <select
                                value={ticket.assignee?.id ?? ''}
                                onChange={(e) =>
                                    update({
                                        assignee_id: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    })
                                }
                                className={cn(selectClass, 'w-full')}
                            >
                                <option value="">{tr('Ніхто')}</option>
                                {staff.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {ticket.rating && (
                        <div className="glass rounded-2xl p-4 text-sm">
                            <p className="flex items-center gap-1 text-amber-200">
                                {Array.from(
                                    { length: ticket.rating },
                                    (_, i) => (
                                        <Star
                                            key={i}
                                            className="size-4 fill-current"
                                        />
                                    ),
                                )}
                            </p>
                            {ticket.rating_comment && (
                                <p className="mt-2 text-white/70">
                                    {ticket.rating_comment}
                                </p>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </>
    );
}
