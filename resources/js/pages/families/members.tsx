import { router, useForm } from '@inertiajs/react';
import {
    Check,
    Crown,
    KeyRound,
    Search,
    Settings2,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Modal,
    Panel,
    RankBadge,
    Segmented,
    btnDanger,
    btnGhost,
    btnPrimary,
    btnSuccess,
} from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Field, inputClass } from '@/components/servers/server-form';
import { lastSeen, timeAgo } from '@/lib/format';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyShellProps, MemberCard } from '@/types';

type Member = MemberCard & {
    joined_at: string | null;
    is_owner: boolean;
    balance: number | null;
    warns: number;
    manageable: boolean;
    last_seen_at: string | null;
};

type Application = MemberCard & { note: string | null; applied_at: string };

type Props = FamilyShellProps & {
    tab: 'members' | 'applications';
    members: Member[];
    applications: Application[];
    permissions: Record<string, string>;
    matrix: Record<string, number[]>;
    warn_limit: number;
};

export default function FamilyMembers(props: Props) {
    const {
        family,
        me,
        can,
        tab,
        members,
        applications,
        permissions,
        matrix,
        warn_limit,
    } = props;
    const base = `/f/${family.slug}`;
    const [q, setQ] = useState('');
    const [editing, setEditing] = useState<Member | null>(null);
    const [ranksOpen, setRanksOpen] = useState(false);

    const filtered = useMemo(
        () =>
            members.filter((m) =>
                `${m.display} ${m.duties ?? ''}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
            ),
        [members, q],
    );

    const switchTab = (value: Props['tab']) =>
        router.get(
            `${base}/members`,
            { tab: value === 'members' ? undefined : value },
            { preserveScroll: true, preserveState: true, replace: true },
        );

    return (
        <FamilyShell {...props} title="Учасники">
            <div className="flex flex-wrap items-center gap-2">
                {can['members.manage'] && (
                    <Segmented
                        value={tab}
                        onChange={switchTab}
                        options={[
                            {
                                value: 'members',
                                label: `Учасники · ${members.length}`,
                            },
                            {
                                value: 'applications',
                                label: 'Заявки',
                                badge: applications.length,
                            },
                        ]}
                    />
                )}
                {tab === 'members' && (
                    <label className="input-glass flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3 sm:max-w-xs">
                        <Search className="size-4 text-white/35" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Нік, ID або обов’язки"
                            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                    </label>
                )}
                {can['ranks.manage'] && (
                    <button
                        type="button"
                        onClick={() => setRanksOpen(true)}
                        className={cn(btnGhost, 'ml-auto')}
                    >
                        <KeyRound className="size-4" /> Ранги й права
                    </button>
                )}
            </div>

            {tab === 'applications' ? (
                <Panel title="Заявки на вступ" icon={UserCheck}>
                    {applications.length === 0 ? (
                        <Empty icon={UserCheck} text="Нових заявок немає" />
                    ) : (
                        <div className="space-y-2">
                            {applications.map((a) => (
                                <div
                                    key={a.id}
                                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]"
                                >
                                    <UserAvatar
                                        user={{
                                            name: a.nickname,
                                            avatar_url: a.avatar_url,
                                        }}
                                        size="md"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-sm font-semibold text-white">
                                            {a.display}
                                        </div>
                                        <div className="text-xs text-white/40">
                                            {a.username && (
                                                <a
                                                    href={`/${a.username}`}
                                                    className="hover:underline"
                                                >
                                                    @{a.username}
                                                </a>
                                            )}{' '}
                                            · {timeAgo(a.applied_at)}
                                        </div>
                                        {a.note && (
                                            <p className="mt-1 text-sm text-white/65">
                                                {a.note}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post(
                                                `${base}/members/${a.id}/accept`,
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                        className={btnSuccess}
                                    >
                                        <Check className="size-4" /> Прийняти
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const reason = prompt(
                                                'Причина відмови (необов’язково)',
                                            );
                                            if (reason !== null) {
                                                router.post(
                                                    `${base}/members/${a.id}/decline`,
                                                    { reason },
                                                    { preserveScroll: true },
                                                );
                                            }
                                        }}
                                        className={btnDanger}
                                    >
                                        <X className="size-4" /> Відхилити
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            ) : (
                <Panel padded={false} className="overflow-hidden">
                    {filtered.length === 0 ? (
                        <Empty icon={Users} text="Нікого не знайдено" />
                    ) : (
                        <ul className="divide-y divide-white/[0.05]">
                            {filtered.map((m) => (
                                <li
                                    key={m.id}
                                    className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
                                >
                                    <UserAvatar
                                        user={{
                                            name: m.nickname,
                                            avatar_url: m.avatar_url,
                                            is_online: m.is_online,
                                        }}
                                        size="md"
                                        showOnline
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-sm font-semibold text-white">
                                                {m.display}
                                            </span>
                                            {m.is_owner && (
                                                <Crown className="size-4 text-amber-300" />
                                            )}
                                            <RankBadge
                                                rank={m.rank}
                                                title={m.rank_title}
                                            />
                                            {m.warns > 0 && (
                                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200">
                                                    ⚠ {m.warns}/{warn_limit}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 truncate text-xs text-white/40">
                                            {m.duties && (
                                                <span className="text-[#c4b5fd]">
                                                    {m.duties} ·{' '}
                                                </span>
                                            )}
                                            {m.is_online
                                                ? 'онлайн'
                                                : lastSeen(m.last_seen_at)}
                                            {m.joined_at &&
                                                ` · у сім’ї ${timeAgo(m.joined_at).replace(' тому', '')}`}
                                        </div>
                                    </div>
                                    {m.balance !== null && (
                                        <span
                                            className={cn(
                                                'text-sm font-semibold whitespace-nowrap',
                                                m.balance < 0
                                                    ? 'text-rose-300'
                                                    : 'text-emerald-300',
                                            )}
                                        >
                                            {uah(m.balance)}
                                        </span>
                                    )}
                                    {(m.manageable ||
                                        (can.owner && m.id !== me.id) ||
                                        (m.id === me.id &&
                                            (can['ranks.manage'] ||
                                                can['members.manage']))) && (
                                        <button
                                            type="button"
                                            onClick={() => setEditing(m)}
                                            className="flex size-9 items-center justify-center rounded-xl text-white/50 hover:bg-white/[0.06] hover:text-white"
                                            aria-label="Керувати"
                                        >
                                            <Settings2 className="size-4" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            )}

            {editing && (
                <MemberDialog
                    key={editing.id}
                    base={base}
                    member={editing}
                    meRank={me.rank}
                    isSelf={editing.id === me.id}
                    can={can}
                    titles={family.rank_titles}
                    onClose={() => setEditing(null)}
                />
            )}
            {ranksOpen && (
                <RanksDialog
                    action={`${base}/ranks`}
                    titles={family.rank_titles}
                    permissions={permissions}
                    matrix={matrix}
                    maxRank={can.owner ? 9 : me.rank - 1}
                    onClose={() => setRanksOpen(false)}
                />
            )}
        </FamilyShell>
    );
}

function MemberDialog({
    base,
    member,
    meRank,
    isSelf,
    can,
    titles,
    onClose,
}: {
    base: string;
    member: Member;
    meRank: number;
    isSelf: boolean;
    can: FamilyShellProps['can'];
    titles: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm({
        rank: member.rank,
        duties: member.duties ?? '',
        rp_nickname: member.nickname,
        static_id: member.static_id,
    });
    const [kickReason, setKickReason] = useState('');
    const maxRank = Math.min(9, can.owner ? 9 : meRank - 1);
    const manage = member.manageable;
    const url = `${base}/members/${member.id}`;

    const save = (fields: (keyof typeof form.data)[]) => {
        form.transform(
            (d) =>
                Object.fromEntries(
                    fields.map((f) => [f, d[f]]),
                ) as typeof form.data,
        );
        form.patch(url, { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={member.display}
            description={`Ранг ${member.rank} · ${member.rank_title ?? ''}`}
            wide
        >
            {manage && !member.is_owner && (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Field label="Ранг" error={form.errors.rank}>
                        <select
                            value={form.data.rank}
                            onChange={(e) =>
                                form.setData('rank', Number(e.target.value))
                            }
                            className={cn(selectClass, 'h-11 w-full')}
                        >
                            {Array.from(
                                { length: maxRank },
                                (_, i) => i + 1,
                            ).map((r) => (
                                <option key={r} value={r}>
                                    {r} — {titles[r]}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() => save(['rank'])}
                            className={cn(btnPrimary, 'h-11')}
                        >
                            Змінити ранг
                        </button>
                    </div>
                </div>
            )}

            {member.rank === 9 &&
                (manage || (isSelf && can['ranks.manage'])) && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <Field
                            label="Обов’язки"
                            hint="Напр. «Казначей», «Відповідальний за склад»"
                            error={form.errors.duties}
                        >
                            <input
                                value={form.data.duties}
                                onChange={(e) =>
                                    form.setData('duties', e.target.value)
                                }
                                maxLength={160}
                                className={inputClass}
                            />
                        </Field>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={() => save(['duties'])}
                                className={cn(btnGhost, 'h-11')}
                            >
                                Зберегти
                            </button>
                        </div>
                    </div>
                )}

            {can['members.manage'] && (manage || isSelf) && (
                <div className="grid gap-3 rounded-2xl bg-white/[0.03] p-3 sm:grid-cols-[1fr_140px_auto]">
                    <Field label="RP-нікнейм" error={form.errors.rp_nickname}>
                        <input
                            value={form.data.rp_nickname}
                            onChange={(e) =>
                                form.setData('rp_nickname', e.target.value)
                            }
                            className={cn(inputClass, 'font-mono')}
                        />
                    </Field>
                    <Field label="Static ID" error={form.errors.static_id}>
                        <input
                            value={form.data.static_id}
                            onChange={(e) =>
                                form.setData(
                                    'static_id',
                                    e.target.value.replace(/\D/g, ''),
                                )
                            }
                            className={cn(inputClass, 'font-mono')}
                        />
                    </Field>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() => save(['rp_nickname', 'static_id'])}
                            className={cn(btnGhost, 'h-11')}
                        >
                            Оновити
                        </button>
                    </div>
                </div>
            )}

            {manage && !member.is_owner && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.05] p-3">
                    <div className="mb-2 text-sm font-semibold text-rose-100">
                        Виключити з сім’ї
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={kickReason}
                            onChange={(e) => setKickReason(e.target.value)}
                            placeholder="Причина (обов’язково)"
                            className={cn(inputClass, 'h-10')}
                        />
                        <button
                            type="button"
                            disabled={kickReason.trim().length < 3}
                            onClick={() =>
                                router.post(
                                    `${url}/kick`,
                                    { reason: kickReason },
                                    {
                                        preserveScroll: true,
                                        onSuccess: onClose,
                                    },
                                )
                            }
                            className={btnDanger}
                        >
                            Виключити
                        </button>
                    </div>
                </div>
            )}

            {can.owner && !isSelf && (
                <button
                    type="button"
                    onClick={() =>
                        confirm(
                            `Передати лідерство ${member.display}? Ви станете заступником (ранг 9).`,
                        ) &&
                        router.post(
                            `${url}/transfer`,
                            {},
                            { preserveScroll: true, onSuccess: onClose },
                        )
                    }
                    className={cn(btnGhost, 'w-full text-amber-200')}
                >
                    <Crown className="size-4" /> Передати лідерство
                </button>
            )}
        </Modal>
    );
}

function RanksDialog({
    action,
    titles,
    permissions,
    matrix,
    maxRank,
    onClose,
}: {
    action: string;
    titles: Record<string, string>;
    permissions: Record<string, string>;
    matrix: Record<string, number[]>;
    maxRank: number;
    onClose: () => void;
}) {
    const form = useForm({
        titles: Array.from({ length: 10 }, (_, i) => titles[i + 1] ?? ''),
        matrix,
    });
    const ranks = Array.from({ length: 9 }, (_, i) => i + 1);

    const toggle = (perm: string, rank: number) => {
        const current = form.data.matrix[perm] ?? [];
        form.setData('matrix', {
            ...form.data.matrix,
            [perm]: current.includes(rank)
                ? current.filter((r) => r !== rank)
                : [...current, rank].sort((a, b) => a - b),
        });
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Ранги й права"
            description="Лідер (ранг 10) має всі права. Видати право рангу, вищому за ваш, неможливо."
            wide
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={btnGhost}
                    >
                        Скасувати
                    </button>
                    <button
                        type="button"
                        disabled={form.processing}
                        onClick={() =>
                            form.put(action, {
                                preserveScroll: true,
                                onSuccess: onClose,
                            })
                        }
                        className={btnPrimary}
                    >
                        Зберегти
                    </button>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {form.data.titles.map((t, i) => (
                    <label key={i} className="block">
                        <span className="mb-1 block text-[11px] text-white/45">
                            Ранг {i + 1}
                        </span>
                        <input
                            value={t}
                            maxLength={24}
                            onChange={(e) =>
                                form.setData(
                                    'titles',
                                    form.data.titles.map((x, j) =>
                                        j === i ? e.target.value : x,
                                    ),
                                )
                            }
                            className={cn(inputClass, 'h-9 text-xs')}
                        />
                    </label>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                    <thead>
                        <tr className="text-white/40">
                            <th className="py-2 text-left font-medium">
                                Право
                            </th>
                            {ranks.map((r) => (
                                <th key={r} className="w-9 py-2 font-medium">
                                    {r}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                        {Object.entries(permissions).map(([perm, label]) => (
                            <tr key={perm}>
                                <td className="py-2 pr-2 text-white/70">
                                    {label}
                                </td>
                                {ranks.map((r) => {
                                    const on = (
                                        form.data.matrix[perm] ?? []
                                    ).includes(r);
                                    const locked = r > maxRank;

                                    return (
                                        <td key={r} className="text-center">
                                            <button
                                                type="button"
                                                disabled={locked}
                                                onClick={() => toggle(perm, r)}
                                                className={cn(
                                                    'size-6 rounded-md transition disabled:cursor-not-allowed',
                                                    on
                                                        ? 'bg-gradient-brand text-white'
                                                        : 'bg-white/[0.05] hover:bg-white/10',
                                                    locked && 'opacity-30',
                                                )}
                                                aria-label={`${label}: ранг ${r}`}
                                            >
                                                {on && (
                                                    <Check className="mx-auto size-3.5" />
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}
