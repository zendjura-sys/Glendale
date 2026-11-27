import { Check, ImagePlus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Modal, PrivateImage, Select, TextArea, money, useAction, useSite, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import type { FamilyTabProps } from './FamilyPage';
import type { Member, Roster } from './types';

type Report = {
    id: number;
    type: string;
    type_label: string;
    status: 'pending' | 'approved' | 'rejected';
    event_date: string;
    data: { wins?: number; losses?: number; hours?: number[]; tier?: string; count?: number; amount?: number } | null;
    description: string | null;
    reward: number | null;
    points?: number | null;
    flags?: Record<string, unknown> | null;
    for_friend?: boolean;
    submitter?: Member | null;
    beneficiary?: Member | null;
    review_comment?: string | null;
    created_at: string;
    deadline?: string | null;
    proofs: { id: number; url: string }[];
    self_review?: boolean;
    history?: { approved: number; rejected: number };
};
type Config = { types: Record<string, string>; tiers: Record<string, string>; hours: number[]; deadline_hours: number; contract_limit: number; require_proof: boolean; max_proofs: number; today: string; min_date: string; rates: Record<string, number> };
type MyReports = { reports: { data: Report[] }; status: string | null; config: Config; roster: Roster };

const STATUS: Record<string, { label: string; cls: string }> = {
    pending: { label: 'На перевірці', cls: 'bg-amber-400/15 text-amber-200' },
    approved: { label: 'Схвалено', cls: 'bg-emerald-400/15 text-emerald-200' },
    rejected: { label: 'Відхилено', cls: 'bg-rose-400/15 text-rose-200' },
};

const details = (r: Report): string => {
    const d = r.data ?? {};
    const parts: string[] = [];
    if (d.wins !== undefined || d.losses !== undefined) parts.push(`перемог ${d.wins ?? 0}, поразок ${d.losses ?? 0}`);
    if (d.hours?.length) parts.push(`години: ${d.hours.join(', ')}`);
    if (d.tier) parts.push(`рівень ${d.tier}${d.count ? ` × ${d.count}` : ''}`);
    if (d.amount) parts.push(money(d.amount));
    return parts.join(' · ');
};

export function FamilyReports({ slug, reloadShell }: FamilyTabProps) {
    const [status, setStatus] = useState('');
    const page = useSite<MyReports>(`/f/${slug}/reports${status ? `?status=${status}` : ''}`);
    const [creating, setCreating] = useState(false);
    const [zoom, setZoom] = useState<string | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const { reports, config, roster } = page.data;
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-48">
                    <option value="">Усі звіти</option>
                    <option value="pending">На перевірці</option>
                    <option value="approved">Схвалені</option>
                    <option value="rejected">Відхилені</option>
                </Select>
                <div className="flex-1" />
                <Button tone="primary" onClick={() => setCreating(true)}>
                    <Plus size={15} /> Новий звіт
                </Button>
            </div>
            {reports.data.length === 0 && <p className="py-10 text-center text-sm text-white/45">Звітів ще немає. Здайте перший — за бізвар, контракт чи інвестицію.</p>}
            <div className="space-y-2">
                {reports.data.map((r) => (
                    <Card key={r.id}>
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-semibold">#{r.id} {r.type_label}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
                                    <span className="text-white/45">за {when(r.event_date, false)}</span>
                                    {r.for_friend && r.beneficiary && <span className="text-white/45">за {r.beneficiary.display}</span>}
                                </div>
                                <p className="mt-1 text-sm text-white/70">{details(r)}</p>
                                {r.description && <p className="mt-1 text-sm text-white/55">{r.description}</p>}
                                {r.review_comment && <p className="mt-1 text-xs text-white/45">Коментар перевіряючого: {r.review_comment}</p>}
                            </div>
                            {r.reward !== null && r.status === 'approved' && <span className="text-sm font-semibold text-emerald-300">+{money(r.reward)}</span>}
                        </div>
                        {r.proofs.length > 0 && (
                            <div className="mt-3 flex gap-2 overflow-x-auto">
                                {r.proofs.map((p) => (
                                    <PrivateImage key={p.id} src={p.url} onClick={setZoom} className="h-20 w-32 shrink-0 rounded-lg object-cover" />
                                ))}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
            {creating && (
                <NewReport
                    slug={slug}
                    config={config}
                    roster={roster}
                    onClose={() => setCreating(false)}
                    onDone={async () => {
                        setCreating(false);
                        await page.reload();
                        await reloadShell();
                    }}
                />
            )}
            {zoom && <Zoom src={zoom} onClose={() => setZoom(null)} />}
        </div>
    );
}

export function Zoom({ src, onClose }: { src: string; onClose: () => void }) {
    return (
        <div className="absolute inset-0 z-[70] grid place-items-center bg-black/85 p-6" onClick={onClose}>
            <img src={src} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
    );
}

/** Новий звіт: тип, за себе чи друга, дата, дані за типом, опис і скріншоти-докази. */
function NewReport({ slug, config, roster, onClose, onDone }: { slug: string; config: Config; roster: Roster; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const types = Object.entries(config.types);
    const [type, setType] = useState(types[0]?.[0] ?? 'bizwar');
    const [forWho, setFor] = useState<'self' | 'friend'>('self');
    const [friend, setFriend] = useState('');
    const [date, setDate] = useState(config.today);
    const [wins, setWins] = useState('1');
    const [losses, setLosses] = useState('0');
    const [hours, setHours] = useState<number[]>([]);
    const [tier, setTier] = useState(Object.keys(config.tiers)[0] ?? 'light');
    const [count, setCount] = useState('1');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<File[]>([]);

    const pick = (): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp';
        input.multiple = true;
        input.onchange = () => setFiles((f) => [...f, ...Array.from(input.files ?? [])].slice(0, config.max_proofs || 10));
        input.click();
    };
    const paste = (e: React.ClipboardEvent): void => {
        const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
        if (images.length) setFiles((f) => [...f, ...images].slice(0, config.max_proofs || 10));
    };
    const submit = async (): Promise<void> => {
        const fields: Record<string, string | number | (string | number)[] | null> = { type, for: forWho, event_date: date, description: description || null };
        if (forWho === 'friend') fields.beneficiary_id = Number(friend);
        if (type === 'bizwar') Object.assign(fields, { wins: Number(wins), losses: Number(losses), hours });
        if (type === 'contract') Object.assign(fields, { tier, count: Number(count) });
        if (type === 'investment') fields.amount = Number(amount);
        const proofs = await Promise.all(files.map(async (f) => ({ field: 'proofs[]', name: f.name, type: f.type, data: await f.arrayBuffer() })));
        await run('POST', `/f/${slug}/reports`, { __form: true, fields, files: proofs }, 'Звіт надіслано на перевірку.', onDone);
    };
    return (
        <Modal title="Новий звіт" onClose={onClose}>
            <div className="space-y-3" onPaste={paste}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Тип">
                        <Select value={type} onChange={(e) => setType(e.target.value)}>
                            {types.map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Дата" hint={`Не раніше ${when(config.min_date, false)}`}>
                        <Input type="date" value={date} min={config.min_date} max={config.today} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                    <Field label="За кого">
                        <Select value={forWho} onChange={(e) => setFor(e.target.value as 'self' | 'friend')}>
                            <option value="self">За себе</option>
                            <option value="friend">За іншого учасника</option>
                        </Select>
                    </Field>
                    {forWho === 'friend' && (
                        <Field label="Учасник">
                            <Select value={friend} onChange={(e) => setFriend(e.target.value)}>
                                <option value="">Оберіть…</option>
                                {roster.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.display}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    )}
                </div>
                {type === 'bizwar' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Перемоги">
                                <Input type="number" min={0} max={40} value={wins} onChange={(e) => setWins(e.target.value)} />
                            </Field>
                            <Field label="Поразки">
                                <Input type="number" min={0} max={40} value={losses} onChange={(e) => setLosses(e.target.value)} />
                            </Field>
                        </div>
                        <Field label="Години бізварів">
                            <div className="flex flex-wrap gap-1.5">
                                {config.hours.map((h) => (
                                    <button key={h} type="button" onClick={() => setHours((x) => (x.includes(h) ? x.filter((y) => y !== h) : [...x, h]))} className={`rounded-lg px-2.5 py-1 text-xs ring-1 ${hours.includes(h) ? 'bg-neon-cyan/20 ring-neon-cyan/60' : 'ring-white/10 hover:bg-white/5'}`}>
                                        {String(h).padStart(2, '0')}:00
                                    </button>
                                ))}
                            </div>
                        </Field>
                    </>
                )}
                {type === 'contract' && (
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Рівень контракту">
                            <Select value={tier} onChange={(e) => setTier(e.target.value)}>
                                {Object.entries(config.tiers).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v} — {money(config.rates[`contract_${k}`])}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Кількість" hint={`Ліміт на день: ${config.contract_limit}`}>
                            <Input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} />
                        </Field>
                    </div>
                )}
                {type === 'investment' && (
                    <Field label="Сума інвестиції" hint={`Кешбек ${config.rates.investment_cashback ?? 0}%`}>
                        <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </Field>
                )}
                <Field label="Опис">
                    <TextArea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} placeholder="Що було, з ким, деталі для перевіряючого" />
                </Field>
                <Field label={`Скріншоти-докази${config.require_proof ? ' (обовʼязково)' : ''}`} hint="Можна вставити з буфера: Ctrl+V">
                    <div className="flex flex-wrap gap-2">
                        {files.map((f, i) => (
                            <span key={`${f.name}-${i}`} className="relative">
                                <img src={URL.createObjectURL(f)} alt="" className="h-16 w-24 rounded-lg object-cover" />
                                <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Прибрати" className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-500">
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                        <button type="button" onClick={pick} className="grid h-16 w-24 place-items-center rounded-lg text-white/50 ring-1 ring-white/15 ring-dashed hover:bg-white/5">
                            <ImagePlus size={18} />
                        </button>
                    </div>
                </Field>
                <div className="flex justify-end gap-2 pt-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button tone="primary" disabled={busy || (config.require_proof && files.length === 0) || (forWho === 'friend' && !friend)} onClick={() => void submit()}>
                        Надіслати
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

type Cashout = { id: number; amount: number; status: string; note: string | null; member: { id: number; display: string; balance: number }; created_at: string };
type Queue = { reports: Report[]; cashouts: Cashout[]; contract_limit: number };

/** Перевірка: звіти з доказами (схвалити з винагородою / відхилити, масово) і заявки на виведення. */
export function FamilyQueue({ slug, shell, reloadShell }: FamilyTabProps) {
    const page = useSite<Queue>(`/f/${slug}/queue`);
    const { run, busy } = useAction();
    const [selected, setSelected] = useState<number[]>([]);
    const [review, setReview] = useState<{ report: Report; decision: 'approve' | 'reject' } | null>(null);
    const [zoom, setZoom] = useState<string | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const done = async (): Promise<void> => {
        setSelected([]);
        await page.reload();
        await reloadShell();
    };
    const { reports, cashouts } = page.data;
    return (
        <div className="space-y-5">
            {shell.can['reports.review'] && (
                <Card
                    title={`Звіти на перевірці (${reports.length})`}
                    actions={
                        selected.length > 0 && (
                            <Button small tone="ok" disabled={busy} onClick={() => void run('POST', `/f/${slug}/reports/bulk`, { ids: selected }, `Схвалено звітів: ${selected.length}`, done)}>
                                <Check size={13} /> Схвалити вибрані ({selected.length})
                            </Button>
                        )
                    }
                >
                    {reports.length === 0 && <p className="text-sm text-white/45">Черга порожня.</p>}
                    <div className="space-y-3">
                        {reports.map((r) => (
                            <div key={r.id} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                                <div className="flex items-start gap-3">
                                    <input type="checkbox" className="mt-1 accent-[#22d3ee]" checked={selected.includes(r.id)} disabled={r.self_review} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                                    <Avatar user={{ name: r.submitter?.display, avatar_url: r.submitter?.avatar_url }} size={32} />
                                    <div className="min-w-0 flex-1 text-sm">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="font-semibold">#{r.id} {r.type_label}</span>
                                            <span className="text-white/60">{r.submitter?.display}</span>
                                            {r.for_friend && <span className="text-white/45">за {r.beneficiary?.display}</span>}
                                            <span className="text-white/45">{when(r.event_date, false)}</span>
                                            {r.deadline && <span className="text-amber-300/80">до {when(r.deadline)}</span>}
                                        </div>
                                        <p className="text-white/70">{details(r)}</p>
                                        {r.description && <p className="text-white/55">{r.description}</p>}
                                        {r.history && <p className="text-[11px] text-white/35">Раніше: схвалено {r.history.approved}, відхилено {r.history.rejected}</p>}
                                        {r.flags && Object.keys(r.flags).length > 0 && <p className="text-[11px] text-amber-300">⚠ Схожі звіти — перевірте уважно</p>}
                                    </div>
                                    <div className="flex shrink-0 flex-col gap-1.5">
                                        <Button small tone="ok" disabled={r.self_review} onClick={() => setReview({ report: r, decision: 'approve' })}>
                                            Схвалити
                                        </Button>
                                        <Button small tone="danger" disabled={r.self_review} onClick={() => setReview({ report: r, decision: 'reject' })}>
                                            Відхилити
                                        </Button>
                                    </div>
                                </div>
                                {r.proofs.length > 0 && (
                                    <div className="mt-2 flex gap-2 overflow-x-auto pl-14">
                                        {r.proofs.map((p) => (
                                            <PrivateImage key={p.id} src={p.url} onClick={setZoom} className="h-24 w-40 shrink-0 rounded-lg object-cover" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            {shell.can['treasury.manage'] && (
                <Card title={`Заявки на виведення (${cashouts.length})`}>
                    {cashouts.length === 0 && <p className="text-sm text-white/45">Заявок немає.</p>}
                    {cashouts.map((c) => (
                        <CashoutRow key={c.id} slug={slug} cashout={c} onDone={done} />
                    ))}
                </Card>
            )}
            {review && <ReviewModal slug={slug} {...review} onClose={() => setReview(null)} onDone={async () => (setReview(null), await done())} />}
            {zoom && <Zoom src={zoom} onClose={() => setZoom(null)} />}
        </div>
    );
}

export function CashoutRow({ slug, cashout: c, onDone }: { slug: string; cashout: Cashout; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [comment, setComment] = useState('');
    const pay = (): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const f = input.files?.[0];
            const files = f ? [{ field: 'proof', name: f.name, type: f.type, data: await f.arrayBuffer() }] : [];
            await run('POST', `/f/${slug}/bank/cashouts/${c.id}/pay`, { __form: true, fields: { comment }, files }, 'Виплату підтверджено.', onDone);
        };
        if (window.confirm('Додати скріншот переказу? «Скасувати» — підтвердити без скріншота.')) input.click();
        else void run('POST', `/f/${slug}/bank/cashouts/${c.id}/pay`, { comment }, 'Виплату підтверджено.', onDone);
    };
    return (
        <div className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
            <span className="min-w-0 flex-1">
                <span className="font-semibold">{c.member.display}</span> просить <span className="text-neon-cyan">{money(c.amount)}</span>
                <span className="block text-xs text-white/45">
                    баланс {money(c.member.balance)} · {when(c.created_at)} {c.note ? `· ${c.note}` : ''}
                </span>
            </span>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Коментар" className="!w-40" />
            <Button small tone="ok" disabled={busy} onClick={pay}>
                Виплачено
            </Button>
            <Button small tone="danger" disabled={busy} onClick={() => void run('POST', `/f/${slug}/bank/cashouts/${c.id}/cancel`, { reason: comment || null }, 'Заявку скасовано.', onDone)}>
                Скасувати
            </Button>
        </div>
    );
}

function ReviewModal({ slug, report, decision, onClose, onDone }: { slug: string; report: Report; decision: 'approve' | 'reject'; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [comment, setComment] = useState('');
    const [reward, setReward] = useState(report.reward !== null ? String(report.reward) : '');
    return (
        <Modal title={`${decision === 'approve' ? 'Схвалити' : 'Відхилити'} звіт #${report.id}`} onClose={onClose}>
            <div className="space-y-3">
                {decision === 'approve' && (
                    <Field label="Винагорода" hint="Порожньо — за ставками сім’ї">
                        <Input type="number" min={0} value={reward} onChange={(e) => setReward(e.target.value)} />
                    </Field>
                )}
                <Field label={decision === 'reject' ? 'Причина' : 'Коментар'}>
                    <TextArea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button
                        tone={decision === 'approve' ? 'ok' : 'danger'}
                        disabled={busy}
                        onClick={() => void run('POST', `/f/${slug}/reports/${report.id}/review`, { decision, comment: comment || null, reward: reward === '' ? null : Number(reward) }, undefined, onDone)}
                    >
                        {decision === 'approve' ? 'Схвалити' : 'Відхилити'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
