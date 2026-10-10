import { InfiniteScroll, router, useForm } from '@inertiajs/react';
import {
    ArrowDownToLine,
    Banknote,
    Landmark,
    PiggyBank,
    ReceiptText,
    Scale,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Amount,
    Empty,
    Metric,
    Panel,
    Segmented,
    btnGhost,
    btnPrimary,
    kyivDateTime,
} from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import {
    Field,
    FieldError,
    inputClass,
} from '@/components/servers/server-form';
import { timeAgo } from '@/lib/format';
import { toMinor, uah, uahShort } from '@/lib/money';
import { cn } from '@/lib/utils';
import type {
    CashoutItem,
    DepositItem,
    FamilyShellProps,
    LedgerEntry,
    Paginated,
    RosterEntry,
} from '@/types';
import { tr } from '@/lib/i18n';

type Props = FamilyShellProps & {
    scope: 'me' | 'family';
    ledger: Paginated<LedgerEntry>;
    cashouts: CashoutItem[];
    deposits: DepositItem[];
    config: {
        deposits: {
            enabled: boolean;
            daily_rate: number;
            weekly_rate: number;
            min_amount: number;
            max_days: number;
            max_weeks: number;
        };
        cashout_min: number;
        rates: Record<string, number>;
    };
    totals: {
        balances: number;
        deposits: number;
        pending_cashouts: number;
        paid_week: number;
    } | null;
    roster: RosterEntry[];
};

const cashoutStatus = {
    pending: [tr('Очікує видачі'), 'bg-amber-300/10 text-amber-200'],
    paid: [tr('Видано'), 'bg-emerald-400/10 text-emerald-200'],
    cancelled: [tr('Скасовано'), 'bg-white/[0.05] text-white/45'],
} as const;

const depositStatus = {
    active: [tr('Активний'), 'bg-gc-indigo/15 text-[#c4b5fd]'],
    matured: [tr('Виплачено'), 'bg-emerald-400/10 text-emerald-200'],
    closed: [tr('Закрито достроково'), 'bg-white/[0.05] text-white/45'],
} as const;

