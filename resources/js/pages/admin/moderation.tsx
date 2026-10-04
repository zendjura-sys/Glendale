import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Ban,
    Check,
    Flag,
    MessageSquareWarning,
    Trash2,
    VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Report = {
    id: number;
    count: number;
    reasons: string[];
    comments: string[];
    reporters: string[];
    created_at: string;
    message: {
        id: number;
        body: string | null;
        type: string;
        deleted: boolean;
        created_at: string | null;
        author: UserCard | null;
        chat: string;
    } | null;
};

type Settings = {
    profanity: 'mask' | 'block' | 'off';
    extra_words: string[];
    flood_limit: number;
    repeat_limit: number;
    new_account_link_hours: number;
};

type Props = {
    reports: Report[];
    muted: (UserCard & { muted_until: string; mute_reason: string | null })[];
    settings: Settings;
    mute_hours: number[];
    stats: { pending: number; resolved_week: number };
};

const PROFANITY = {
    mask: 'Замінювати зірочками',
    block: 'Не пропускати',
    off: 'Вимкнено',
} as const;

const hoursLabel = (h: number) =>
    h < 24 ? `${h} год` : h % 24 === 0 ? `${h / 24} дн` : `${h} год`;

const kyiv = (iso: string) =>
    new Date(iso).toLocaleString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

