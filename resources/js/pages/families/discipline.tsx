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
import { tr } from '@/lib/i18n';

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
    mute_hours?: number[];
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
    mute: 'bg-sky-400/10 text-sky-200',
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
        hours: 3,
    });
    const target = roster.find((m) => m.id === form.data.member_id);

    return (
        <FamilyShell {...props} title={tr('Дисципліна')}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Metric
                    label={tr('Мої попередження')}
                    value={`${my_warns}/${config.warn_limit}`}
                    tone={my_warns > 0 ? 'text-rose-300' : 'text-emerald-300'}
                    icon={ShieldAlert}
                />
                <Metric
                    label={tr('Термін дії попередження')}
                    value={tr('{warn_days} дн.', {
                        warn_days: config.warn_days,
                    })}
                    icon={Gavel}
                />
                <Metric
                    label={tr('При досягненні ліміту')}
                    value={
                        config.escalation === 'kick'
                            ? tr('Виключення')
                            : tr('Пониження')
                    }
                    hint={tr('Застосовується автоматично')}
                />
            </div>

            {can['sanctions.issue'] && (
                <Panel title={tr('Видати покарання')} icon={Gavel}>
                    <div className="grid gap-3 lg:grid-cols-[1fr_200px_1.5fr_140px_auto]">
                        <Field
                            label={tr('Учасник')}
                            error={form.errors.member_id}
                        >
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
                                <option value="">{tr('Оберіть…')}</option>
                                {roster.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.display} {tr('· р.')}
                                        {m.rank}
                                        {m.warns ? ` · ⚠${m.warns}` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label={tr('Тип')} error={form.errors.type}>
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
                        <Field label={tr('Причина')} error={form.errors.reason}>
                            <input
                                value={form.data.reason}
                                onChange={(e) =>
                                    form.setData('reason', e.target.value)
                                }
                                placeholder={tr(
                                    'Пункт статуту або опис порушення',
                                )}
                                className={inputClass}
                            />
                        </Field>
                        {form.data.type === 'mute' && (
                            <Field
                                label={tr('На скільки')}
                                error={form.errors.hours}
                            >
                                <select
                                    value={form.data.hours}
                                    onChange={(e) =>
                                        form.setData(
                                            'hours',
                                            Number(e.target.value),
                                        )
                                    }
                                    className={inputClass}
                                >
                                    {(
                                        props.mute_hours ?? [
                                            1, 3, 6, 12, 24, 72, 168,
                                        ]
                                    ).map((h) => (
                                        <option key={h} value={h}>
                                            {h < 24
                                                ? tr('{h} год', { h })
                                                : tr('{v} дн', { v: h / 24 })}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        )}
                        <Field label={tr('Сума, ₴')} error={form.errors.amount}>
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
                                {tr('Видати')}
                            </button>
                        </div>
                    </div>
                    {target &&
                        form.data.type === 'warn' &&
                        target.warns + 1 >= config.warn_limit && (
                            <p className="mt-2 text-xs text-rose-300">
                                {tr('Це')} {target.warns + 1}
                                {tr('-е попередження з')} {config.warn_limit} —{' '}
                                {config.escalation === 'kick'
                                    ? tr('учасника буде автоматично виключено.')
                                    : tr('ранг буде автоматично знижено.')}
                            </p>
                        )}
                </Panel>
            )}

            <Panel
                title={tr('Історія')}
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
                                { value: 'family', label: tr('Уся сім’я') },
                                { value: 'me', label: tr('Мої') },
                            ]}
                        />
                    )
                }
            >
                {punishments.length === 0 ? (
                    <Empty
                        icon={ShieldAlert}
                        text={tr('Порушень немає — так тримати')}
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
                                            tr(' · діє до {kyivDateTime}', {
                                                kyivDateTime: kyivDateTime(
                                                    p.expires_at,
                                                ),
                                            })}
                                        {p.revoked_at &&
                                            tr(' · знято: {revoke_reason}', {
                                                revoke_reason: p.revoke_reason,
                                            })}
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
                                                    tr(
                                                        'Причина зняття покарання',
                                                    ),
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
                                            <Undo2 className="size-3.5" />{' '}
                                            {tr('Зняти')}
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
