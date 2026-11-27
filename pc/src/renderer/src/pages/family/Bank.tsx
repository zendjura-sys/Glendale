import { useState } from 'react';
import { Button, Card, Masonry, StatTile, Field, Input, Loading, Select, money, useAction, useSite, when } from '@/components/kit';
import type { FamilyTabProps } from './FamilyPage';
import { CashoutRow } from './Reports';
import type { Roster } from './types';

type Tx = { id: number; type_label: string; amount: number; balance_after: number; treasury_delta: number | null; comment: string | null; member: string | null; actor: string | null; created_at: string };
type Cashout = { id: number; amount: number; status: string; note: string | null; member: { id: number; display: string; balance: number }; process_comment: string | null; processed_at: string | null; created_at: string };
type Deposit = { id: number; amount: number; period: string; periods: number; rate: number; status: string; matures_at: string; accrued: number; payout: number };
type BankPage = {
    scope: 'me' | 'family';
    ledger: { data: Tx[]; current_page: number; last_page: number };
    cashouts: Cashout[];
    deposits: Deposit[];
    config: { deposits: { enabled: boolean; daily_rate: number; weekly_rate: number; min_amount: number; max_days: number; max_weeks: number }; cashout_min: number };
    totals: { balances: number; deposits: number; pending_cashouts: number; paid_week: number } | null;
    roster: Roster;
};

