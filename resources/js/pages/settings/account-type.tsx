import { Head, Link, router, useForm } from '@inertiajs/react';
import { BadgeCheck, CircleCheck, CircleX, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { ACCOUNT_ICONS } from '@/components/profile/account-card';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { SettingsCard } from '@/layouts/settings/layout';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type AccountType = {
    key: string;
    label: string;
    icon: string;
    fields: Record<string, string>;
    roster: boolean;
};

type Linked = UserCard & {
    link_id: number;
    role: string | null;
    link_status: 'pending' | 'active';
    owner_type?: string | null;
};

type VerificationState = {
    verified: boolean;
    kind: string | null;
    verified_at: string | null;
    kinds: Record<string, string>;
    requirements: { key: string; label: string; ok: boolean }[];
    request: {
        id: number;
        kind: string;
        status: 'pending' | 'approved' | 'rejected' | 'needs_info';
        reason: string | null;
        created_at: string;
    } | null;
    retry_at: string | null;
};

const field =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

export default function AccountTypePage({
    types,
    current,
    roster,
    invitations,
    verification,
}: {
    types: AccountType[] | null;
    current: { type: string; details: Record<string, string> };
    roster: Linked[] | null;
    invitations: Linked[];
    verification: VerificationState | null;
}) {
    const form = useForm({ type: current.type, details: current.details });
    const selected = types?.find((t) => t.key === form.data.type);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/settings/account-type', { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Тип акаунта')} />
            <div className="space-y-7">
                {invitations.length > 0 && (
                    <SettingsCard
                        title={tr('Вас додали до складу')}
                        description={tr(
                            'Підтвердіть — і вас покажуть на сторінці агенції, команди чи студії.',
                        )}
                    >
                        <ul className="space-y-2">
                            {invitations.map((item) => (
                                <LinkedRow key={item.link_id} item={item}>
                                    {item.link_status === 'pending' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.post(
                                                        `/settings/account-type/links/${item.link_id}`,
                                                        { accept: true },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                className="btn-glow h-9 rounded-xl px-3.5 text-[13px] font-semibold"
                                            >
                                                {tr('Підтвердити')}
                                            </button>
                                            <IconButton
                                                label={tr('Відхилити')}
                                                onClick={() =>
                                                    router.post(
                                                        `/settings/account-type/links/${item.link_id}`,
                                                        { accept: false },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            />
                                        </>
                                    ) : (
                                        <IconButton
                                            label={tr('Вийти зі складу')}
                                            onClick={() =>
                                                router.delete(
                                                    `/settings/account-type/links/${item.link_id}`,
                                                    { preserveScroll: true },
                                                )
                                            }
                                        />
                                    )}
                                </LinkedRow>
                            ))}
                        </ul>
                    </SettingsCard>
                )}

                {types && (
                    <form onSubmit={submit}>
                        <SettingsCard
                            title={tr('Тип акаунта')}
                            description={tr(
                                'Стрімер, бізнес, агенція чи команда — свої поля на сторінці й склад.',
                            )}
                        >
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {types.map((type) => {
                                    const Icon =
                                        ACCOUNT_ICONS[type.icon] ?? UserRound;

                                    return (
                                        <button
                                            key={type.key}
                                            type="button"
                                            onClick={() =>
                                                form.setData('type', type.key)
                                            }
                                            className={cn(
                                                'flex flex-col items-start gap-2 rounded-2xl p-3 text-left text-[13px] font-medium transition',
                                                form.data.type === type.key
                                                    ? 'bg-gc-indigo/25 text-white'
                                                    : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.07]',
                                            )}
                                        >
                                            <Icon className="size-5" />
                                            {type.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {selected &&
                                Object.keys(selected.fields).length > 0 && (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        {Object.entries(selected.fields).map(
                                            ([key, label]) => (
                                                <label
                                                    key={key}
                                                    className="block text-sm text-white/70"
                                                >
                                                    {label}
                                                    <input
                                                        value={
                                                            form.data.details[
                                                                key
                                                            ] ?? ''
                                                        }
                                                        onChange={(e) =>
                                                            form.setData(
                                                                'details',
                                                                {
                                                                    ...form.data
                                                                        .details,
                                                                    [key]: e
                                                                        .target
                                                                        .value,
                                                                },
                                                            )
                                                        }
                                                        maxLength={160}
                                                        className={cn(
                                                            field,
                                                            'mt-1.5',
                                                        )}
                                                    />
                                                    {form.errors[
                                                        `details.${key}` as keyof typeof form.errors
                                                    ] && (
                                                        <span className="mt-1 block text-xs text-rose-300">
                                                            {
                                                                form.errors[
                                                                    `details.${key}` as keyof typeof form.errors
                                                                ]
                                                            }
                                                        </span>
                                                    )}
                                                </label>
                                            ),
                                        )}
                                    </div>
                                )}
                            <div className="mt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                                >
                                    {tr('Зберегти')}
                                </button>
                            </div>
                        </SettingsCard>
                    </form>
                )}

                {roster && <RosterCard roster={roster} />}
                {verification && <VerificationCard state={verification} />}
            </div>
        </>
    );
}

function LinkedRow({
    item,
    children,
}: {
    item: Linked;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
            <UserAvatar user={item} size="sm" />
            <div className="min-w-0 flex-1">
                <Link
                    href={`/${item.username}`}
                    className="block truncate text-sm font-semibold text-white hover:underline"
                >
                    {item.name}
                </Link>
                <p className="truncate text-xs text-white/45">
                    {[
                        item.owner_type,
                        item.role,
                        item.link_status === 'pending'
                            ? tr('чекає підтвердження')
                            : null,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            </div>
            {children}
        </li>
    );
}

function IconButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 transition hover:bg-rose-500/15 hover:text-rose-200"
        >
            <X className="size-4" />
        </button>
    );
}

/** Склад агенції, команди чи студії: запрошення за адресою сторінки. */
function RosterCard({ roster }: { roster: Linked[] }) {
    const invite = useForm({ username: '', role: '' });

    return (
        <SettingsCard
            title={tr('Склад')}
            description={tr(
                'Людина бачить запрошення й сама підтверджує, що вона з вами.',
            )}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    invite.post('/settings/account-type/roster', {
                        preserveScroll: true,
                        onSuccess: () => invite.reset(),
                    });
                }}
                className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
            >
                <input
                    value={invite.data.username}
                    onChange={(e) => invite.setData('username', e.target.value)}
                    placeholder={tr('@адреса сторінки')}
                    className={field}
                />
                <input
                    value={invite.data.role}
                    onChange={(e) => invite.setData('role', e.target.value)}
                    placeholder={tr('Роль')}
                    maxLength={40}
                    className={field}
                />
                <button
                    type="submit"
                    disabled={invite.processing || !invite.data.username.trim()}
                    className="btn-glow h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                >
                    {tr('Запросити')}
                </button>
            </form>
            {invite.errors.username && (
                <p className="mt-1 text-xs text-rose-300">
                    {invite.errors.username}
                </p>
            )}
            {roster.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {roster.map((item) => (
                        <LinkedRow key={item.link_id} item={item}>
                            <IconButton
                                label={tr('Прибрати зі складу')}
                                onClick={() =>
                                    router.delete(
                                        `/settings/account-type/links/${item.link_id}`,
                                        {
                                            preserveScroll: true,
                                        },
                                    )
                                }
                            />
                        </LinkedRow>
                    ))}
                </ul>
            )}
        </SettingsCard>
    );
}

const STATUS_TEXT: Record<string, () => string> = {
    pending: () => tr('Заявка на розгляді'),
    approved: () => tr('Заявку схвалено'),
    rejected: () => tr('Заявку відхилено'),
    needs_info: () => tr('Потрібні уточнення'),
};

/** Верифікація 2.0: вимоги, вид позначки, докази й стан заявки. */
function VerificationCard({ state }: { state: VerificationState }) {
    const kinds = Object.keys(state.kinds);
    const form = useForm<{
        kind: string;
        links: string[];
        note: string;
        document: File | null;
    }>({
        kind: kinds[0] ?? 'identity',
        links: [''],
        note: '',
        document: null,
    });
    const [open, setOpen] = useState(false);
    const ready = state.requirements.every((r) => r.ok);
    const pending = state.request?.status === 'pending';
    const canApply = ready && !pending && !state.retry_at && kinds.length > 0;

    return (
        <SettingsCard
            title={tr('Верифікація')}
            description={tr(
                'Позначка показує, що сторінка справжня: особа, автор, бізнес чи організація.',
            )}
        >
            {state.verified && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-sm text-white">
                    <VerifiedBadge kind={state.kind} className="size-5" />
                    {tr('Сторінку верифіковано')}
                    {state.verified_at && (
                        <span className="text-white/45">
                            · {formatDate(state.verified_at)}
                        </span>
                    )}
                </div>
            )}
            {state.request && state.request.status !== 'approved' && (
                <div className="mb-3 rounded-xl bg-white/[0.04] p-3 text-sm">
                    <p className="font-medium text-white">
                        {STATUS_TEXT[state.request.status]?.()}
                        <span className="font-normal text-white/45">
                            {' '}
                            · {formatDate(state.request.created_at)}
                        </span>
                    </p>
                    {state.request.reason && (
                        <p className="mt-1 text-white/65">
                            {state.request.reason}
                        </p>
                    )}
                    {state.retry_at && (
                        <p className="mt-1 text-xs text-white/45">
                            {tr('Нова заявка — з {date}', {
                                date: formatDate(state.retry_at),
                            })}
                        </p>
                    )}
                </div>
            )}
            <ul className="space-y-1.5">
                {state.requirements.map((r) => (
                    <li key={r.key} className="flex items-center gap-2 text-sm">
                        {r.ok ? (
                            <CircleCheck className="size-4 text-emerald-300" />
                        ) : (
                            <CircleX className="size-4 text-white/30" />
                        )}
                        <span
                            className={r.ok ? 'text-white/80' : 'text-white/50'}
                        >
                            {r.label}
                        </span>
                    </li>
                ))}
            </ul>
            {canApply && !open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="btn-glow mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                >
                    <BadgeCheck className="size-4" />
                    {state.request?.status === 'needs_info'
                        ? tr('Доповнити заявку')
                        : tr('Подати заявку')}
                </button>
            )}
            {canApply && open && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.transform((data) => ({
                            ...data,
                            links: data.links.filter((l) => l.trim() !== ''),
                        }));
                        form.post('/settings/verification', {
                            forceFormData: true,
                            preserveScroll: true,
                            onSuccess: () => setOpen(false),
                        });
                    }}
                    className="mt-4 space-y-3"
                >
                    <div className="flex flex-wrap gap-2">
                        {kinds.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => form.setData('kind', key)}
                                className={cn(
                                    'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition',
                                    form.data.kind === key
                                        ? 'bg-gc-indigo/25 text-white'
                                        : 'bg-white/[0.05] text-white/65',
                                )}
                            >
                                <VerifiedBadge
                                    kind={key}
                                    className="size-3.5"
                                />
                                {state.kinds[key]}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs text-white/45">
                            {tr(
                                'Посилання, що підтверджують вас: канал, сайт, соцмережі, статті (до 5).',
                            )}
                        </p>
                        {form.data.links.map((link, i) => (
                            <input
                                key={i}
                                type="url"
                                value={link}
                                onChange={(e) =>
                                    form.setData(
                                        'links',
                                        form.data.links.map((l, j) =>
                                            j === i ? e.target.value : l,
                                        ),
                                    )
                                }
                                placeholder="https://"
                                className={field}
                            />
                        ))}
                        {form.data.links.length < 5 && (
                            <button
                                type="button"
                                onClick={() =>
                                    form.setData('links', [
                                        ...form.data.links,
                                        '',
                                    ])
                                }
                                className="text-xs font-medium text-gc-lilac-300 hover:text-white"
                            >
                                {tr('+ ще посилання')}
                            </button>
                        )}
                    </div>
                    <textarea
                        value={form.data.note}
                        onChange={(e) => form.setData('note', e.target.value)}
                        placeholder={tr(
                            'Коротко про себе чи компанію (необовʼязково)',
                        )}
                        rows={3}
                        maxLength={1000}
                        className={cn(field, 'h-auto resize-y py-2.5')}
                    />
                    <label className="block text-xs text-white/45">
                        {tr(
                            'Документ (необовʼязково, JPG/PNG/PDF). Бачить лише команда; видаляємо одразу після рішення.',
                        )}
                        <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            onChange={(e) =>
                                form.setData(
                                    'document',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                            className="mt-1.5 block text-sm text-white/70"
                        />
                    </label>
                    {(form.errors.kind || form.errors.links) && (
                        <p className="text-xs text-rose-300">
                            {form.errors.kind ?? form.errors.links}
                        </p>
                    )}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={
                                form.processing ||
                                form.data.links.every((l) => !l.trim())
                            }
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Надіслати')}
                        </button>
                    </div>
                </form>
            )}
        </SettingsCard>
    );
}
