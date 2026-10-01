import { router, useForm } from '@inertiajs/react';
import { Gavel, ShieldAlert, Undo2 } from 'lucide-react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Metric,
    Panel,
    Segmented,
    btnPrimary,
    kyivDateTime,
} from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import { Field, inputClass } from '@/components/servers/server-form';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyShellProps } from '@/types';

type Punishment = {
    id: number;
    type: string;
    type_label: string;
    reason: string;
    amount: number | null;
    member: string;
    member_id: number;
    issuer: string | null;
    is_auto: boolean;
    active: boolean;
    expires_at: string | null;
    revoked_at: string | null;
    revoke_reason: string | null;
    created_at: string;
};

type Props = FamilyShellProps & {
    scope: 'me' | 'family';
    punishments: Punishment[];
    types: Record<string, string>;
    config: {
        warn_days: number;
        warn_limit: number;
        escalation: 'demote' | 'kick';
    };
    roster: { id: number; display: string; rank: number; warns: number }[];
    my_warns: number;
};

const typeTones: Record<string, string> = {
    warn: 'bg-amber-300/10 text-amber-200',
    reprimand: 'bg-orange-400/10 text-orange-200',
    fine: 'bg-rose-400/10 text-rose-200',
    demote: 'bg-violet-400/10 text-violet-200',
    kick: 'bg-rose-500/20 text-rose-100',
};

export default function FamilyDiscipline(props: Props) {
    const { family, can, scope, punishments, types, config, roster, my_warns } =
        props;
    const base = `/f/${family.slug}`;
    const form = useForm({
        member_id: '' as number | '',
        type: 'warn',
        reason: '',
        amount: '',
    });
    const target = roster.find((m) => m.id === form.data.member_id);

    return (
        <FamilyShell {...props} title="Дисципліна">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Metric
                    label="Мої попередження"
                    value={`${my_warns}/${config.warn_limit}`}
                    tone={my_warns > 0 ? 'text-rose-300' : 'text-emerald-300'}
                    icon={ShieldAlert}
                />
                <Metric
                    label="Термін дії попередження"
                    value={`${config.warn_days} дн.`}
                    icon={Gavel}
                />
                <Metric
                    label="При досягненні ліміту"
                    value={
                        config.escalation === 'kick'
                            ? 'Виключення'
                            : 'Пониження'
                    }
                    hint="Застосовується автоматично"
                />
            </div>

            {can['sanctions.issue'] && (
                <Panel title="Видати покарання" icon={Gavel}>
                    <div className="grid gap-3 lg:grid-cols-[1fr_200px_1.5fr_140px_auto]">
                        <Field label="Учасник" error={form.errors.member_id}>
                            <select
                                value={form.data.member_id}
                                onChange={(e) =>
                                    form.setData(
                                        'member_id',
                                        e.target.value
                                            ? Number(e.target.value)
                                            : '',
                                    )
                                }
                                className={cn(selectClass, 'h-11 w-full')}
                            >
                                <option value="">Оберіть…</option>
                                {roster.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.display} · р.{m.rank}
                                        {m.warns ? ` · ⚠${m.warns}` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Тип" error={form.errors.type}>
                            <select
                                value={form.data.type}
                                onChange={(e) =>
                                    form.setData('type', e.target.value)
                                }
                                className={cn(selectClass, 'h-11 w-full')}
                            >
                                {Object.entries(types).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Причина" error={form.errors.reason}>
                            <input
                                value={form.data.reason}
                                onChange={(e) =>
                                    form.setData('reason', e.target.value)
                                }
                                placeholder="Пункт статуту або опис порушення"
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Сума, ₴" error={form.errors.amount}>
                            <input
                                value={form.data.amount}
                                disabled={form.data.type !== 'fine'}
                                onChange={(e) =>
                                    form.setData('amount', e.target.value)
                                }
                                inputMode="decimal"
                                className={cn(
                                    inputClass,
                                    'disabled:opacity-30',
                                )}
                            />
                        </Field>
                        <div className="flex items-end">
                            <button
                                type="button"
                                disabled={
                                    form.processing || !form.data.member_id
                                }
                                onClick={() =>
                                    form.post(`${base}/discipline`, {
                                        preserveScroll: true,
                                        onSuccess: () =>
                                            form.reset('reason', 'amount'),
                                    })
                                }
                                className={cn(btnPrimary, 'h-11 w-full')}
                            >
                                Видати
                            </button>
                        </div>
                    </div>
                    {target &&
                        form.data.type === 'warn' &&
                        target.warns + 1 >= config.warn_limit && (
                            <p className="mt-2 text-xs text-rose-300">
                                Це {target.warns + 1}-е попередження з{' '}
                                {config.warn_limit} —{' '}
                                {config.escalation === 'kick'
                                    ? 'учасника буде автоматично виключено.'
                                    : 'ранг буде автоматично знижено.'}
                            </p>
                        )}
                </Panel>
            )}

            <Panel
                title="Історія"
                icon={ShieldAlert}
                actions={
                    can['sanctions.issue'] && (
                        <Segmented
                            value={scope}
                            onChange={(v) =>
                                router.get(
                                    `${base}/discipline`,
                                    { scope: v === 'family' ? undefined : v },
                                    {
                                        preserveScroll: true,
                                        preserveState: true,
                                        replace: true,
                                    },
                                )
                            }
                            options={[
                                { value: 'family', label: 'Уся сім’я' },
                                { value: 'me', label: 'Мої' },
                            ]}
                        />
                    )
                }
            >
                {punishments.length === 0 ? (
                    <Empty
                        icon={ShieldAlert}
                        text="Порушень немає — так тримати"
                    />
                ) : (
                    <ul className="space-y-2">
                        {punishments.map((p) => (
                            <li
                                key={p.id}
                                className={cn(
                                    'flex flex-wrap items-start gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]',
                                    !p.active && 'opacity-55',
                                )}
                            >
                                <span
                                    className={cn(
                                        'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                        typeTones[p.type] ??
                                            'bg-white/[0.06] text-white/60',
                                    )}
                                >
                                    {p.type_label}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm text-white">
                                        {scope === 'family' && (
                                            <span className="font-mono">
                                                {p.member} ·{' '}
                                            </span>
                                        )}
                                        {p.reason}
                                        {p.amount ? (
                                            <span className="ml-1 font-semibold text-rose-300">
                                                −{uah(p.amount)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-0.5 text-xs text-white/40">
                                        {p.issuer ?? '—'} ·{' '}
                                        {kyivDateTime(p.created_at)}
                                        {p.expires_at &&
                                            p.active &&
                                            ` · діє до ${kyivDateTime(p.expires_at)}`}
                                        {p.revoked_at &&
                                            ` · знято: ${p.revoke_reason}`}
                                    </div>
                                </div>
                                {can['sanctions.issue'] &&
                                    p.active &&
                                    !p.revoked_at &&
                                    p.type !== 'kick' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const reason = prompt(
                                                    'Причина зняття покарання',
                                                );
                                                if (reason) {
                                                    router.post(
                                                        `${base}/discipline/${p.id}/revoke`,
                                                        { reason },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    );
                                                }
                                            }}
                                            className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-white"
                                        >
                                            <Undo2 className="size-3.5" /> Зняти
                                        </button>
                                    )}
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </FamilyShell>
    );
}