export default function FamilyBank(props: Props) {
    const {
        family,
        me,
        can,
        scope,
        ledger,
        cashouts,
        deposits,
        config,
        totals,
        roster,
    } = props;
    const base = `/f/${family.slug}`;

    return (
        <FamilyShell {...props} title={tr('Банк')}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                    label={tr('Мій баланс')}
                    value={uahShort(me.balance)}
                    tone={me.balance < 0 ? 'text-rose-300' : 'text-emerald-300'}
                    icon={Wallet}
                />
                {totals ? (
                    <>
                        <Metric
                            label={tr('Скарбниця')}
                            value={uahShort(family.treasury)}
                            hint={tr('Видано за тиждень: {uah}', {
                                uah: uah(totals.paid_week),
                            })}
                            icon={Landmark}
                        />
                        <Metric
                            label={tr('Борг перед учасниками')}
                            value={uahShort(
                                totals.balances + totals.pending_cashouts,
                            )}
                            hint={tr('На видачу: {uah}', {
                                uah: uah(totals.pending_cashouts),
                            })}
                            tone={
                                totals.balances + totals.pending_cashouts >
                                family.treasury
                                    ? 'text-rose-300'
                                    : 'text-white'
                            }
                            icon={Scale}
                        />
                        <Metric
                            label={tr('Депозити')}
                            value={uahShort(totals.deposits)}
                            icon={PiggyBank}
                        />
                    </>
                ) : (
                    <Metric
                        label={tr('Активні депозити')}
                        value={uahShort(
                            deposits
                                .filter((d) => d.status === 'active')
                                .reduce((s, d) => s + d.amount, 0),
                        )}
                        icon={PiggyBank}
                    />
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CashoutPanel
                    action={`${base}/bank/cashouts`}
                    base={base}
                    min={config.cashout_min}
                    balance={me.balance}
                    cashouts={cashouts}
                />
                <DepositPanel
                    action={`${base}/bank/deposits`}
                    base={base}
                    config={config.deposits}
                    deposits={deposits}
                />
            </div>

            {can['treasury.manage'] && (
                <ManualPanel action={`${base}/bank/manual`} roster={roster} />
            )}

            <Panel
                title={tr('Журнал операцій')}
                icon={ReceiptText}
                actions={
                    can['treasury.manage'] && (
                        <Segmented
                            value={scope}
                            onChange={(v) =>
                                router.get(
                                    `${base}/bank`,
                                    { scope: v === 'me' ? undefined : v },
                                    {
                                        preserveScroll: true,
                                        preserveState: true,
                                        replace: true,
                                        reset: ['ledger'],
                                    },
                                )
                            }
                            options={[
                                { value: 'me', label: tr('Мої') },
                                { value: 'family', label: tr('Уся сім’я') },
                            ]}
                        />
                    )
                }
            >
                {ledger.data.length === 0 ? (
                    <Empty icon={ReceiptText} text={tr('Операцій ще немає')} />
                ) : (
                    <div className="overflow-x-auto">
                        <InfiniteScroll data="ledger" preserveUrl>
                            <table className="w-full min-w-[560px] text-sm">
                                <thead className="text-left text-xs tracking-wide text-white/35 uppercase">
                                    <tr>
                                        <th className="py-2 pr-3 font-medium">
                                            {tr('Час')}
                                        </th>
                                        <th className="py-2 pr-3 font-medium">
                                            {tr('Операція')}
                                        </th>
                                        {scope === 'family' && (
                                            <th className="py-2 pr-3 font-medium">
                                                {tr('Учасник')}
                                            </th>
                                        )}
                                        <th className="py-2 pr-3 text-right font-medium">
                                            {tr('Сума')}
                                        </th>
                                        <th className="py-2 text-right font-medium">
                                            {scope === 'family'
                                                ? tr('Скарбниця')
                                                : tr('Баланс')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {ledger.data.map((t) => (
                                        <tr key={t.id}>
                                            <td className="py-2 pr-3 text-xs whitespace-nowrap text-white/40">
                                                {kyivDateTime(t.created_at)}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <div className="text-white">
                                                    {t.type_label}
                                                </div>
                                                {(t.comment || t.actor) && (
                                                    <div className="max-w-xs truncate text-xs text-white/40">
                                                        {t.comment}
                                                        {t.actor &&
                                                            ` · ${t.actor}`}
                                                    </div>
                                                )}
                                            </td>
                                            {scope === 'family' && (
                                                <td className="py-2 pr-3 font-mono text-xs text-white/70">
                                                    {t.member ?? '—'}
                                                </td>
                                            )}
                                            <td className="py-2 pr-3 text-right">
                                                {scope === 'family' &&
                                                t.amount === 0 ? (
                                                    <Amount
                                                        value={t.treasury_delta}
                                                    />
                                                ) : (
                                                    <Amount value={t.amount} />
                                                )}
                                            </td>
                                            <td className="py-2 text-right text-xs whitespace-nowrap text-white/50">
                                                {scope === 'family'
                                                    ? t.treasury_after !== null
                                                        ? uah(t.treasury_after)
                                                        : '—'
                                                    : t.balance_after !== null
                                                      ? uah(t.balance_after)
                                                      : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </InfiniteScroll>
                    </div>
                )}
            </Panel>
        </FamilyShell>
    );
}

function CashoutPanel({
    action,
    base,
    min,
    balance,
    cashouts,
}: {
    action: string;
    base: string;
    min: number;
    balance: number;
    cashouts: CashoutItem[];
}) {
    const form = useForm({ amount: '', note: '' });

    return (
        <Panel title={tr('Вивести гроші в грі')} icon={Banknote}>
            <p className="mb-3 text-xs text-white/45">
                {tr(
                    'Сума резервується з вашого балансу, офіцер видає її в грі й підтверджує. Мінімум —',
                )}{' '}
                {uah(toMinor(min))}.
            </p>
            <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                    <input
                        value={form.data.amount}
                        onChange={(e) => form.setData('amount', e.target.value)}
                        inputMode="decimal"
                        placeholder={tr('Сума, ₴')}
                        className={inputClass}
                    />
                </div>
                <button
                    type="button"
                    onClick={() =>
                        form.setData(
                            'amount',
                            String(Math.max(0, balance) / 100),
                        )
                    }
                    className={btnGhost}
                >
                    {tr('Усе')}
                </button>
                <button
                    type="button"
                    disabled={form.processing || !form.data.amount}
                    onClick={() =>
                        form.post(action, {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        })
                    }
                    className={btnPrimary}
                >
                    <ArrowDownToLine className="size-4" /> {tr('Запросити')}
                </button>
            </div>
            <input
                value={form.data.note}
                onChange={(e) => form.setData('note', e.target.value)}
                placeholder={tr('Примітка: коли зручно отримати')}
                className={cn(inputClass, 'mt-2 h-10')}
            />
            <FieldError message={form.errors.amount ?? form.errors.note} />

            {cashouts.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                    {cashouts.map((c) => (
                        <li
                            key={c.id}
                            className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white">
                                    {uah(c.amount)}
                                </div>
                                <div className="truncate text-xs text-white/40">
                                    {timeAgo(c.created_at)}
                                    {c.process_comment &&
                                        ` · ${c.process_comment}`}
                                </div>
                            </div>
                            {c.has_proof && (
                                <a
                                    href={`${base}/bank/cashouts/${c.id}/proof`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-gc-lilac-200 hover:underline"
                                >
                                    {tr('скрін')}
                                </a>
                            )}
                            <span
                                className={cn(
                                    'rounded-full px-2 py-0.5 text-xs font-medium',
                                    cashoutStatus[c.status][1],
                                )}
                            >
                                {cashoutStatus[c.status][0]}
                            </span>
                            {c.status === 'pending' && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `${base}/bank/cashouts/${c.id}/cancel`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="text-xs text-white/45 hover:text-rose-300"
                                >
                                    {tr('скасувати')}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function DepositPanel({
    action,
    base,
    config,
    deposits,
}: {
    action: string;
    base: string;
    config: Props['config']['deposits'];
    deposits: DepositItem[];
}) {
    const form = useForm({
        amount: '',
        period: 'weekly' as 'daily' | 'weekly',
        periods: 1,
    });
    const rate =
        form.data.period === 'daily' ? config.daily_rate : config.weekly_rate;
    const max =
        form.data.period === 'daily' ? config.max_days : config.max_weeks;
    const principal = toMinor(form.data.amount || 0);
    const interest = Math.floor((principal * rate * form.data.periods) / 100);

    if (!config.enabled) {
        return (
            <Panel title={tr('Депозити')} icon={PiggyBank}>
                <Empty
                    icon={PiggyBank}
                    text={tr('Депозити в сім’ї вимкнено')}
                />
            </Panel>
        );
    }

    return (
        <Panel title={tr('Депозит')} icon={PiggyBank}>
            <p className="mb-3 text-xs text-white/45">
                {config.daily_rate}
                {tr('% на день або')} {config.weekly_rate}
                {tr(
                    '% на тиждень. Дострокове закриття повертає лише тіло депозиту.',
                )}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <input
                    value={form.data.amount}
                    onChange={(e) => form.setData('amount', e.target.value)}
                    inputMode="decimal"
                    placeholder={tr('Від {min_amount} ₴', {
                        min_amount: config.min_amount,
                    })}
                    className={inputClass}
                />
                <Segmented
                    value={form.data.period}
                    onChange={(v) => {
                        form.setData((d) => ({ ...d, period: v, periods: 1 }));
                    }}
                    options={[
                        { value: 'daily', label: tr('Дні') },
                        { value: 'weekly', label: tr('Тижні') },
                    ]}
                />
            </div>
            <div className="mt-3 flex items-center gap-3">
                <input
                    type="range"
                    min={1}
                    max={max}
                    value={form.data.periods}
                    onChange={(e) =>
                        form.setData('periods', Number(e.target.value))
                    }
                    className="flex-1 accent-gc-indigo"
                />
                <span className="w-24 text-right text-sm font-semibold text-white">
                    {form.data.periods}{' '}
                    {form.data.period === 'daily' ? tr('дн.') : tr('тиж.')}
                </span>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                <div className="min-w-0 flex-1 text-xs text-white/45">
                    {tr('До виплати')}
                    <div className="font-display text-lg font-bold text-emerald-300">
                        {uah(principal + interest)}
                    </div>
                    <span className="text-emerald-300/70">
                        +{uah(interest)} {tr('відсотків')}
                    </span>
                </div>
                <button
                    type="button"
                    disabled={form.processing || !principal}
                    onClick={() =>
                        form.post(action, {
                            preserveScroll: true,
                            onSuccess: () => form.reset('amount'),
                        })
                    }
                    className={btnPrimary}
                >
                    {tr('Відкрити')}
                </button>
            </div>
            <FieldError message={form.errors.amount ?? form.errors.periods} />

            {deposits.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                    {deposits.map((d) => (
                        <li
                            key={d.id}
                            className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white">
                                    {uah(d.amount)} →{' '}
                                    <span className="text-emerald-300">
                                        {uah(d.paid ?? d.payout)}
                                    </span>
                                </div>
                                <div className="text-xs text-white/40">
                                    {d.rate}% × {d.periods}{' '}
                                    {d.period === 'daily'
                                        ? tr('дн.')
                                        : tr('тиж.')}{' '}
                                    ·{' '}
                                    {d.status === 'active'
                                        ? tr(
                                              'до {kyivDateTime} · накопичено {uah}',
                                              {
                                                  kyivDateTime: kyivDateTime(
                                                      d.matures_at,
                                                  ),
                                                  uah: uah(d.accrued),
                                              },
                                          )
                                        : timeAgo(d.matures_at)}
                                </div>
                            </div>
                            <span
                                className={cn(
                                    'rounded-full px-2 py-0.5 text-xs font-medium',
                                    depositStatus[d.status][1],
                                )}
                            >
                                {depositStatus[d.status][0]}
                            </span>
                            {d.status === 'active' && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        confirm(
                                            tr(
                                                'Закрити депозит достроково? Відсотки не буде нараховано.',
                                            ),
                                        ) &&
                                        router.post(
                                            `${base}/bank/deposits/${d.id}/close`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="text-xs text-white/45 hover:text-rose-300"
                                >
                                    {tr('закрити')}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function ManualPanel({
    action,
    roster,
}: {
    action: string;
    roster: RosterEntry[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        target: 'member' as 'member' | 'treasury',
        member_id: '' as number | '',
        direction: 'credit' as 'credit' | 'debit',
        amount: '',
        comment: '',
    });

    return (
        <Panel
            title={tr('Ручна операція')}
            icon={Scale}
            actions={
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="text-xs text-white/50 hover:text-white"
                >
                    {open ? tr('Згорнути') : tr('Розгорнути')}
                </button>
            }
        >
            {open ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label={tr('Рахунок')}>
                        <Segmented
                            value={form.data.target}
                            onChange={(v) => form.setData('target', v)}
                            options={[
                                { value: 'member', label: tr('Учасник') },
                                { value: 'treasury', label: tr('Скарбниця') },
                            ]}
                        />
                    </Field>
                    {form.data.target === 'member' && (
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
                                        {m.display}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                    <Field label={tr('Напрям')}>
                        <Segmented
                            value={form.data.direction}
                            onChange={(v) => form.setData('direction', v)}
                            options={[
                                { value: 'credit', label: tr('Нарахувати') },
                                { value: 'debit', label: tr('Списати') },
                            ]}
                        />
                    </Field>
                    <Field label={tr('Сума, ₴')} error={form.errors.amount}>
                        <input
                            value={form.data.amount}
                            onChange={(e) =>
                                form.setData('amount', e.target.value)
                            }
                            inputMode="decimal"
                            className={inputClass}
                        />
                    </Field>
                    <Field
                        label={tr('Коментар (потрапить у журнал аудиту)')}
                        error={form.errors.comment}
                        className="sm:col-span-2 lg:col-span-3"
                    >
                        <input
                            value={form.data.comment}
                            onChange={(e) =>
                                form.setData('comment', e.target.value)
                            }
                            placeholder={tr(
                                'Напр. Компенсація за зламаний транспорт',
                            )}
                            className={inputClass}
                        />
                    </Field>
                    <div className="flex items-end">
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() =>
                                form.post(action, {
                                    preserveScroll: true,
                                    onSuccess: () =>
                                        form.reset('amount', 'comment'),
                                })
                            }
                            className={cn(btnPrimary, 'h-11 w-full')}
                        >
                            {tr('Провести')}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-white/45">
                    {tr(
                        'Нарахування чи списання з балансу учасника або скарбниці з обов’язковим коментарем.',
                    )}
                </p>
            )}
        </Panel>
    );
}