/** Адмінка → Модерація: скарги на повідомлення, заглушені, автомодерація. */
export default function AdminModeration({
    reports,
    muted,
    settings,
    mute_hours,
    stats,
}: Props) {
    const form = useForm({
        ...settings,
        extra_words: settings.extra_words.join('\n'),
    });
    const [hours, setHours] = useState<Record<number, number>>({});

    const resolve = (report: Report, action: 'delete' | 'mute' | 'dismiss') =>
        router.post(
            `/admin/moderation/reports/${report.id}`,
            {
                action,
                hours: action === 'mute' ? (hours[report.id] ?? 24) : null,
            },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title="Модерація — адмінка" />
            <PageHeader
                title="Модерація"
                description="Скарги на повідомлення в чатах, заглушені користувачі й автоматичний фільтр мату та спаму."
            />

            <div className="mb-6 grid grid-cols-2 gap-3">
                <StatCard
                    label="Скарг на розгляді"
                    value={stats.pending}
                    icon={Flag}
                />
                <StatCard
                    label="Розглянуто за тиждень"
                    value={stats.resolved_week}
                    icon={Check}
                    delay={50}
                />
            </div>

            <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
                <h2 className="mb-3 font-display text-lg font-semibold text-white">
                    Скарги
                </h2>
                {reports.length === 0 ? (
                    <p className="text-sm text-white/45">Нових скарг немає.</p>
                ) : (
                    <div className="space-y-3">
                        {reports.map((r) => (
                            <article
                                key={r.id}
                                className="rounded-2xl bg-white/[0.03] p-3"
                            >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                                    <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-rose-200">
                                        {r.count}{' '}
                                        {r.count === 1 ? 'скарга' : 'скарг'}
                                    </span>
                                    {r.reasons.map((reason) => (
                                        <span
                                            key={reason}
                                            className="rounded-md bg-white/[0.06] px-2 py-0.5"
                                        >
                                            {reason}
                                        </span>
                                    ))}
                                    <span>· {r.message?.chat}</span>
                                    <span className="ml-auto">
                                        {timeAgo(r.created_at)}
                                    </span>
                                </div>
                                {r.message && (
                                    <div className="mt-2 flex items-start gap-2.5">
                                        {r.message.author && (
                                            <Link
                                                href={`/${r.message.author.username}`}
                                            >
                                                <UserAvatar
                                                    user={r.message.author}
                                                    size="sm"
                                                />
                                            </Link>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white">
                                                {r.message.author?.name ??
                                                    'Видалений користувач'}
                                            </p>
                                            <p
                                                className={cn(
                                                    'text-sm whitespace-pre-line',
                                                    r.message.deleted
                                                        ? 'text-white/35 line-through'
                                                        : 'text-white/80',
                                                )}
                                            >
                                                {r.message.body ??
                                                    `[${r.message.type}]`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {r.comments.length > 0 && (
                                    <p className="mt-2 text-xs text-white/50">
                                        Коментарі: {r.comments.join(' · ')}
                                    </p>
                                )}
                                <p className="mt-1 text-[11px] text-white/35">
                                    Поскаржилися: {r.reporters.join(', ')}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => resolve(r, 'delete')}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 text-sm text-rose-200 hover:bg-rose-500/25"
                                    >
                                        <Trash2 className="size-4" /> Видалити
                                    </button>
                                    <span className="inline-flex items-center gap-1">
                                        <select
                                            value={hours[r.id] ?? 24}
                                            onChange={(e) =>
                                                setHours({
                                                    ...hours,
                                                    [r.id]: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                            className="input-glass h-9 rounded-xl px-2 text-sm text-white"
                                            aria-label="На скільки заглушити"
                                        >
                                            {mute_hours.map((h) => (
                                                <option key={h} value={h}>
                                                    {hoursLabel(h)}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => resolve(r, 'mute')}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 text-sm text-amber-200 hover:bg-amber-500/25"
                                        >
                                            <VolumeX className="size-4" />{' '}
                                            Видалити й заглушити
                                        </button>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => resolve(r, 'dismiss')}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/55 hover:bg-white/[0.06] hover:text-white"
                                    >
                                        <Ban className="size-4" /> Відхилити
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {muted.length > 0 && (
                <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
                    <h2 className="mb-3 font-display text-lg font-semibold text-white">
                        Заглушені
                    </h2>
                    <div className="divide-y divide-white/[0.05]">
                        {muted.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 py-2"
                            >
                                <UserAvatar user={u} size="sm" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-white">
                                        {u.name}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        до {kyiv(u.muted_until)}
                                        {u.mute_reason && ` · ${u.mute_reason}`}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/admin/moderation/users/${u.id}/unmute`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="text-sm text-[#a5b4fc] hover:text-white"
                                >
                                    Зняти мут
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="glass rounded-3xl p-4 sm:p-5">
                <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <MessageSquareWarning className="size-5 text-[#a5b4fc]" />
                    Автомодерація
                </h2>
                <p className="mb-4 text-sm text-white/50">
                    Мат у повідомленнях, записах і коментарях; спам і флуд у
                    чатах; посилання від щойно зареєстрованих.
                </p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put('/admin/moderation/settings', {
                            preserveScroll: true,
                        });
                    }}
                    className="grid gap-3 sm:grid-cols-2"
                >
                    <label className="block">
                        <span className="mb-1 block text-xs text-white/50">
                            Мат
                        </span>
                        <select
                            value={form.data.profanity}
                            onChange={(e) =>
                                form.setData(
                                    'profanity',
                                    e.target.value as Settings['profanity'],
                                )
                            }
                            className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white"
                        >
                            {Object.entries(PROFANITY).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-white/50">
                            Повідомлень за хвилину (0 — без обмеження)
                        </span>
                        <input
                            type="number"
                            min={0}
                            max={200}
                            value={form.data.flood_limit}
                            onChange={(e) =>
                                form.setData(
                                    'flood_limit',
                                    Number(e.target.value),
                                )
                            }
                            className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-white/50">
                            Однакових повідомлень поспіль (0 — вимкнено)
                        </span>
                        <input
                            type="number"
                            min={0}
                            max={50}
                            value={form.data.repeat_limit}
                            onChange={(e) =>
                                form.setData(
                                    'repeat_limit',
                                    Number(e.target.value),
                                )
                            }
                            className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-white/50">
                            Посилання — через стільки годин після реєстрації (0
                            — одразу)
                        </span>
                        <input
                            type="number"
                            min={0}
                            max={720}
                            value={form.data.new_account_link_hours}
                            onChange={(e) =>
                                form.setData(
                                    'new_account_link_hours',
                                    Number(e.target.value),
                                )
                            }
                            className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white"
                        />
                    </label>
                    <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs text-white/50">
                            Додаткові заборонені слова (по одному в рядку)
                        </span>
                        <textarea
                            value={form.data.extra_words}
                            onChange={(e) =>
                                form.setData('extra_words', e.target.value)
                            }
                            rows={4}
                            className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="btn-glow h-10 rounded-xl text-sm font-semibold disabled:opacity-50 sm:col-span-2"
                    >
                        Зберегти
                    </button>
                </form>
            </section>
        </>
    );
}