/** Банк: мій баланс і рух коштів, виведення, депозити; для скарбника — уся сім’я й ручні операції. */
export function FamilyBank({ slug, shell, reloadShell }: FamilyTabProps) {
    const treasurer = !!shell.can['treasury.manage'];
    const [scope, setScope] = useState<'me' | 'family'>('me');
    const [pageNo, setPage] = useState(1);
    const page = useSite<BankPage>(`/f/${slug}/bank?scope=${scope}&page=${pageNo}`);
    const { run, busy } = useAction();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [dep, setDep] = useState({ amount: '', period: 'daily', periods: '7' });
    const [manual, setManual] = useState({ target: 'member', member_id: '', direction: 'credit', amount: '', comment: '' });
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const done = async (): Promise<void> => {
        await page.reload();
        await reloadShell();
    };
    return (
        <div className="space-y-4">
            {treasurer && (
                <div className="flex gap-1">
                    <Button small tone={scope === 'me' ? 'primary' : 'ghost'} onClick={() => setScope('me')}>
                        Мій рахунок
                    </Button>
                    <Button small tone={scope === 'family' ? 'primary' : 'ghost'} onClick={() => setScope('family')}>
                        Уся сім’я
                    </Button>
                </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                <StatTile label="Мій баланс" value={money(shell.me?.balance)} />
                {shell.family.treasury !== null && <StatTile label="Казна" value={money(shell.family.treasury)} />}
                {d.totals && (
                    <>
                        <StatTile label="Баланси учасників" value={money(d.totals.balances)} />
                        <StatTile label="Чекають виведення" value={money(d.totals.pending_cashouts)} hint={`Виплачено за тиждень: ${money(d.totals.paid_week)}`} />
                    </>
                )}
            </div>
            <Masonry>
                <Card title="Вивести гроші">
                    <div className="space-y-2">
                        <Field label="Сума" hint={`Мінімум ${money(d.config.cashout_min)}`}>
                            <Input type="number" min={d.config.cashout_min} value={amount} onChange={(e) => setAmount(e.target.value)} />
                        </Field>
                        <Field label="Коментар">
                            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Куди переказати" />
                        </Field>
                        <Button tone="primary" disabled={busy || !amount} onClick={() => void run('POST', `/f/${slug}/bank/cashouts`, { amount: Number(amount), note: note || null }, 'Заявку на виведення надіслано.', async () => (setAmount(''), setNote(''), await done()))}>
                            Подати заявку
                        </Button>
                    </div>
                </Card>
                {d.config.deposits.enabled && (
                    <Card title="Депозит">
                        <div className="space-y-2">
                            <p className="text-xs text-white/50">
                                {d.config.deposits.daily_rate}% на день або {d.config.deposits.weekly_rate}% на тиждень · від {money(d.config.deposits.min_amount)}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <Input type="number" placeholder="Сума" value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value })} />
                                <Select value={dep.period} onChange={(e) => setDep({ ...dep, period: e.target.value })}>
                                    <option value="daily">Дні</option>
                                    <option value="weekly">Тижні</option>
                                </Select>
                                <Input type="number" min={1} max={dep.period === 'daily' ? d.config.deposits.max_days : d.config.deposits.max_weeks} value={dep.periods} onChange={(e) => setDep({ ...dep, periods: e.target.value })} />
                            </div>
                            <Button tone="primary" disabled={busy || !dep.amount} onClick={() => void run('POST', `/f/${slug}/bank/deposits`, { amount: Number(dep.amount), period: dep.period, periods: Number(dep.periods) }, 'Депозит відкрито.', done)}>
                                Відкрити депозит
                            </Button>
                            {d.deposits.map((x) => (
                                <div key={x.id} className="flex items-center gap-2 border-t border-white/5 pt-2 text-sm">
                                    <span className="flex-1">
                                        {money(x.amount)} · {x.periods} {x.period === 'daily' ? 'дн.' : 'тиж.'} · {x.status}
                                        <span className="text-white/45"> · {x.rate}% · нараховано {money(x.accrued)} · до {when(x.matures_at)}</span>
                                    </span>
                                    {x.status === 'active' && (
                                        <Button small tone="danger" disabled={busy} onClick={() => void run('POST', `/f/${slug}/bank/deposits/${x.id}/close`, {}, 'Депозит закрито.', done)}>
                                            Закрити
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
                {treasurer && (
                    <Card title="Ручна операція">
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Select value={manual.target} onChange={(e) => setManual({ ...manual, target: e.target.value })}>
                                    <option value="member">Учасник</option>
                                    <option value="treasury">Казна</option>
                                </Select>
                                <Select value={manual.direction} onChange={(e) => setManual({ ...manual, direction: e.target.value })}>
                                    <option value="credit">Нарахувати</option>
                                    <option value="debit">Списати</option>
                                </Select>
                            </div>
                            {manual.target === 'member' && (
                                <Select value={manual.member_id} onChange={(e) => setManual({ ...manual, member_id: e.target.value })}>
                                    <option value="">Оберіть учасника…</option>
                                    {d.roster.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.display}
                                        </option>
                                    ))}
                                </Select>
                            )}
                            <Input type="number" placeholder="Сума" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
                            <Input placeholder="Причина (обовʼязково)" value={manual.comment} onChange={(e) => setManual({ ...manual, comment: e.target.value })} />
                            <Button
                                tone="primary"
                                disabled={busy || !manual.amount || manual.comment.trim().length < 3 || (manual.target === 'member' && !manual.member_id)}
                                onClick={() => void run('POST', `/f/${slug}/bank/manual`, { ...manual, member_id: manual.member_id ? Number(manual.member_id) : null, amount: Number(manual.amount) }, 'Операцію проведено.', done)}
                            >
                                Провести
                            </Button>
                        </div>
                    </Card>
                )}
            </Masonry>
            {d.cashouts.length > 0 && (
                <Card title="Заявки на виведення">
                    {d.cashouts.map((c) =>
                        treasurer && c.status === 'pending' ? (
                            <CashoutRow key={c.id} slug={slug} cashout={c} onDone={done} />
                        ) : (
                            <div key={c.id} className="flex gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                                <span className="flex-1">
                                    {c.member.display} · {money(c.amount)} {c.note ? `· ${c.note}` : ''}
                                </span>
                                <span className="text-white/50">{c.status}</span>
                                {c.status === 'pending' && (
                                    <Button small tone="danger" disabled={busy} onClick={() => void run('POST', `/f/${slug}/bank/cashouts/${c.id}/cancel`, {}, 'Заявку скасовано.', done)}>
                                        Скасувати
                                    </Button>
                                )}
                            </div>
                        ),
                    )}
                </Card>
            )}
            <Card title="Рух коштів">
                {d.ledger.data.length === 0 && <p className="text-sm text-white/45">Операцій ще не було.</p>}
                <div className="divide-y divide-white/5">
                    {d.ledger.data.map((t) => (
                        <div key={t.id} className="flex gap-3 py-2 text-sm">
                            <span className="w-28 shrink-0 text-white/40">{when(t.created_at)}</span>
                            <span className="min-w-0 flex-1 truncate">
                                {t.type_label}
                                {t.member ? ` · ${t.member}` : ''}
                                {t.comment ? ` · ${t.comment}` : ''}
                                {t.actor ? <span className="text-white/40"> ({t.actor})</span> : null}
                            </span>
                            <span className={t.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{(t.amount >= 0 ? '+' : '') + money(t.amount)}</span>
                            <span className="w-28 text-right text-white/45">{money(t.balance_after)}</span>
                        </div>
                    ))}
                </div>
                {d.ledger.last_page > 1 && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                        <Button small disabled={pageNo <= 1} onClick={() => setPage(pageNo - 1)}>
                            ←
                        </Button>
                        {pageNo} / {d.ledger.last_page}
                        <Button small disabled={pageNo >= d.ledger.last_page} onClick={() => setPage(pageNo + 1)}>
                            →
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
