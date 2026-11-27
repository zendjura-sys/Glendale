import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Modal, Select, TextArea, money, useAction, useSite, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import type { FamilyTabProps } from './FamilyPage';
import type { Member, Roster } from './types';

type Event = { id: number; title: string; type: string; type_label: string; description: string | null; starts_at: string; points: number; reward: number | null; status: string; creator?: string | null; capacity: number | null; seats: number | null; waitlist_count: number; my_status: string | null; checkin_open: boolean; checkin_code?: string | null; going: { id: number; display: string }[]; declined_count: number };
type EventsPage = { events: Event[]; types: Record<string, string>; roster: Roster; default_points: number };

/** Події: запис «Піду / Не піду», відмітка кодом, створення й закриття з присутніми (для організаторів). */
export function FamilyEvents({ slug, shell }: FamilyTabProps) {
    const page = useSite<EventsPage>(`/f/${slug}/events`);
    const { run, busy } = useAction();
    const [create, setCreate] = useState(false);
    const [closing, setClosing] = useState<Event | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const manage = !!shell.can['events.manage'];
    const reload = page.reload;
    return (
        <div className="space-y-3">
            {manage && (
                <div className="flex justify-end">
                    <Button tone="primary" onClick={() => setCreate(true)}>
                        <Plus size={15} /> Нова подія
                    </Button>
                </div>
            )}
            {page.data.events.length === 0 && <p className="py-10 text-center text-sm text-white/45">Подій поки немає.</p>}
            {page.data.events.map((e) => (
                <Card key={e.id}>
                    <div className="flex items-start gap-4">
                        <div className="w-16 shrink-0 rounded-xl bg-neon-violet/15 py-2 text-center">
                            <div className="text-lg font-bold">{new Date(e.starts_at).getDate()}</div>
                            <div className="text-[11px] text-white/60">{new Date(e.starts_at).toLocaleString('uk-UA', { month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                            <div className="flex flex-wrap gap-2">
                                <span className="font-semibold">{e.title}</span>
                                <span className="text-white/50">{e.type_label}</span>
                                {e.status !== 'planned' && <span className="text-white/40">· {e.status === 'done' ? 'завершено' : e.status}</span>}
                            </div>
                            {e.description && <p className="mt-1 text-white/60">{e.description}</p>}
                            <p className="mt-1 text-xs text-white/45">
                                {e.points} балів{e.reward ? ` · ${money(e.reward)}` : ''} · йдуть {e.going.length}
                                {e.capacity ? ` з ${e.capacity}` : ''}
                                {e.waitlist_count ? ` · у черзі ${e.waitlist_count}` : ''} · не підуть {e.declined_count}
                            </p>
                            {e.going.length > 0 && <p className="mt-1 truncate text-xs text-white/55">{e.going.map((g) => g.display).join(', ')}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                            {e.status === 'planned' && (
                                <>
                                    {e.my_status === 'going' ? (
                                        <Button small disabled={busy} onClick={() => void run('POST', `/f/${slug}/events/${e.id}/rsvp`, { going: false }, 'Ви не підете.', reload)}>
                                            Не піду
                                        </Button>
                                    ) : (
                                        <Button small tone="ok" disabled={busy} onClick={() => void run('POST', `/f/${slug}/events/${e.id}/rsvp`, { going: true }, 'Записано!', reload)}>
                                            Піду
                                        </Button>
                                    )}
                                    {e.checkin_open && (
                                        <Button
                                            small
                                            onClick={() => {
                                                const code = window.prompt('Код відмітки з події');
                                                if (code) void run('POST', `/f/${slug}/events/${e.id}/checkin`, { code }, 'Вас відмічено.', reload);
                                            }}
                                        >
                                            Відмітитися
                                        </Button>
                                    )}
                                    {manage && (
                                        <Button small onClick={() => setClosing(e)}>
                                            Закрити
                                        </Button>
                                    )}
                                    {manage && e.checkin_code && <span className="text-center text-[11px] text-white/45">код {e.checkin_code}</span>}
                                </>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
            {create && <NewEvent slug={slug} page={page.data} onClose={() => setCreate(false)} onDone={async () => (setCreate(false), await reload())} />}
            {closing && <CloseEvent slug={slug} event={closing} roster={page.data.roster} onClose={() => setClosing(null)} onDone={async () => (setClosing(null), await reload())} />}
        </div>
    );
}

function NewEvent({ slug, page, onClose, onDone }: { slug: string; page: EventsPage; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [f, setF] = useState({ title: '', type: Object.keys(page.types)[0] ?? 'meeting', description: '', starts_at: '', points: String(page.default_points), reward: '', capacity: '', weekly: false });
    return (
        <Modal title="Нова подія" onClose={onClose}>
            <div className="space-y-3">
                <Field label="Назва">
                    <Input value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Тип">
                        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                            {Object.entries(page.types).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Початок">
                        <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
                    </Field>
                    <Field label="Бали за участь">
                        <Input type="number" min={0} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} />
                    </Field>
                    <Field label="Винагорода, $">
                        <Input type="number" min={0} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />
                    </Field>
                    <Field label="Місць (необовʼязково)">
                        <Input type="number" min={2} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
                    </Field>
                    <label className="mt-6 flex items-center gap-2 text-sm">
                        <input type="checkbox" className="accent-[#22d3ee]" checked={f.weekly} onChange={(e) => setF({ ...f, weekly: e.target.checked })} /> Щотижня
                    </label>
                </div>
                <Field label="Опис">
                    <TextArea value={f.description} maxLength={1000} onChange={(e) => setF({ ...f, description: e.target.value })} />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button
                        tone="primary"
                        disabled={busy || !f.title || !f.starts_at}
                        onClick={() =>
                            void run(
                                'POST',
                                `/f/${slug}/events`,
                                { ...f, starts_at: new Date(f.starts_at).toISOString(), points: Number(f.points), reward: f.reward ? Number(f.reward) : null, capacity: f.capacity ? Number(f.capacity) : null, description: f.description || null },
                                'Подію створено.',
                                onDone,
                            )
                        }
                    >
                        Створити
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

function CloseEvent({ slug, event, roster, onClose, onDone }: { slug: string; event: Event; roster: Roster; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [attended, setAttended] = useState<number[]>(event.going.map((g) => g.id));
    return (
        <Modal title={`Закрити «${event.title}»`} onClose={onClose}>
            <p className="mb-2 text-sm text-white/60">Відмітьте, хто був — їм нарахуються бали й винагорода.</p>
            <div className="grid max-h-80 grid-cols-2 gap-1 overflow-y-auto">
                {roster.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/5">
                        <input type="checkbox" className="accent-[#22d3ee]" checked={attended.includes(m.id)} onChange={(e) => setAttended((a) => (e.target.checked ? [...a, m.id] : a.filter((x) => x !== m.id)))} />
                        {m.display}
                    </label>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <Button tone="danger" disabled={busy} onClick={() => void run('POST', `/f/${slug}/events/${event.id}/close`, { attended: [], cancelled: true }, 'Подію скасовано.', onDone)}>
                    Скасувати подію
                </Button>
                <Button tone="primary" disabled={busy} onClick={() => void run('POST', `/f/${slug}/events/${event.id}/close`, { attended }, 'Подію завершено.', onDone)}>
                    Завершити
                </Button>
            </div>
        </Modal>
    );
}

type RatingPage = { period: string; periods: Record<string, string>; leaderboard: (Member & { points: number; bizwar_wins: number; bizwar_losses: number; contracts: number; invested: number; events: number; earned: number; place: number })[]; season: { number: number; started_at: string; can_end: boolean } | null };

/** Рейтинг: тиждень / місяць / сезон / весь час — бали, бізвари, контракти, інвестиції, події, заробіток. */
export function FamilyRating({ slug }: FamilyTabProps) {
    const [period, setPeriod] = useState('week');
    const page = useSite<RatingPage>(`/f/${slug}/rating?period=${period}`);
    const { run, busy } = useAction();
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <Card
            title={d.season ? `Сезон ${d.season.number}` : 'Рейтинг'}
            actions={
                <div className="flex gap-1">
                    {Object.entries(d.periods).map(([k, v]) => (
                        <Button key={k} small tone={k === period ? 'primary' : 'ghost'} onClick={() => setPeriod(k)}>
                            {v}
                        </Button>
                    ))}
                    {d.season?.can_end && (
                        <Button small tone="danger" disabled={busy} onClick={() => window.confirm('Завершити сезон і почати новий?') && void run('POST', `/f/${slug}/rating/season`, {}, 'Сезон завершено.', page.reload)}>
                            Завершити сезон
                        </Button>
                    )}
                </div>
            }
        >
            <table className="w-full text-sm">
                <thead className="text-xs text-white/45">
                    <tr>
                        <th className="w-8 py-1 text-left font-normal">#</th>
                        <th className="text-left font-normal">Учасник</th>
                        <th className="font-normal">Бали</th>
                        <th className="font-normal">Бізвари</th>
                        <th className="font-normal">Контракти</th>
                        <th className="font-normal">Інвестиції</th>
                        <th className="font-normal">Події</th>
                        <th className="text-right font-normal">Заробив</th>
                    </tr>
                </thead>
                <tbody>
                    {d.leaderboard.map((r) => (
                        <tr key={r.id} className="border-t border-white/5">
                            <td className={`py-2 ${r.place <= 3 ? 'text-amber-300' : 'text-white/45'}`}>{r.place}</td>
                            <td>
                                <span className="flex items-center gap-2">
                                    <Avatar user={{ name: r.display, avatar_url: r.avatar_url }} size={24} />
                                    {r.display}
                                </span>
                            </td>
                            <td className="text-center font-semibold text-neon-cyan">{r.points}</td>
                            <td className="text-center">
                                {r.bizwar_wins}:{r.bizwar_losses}
                            </td>
                            <td className="text-center">{r.contracts}</td>
                            <td className="text-center">{money(r.invested)}</td>
                            <td className="text-center">{r.events}</td>
                            <td className="text-right">{money(r.earned)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}

type Punishment = { id: number; type: string; type_label: string; reason: string; amount: number | null; member: string; member_id: number; issuer: string | null; is_auto: boolean; active: boolean; expires_at: string | null; revoked_at: string | null; revoke_reason: string | null; created_at: string };
type DisciplinePage = { scope: string; punishments: Punishment[]; types: Record<string, string>; mute_hours: number[]; config: { warn_days: number; warn_limit: number; escalation: string }; roster: (Roster[number] & { warns: number })[]; my_warns: number };

/** Дисципліна: мої стягнення; для тих, хто має право, — видати (варн, догана, штраф, мут, виключення) і зняти. */
export function FamilyDiscipline({ slug, shell }: FamilyTabProps) {
    const issuer = !!shell.can['sanctions.issue'];
    const [scope, setScope] = useState(issuer ? 'family' : 'me');
    const page = useSite<DisciplinePage>(`/f/${slug}/discipline?scope=${scope}`);
    const { run, busy } = useAction();
    const [f, setF] = useState({ member_id: '', type: 'warn', reason: '', amount: '', hours: '' });
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="space-y-4">
            <p className="text-sm text-white/60">
                Мої варни: <b className={d.my_warns ? 'text-rose-300' : ''}>{d.my_warns}</b> з {d.config.warn_limit} · варн згорає через {d.config.warn_days} дн. · на ліміті — {d.config.escalation === 'kick' ? 'виключення' : 'пониження в ранзі'}
            </p>
            {issuer && (
                <Card title="Видати стягнення">
                    <div className="grid grid-cols-[1fr_160px_1fr_auto] items-end gap-2">
                        <Select value={f.member_id} onChange={(e) => setF({ ...f, member_id: e.target.value })}>
                            <option value="">Учасник…</option>
                            {d.roster.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.display} {m.warns ? `(${m.warns} варн)` : ''}
                                </option>
                            ))}
                        </Select>
                        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                            {Object.entries(d.types).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </Select>
                        <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Причина" />
                        <Button
                            tone="danger"
                            disabled={busy || !f.member_id || f.reason.trim().length < 3}
                            onClick={() => void run('POST', `/f/${slug}/discipline`, { member_id: Number(f.member_id), type: f.type, reason: f.reason, amount: f.type === 'fine' ? Number(f.amount) : null, hours: f.type === 'mute' ? Number(f.hours) : null }, 'Стягнення видано.', page.reload)}
                        >
                            Видати
                        </Button>
                    </div>
                    {f.type === 'fine' && <Input className="mt-2 !w-48" type="number" placeholder="Сума штрафу" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}
                    {f.type === 'mute' && (
                        <Select className="mt-2 !w-48" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })}>
                            <option value="">Тривалість…</option>
                            {d.mute_hours.map((h) => (
                                <option key={h} value={h}>
                                    {h} год
                                </option>
                            ))}
                        </Select>
                    )}
                </Card>
            )}
            <Card
                title="Стягнення"
                actions={
                    issuer && (
                        <div className="flex gap-1">
                            <Button small tone={scope === 'family' ? 'primary' : 'ghost'} onClick={() => setScope('family')}>
                                Уся сім’я
                            </Button>
                            <Button small tone={scope === 'me' ? 'primary' : 'ghost'} onClick={() => setScope('me')}>
                                Мої
                            </Button>
                        </div>
                    )
                }
            >
                {d.punishments.length === 0 && <p className="text-sm text-white/45">Стягнень немає 👌</p>}
                {d.punishments.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0 ${p.active ? '' : 'opacity-50'}`}>
                        <span className="w-24 shrink-0 font-semibold">{p.type_label}</span>
                        <span className="min-w-0 flex-1">
                            {p.member} — {p.reason}
                            {p.amount ? ` · ${money(p.amount)}` : ''}
                            <span className="block text-xs text-white/40">
                                {p.is_auto ? 'автоматично' : p.issuer} · {when(p.created_at)}
                                {p.expires_at ? ` · до ${when(p.expires_at)}` : ''}
                                {p.revoked_at ? ` · знято: ${p.revoke_reason ?? ''}` : ''}
                            </span>
                        </span>
                        {issuer && p.active && (
                            <Button
                                small
                                disabled={busy}
                                onClick={() => {
                                    const reason = window.prompt('Чому знімаєте?');
                                    if (reason && reason.length >= 3) void run('POST', `/f/${slug}/discipline/${p.id}/revoke`, { reason }, 'Стягнення знято.', page.reload);
                                }}
                            >
                                Зняти
                            </Button>
                        )}
                    </div>
                ))}
            </Card>
        </div>
    );
}

type Item = { id: number; category: string; name: string; unit: string | null; quantity: number; hourly_quota: number | null; min_stock: number | null; low: boolean; is_archived: boolean };
type Log = { id: number; item: string; unit: string | null; action: string; action_label: string; quantity: number; quantity_after: number; comment: string | null; is_suspicious: boolean; member: string | null; proof_url: string | null; created_at: string };
type WarehousePage = { items: Item[]; categories: Record<string, string>; logs: Log[]; top_takers: { display: string; total: number }[] };

/** Склад речей: залишки за категоріями, взяти / покласти (зі скріншотом), журнал руху й керування позиціями. */
export function FamilyWarehouse({ slug, shell }: FamilyTabProps) {
    const page = useSite<WarehousePage>(`/f/${slug}/warehouse`);
    const { run, busy } = useAction();
    const [move, setMove] = useState<{ item: Item; action: 'take' | 'put' } | null>(null);
    const [edit, setEdit] = useState<Item | 'new' | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const manage = !!shell.can['warehouse.manage'];
    return (
        <div className="space-y-4">
            {manage && (
                <div className="flex justify-end">
                    <Button tone="primary" onClick={() => setEdit('new')}>
                        <Plus size={15} /> Нова позиція
                    </Button>
                </div>
            )}
            {Object.entries(d.categories).map(([cat, label]) => {
                const items = d.items.filter((i) => i.category === cat && !i.is_archived);
                if (!items.length) return null;
                return (
                    <Card key={cat} title={label}>
                        <div className="divide-y divide-white/5">
                            {items.map((i) => (
                                <div key={i.id} className="flex items-center gap-3 py-2 text-sm">
                                    <span className="min-w-0 flex-1">
                                        {i.name}
                                        {i.hourly_quota ? <span className="text-xs text-white/40"> · квота {i.hourly_quota}/год</span> : null}
                                    </span>
                                    <span className={`w-28 text-right font-semibold ${i.low ? 'text-amber-300' : ''}`}>
                                        {i.quantity} {i.unit ?? ''}
                                    </span>
                                    <Button small onClick={() => setMove({ item: i, action: 'take' })}>
                                        Взяти
                                    </Button>
                                    <Button small onClick={() => setMove({ item: i, action: 'put' })}>
                                        Покласти
                                    </Button>
                                    {manage && (
                                        <Button small onClick={() => setEdit(i)}>
                                            ✎
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                );
            })}
            {d.logs.length > 0 && (
                <Card title="Журнал складу">
                    {d.logs.map((l) => (
                        <div key={l.id} className={`flex gap-3 py-1.5 text-sm ${l.is_suspicious ? 'text-amber-200' : ''}`}>
                            <span className="w-28 shrink-0 text-white/40">{when(l.created_at)}</span>
                            <span className="min-w-0 flex-1 truncate">
                                {l.member} — {l.action_label} {l.quantity} {l.unit ?? ''} «{l.item}»{l.comment ? ` · ${l.comment}` : ''}
                            </span>
                            <span className="text-white/45">залишок {l.quantity_after}</span>
                        </div>
                    ))}
                </Card>
            )}
            {move && (
                <MoveModal
                    {...move}
                    onClose={() => setMove(null)}
                    onSubmit={async (quantity, comment, file) => {
                        const files = file ? [{ field: 'proof', name: file.name, type: file.type, data: await file.arrayBuffer() }] : [];
                        const ok = await run('POST', `/f/${slug}/warehouse/move`, { __form: true, fields: { item_id: move.item.id, action: move.action, quantity, comment }, files }, 'Записано.', page.reload);
                        if (ok) setMove(null);
                    }}
                    busy={busy}
                />
            )}
            {edit && (
                <ItemModal
                    item={edit === 'new' ? null : edit}
                    categories={d.categories}
                    busy={busy}
                    onClose={() => setEdit(null)}
                    onSubmit={async (payload) => {
                        const ok = await run(edit === 'new' ? 'POST' : 'PATCH', edit === 'new' ? `/f/${slug}/warehouse/items` : `/f/${slug}/warehouse/items/${edit.id}`, payload, 'Збережено.', page.reload);
                        if (ok) setEdit(null);
                    }}
                />
            )}
        </div>
    );
}

function MoveModal({ item, action, busy, onClose, onSubmit }: { item: Item; action: 'take' | 'put'; busy: boolean; onClose: () => void; onSubmit: (q: number, comment: string, file: File | null) => Promise<void> }) {
    const [q, setQ] = useState('1');
    const [comment, setComment] = useState('');
    const [file, setFile] = useState<File | null>(null);
    return (
        <Modal title={`${action === 'take' ? 'Взяти' : 'Покласти'}: ${item.name}`} onClose={onClose}>
            <div className="space-y-3">
                <Field label={`Кількість (зараз ${item.quantity} ${item.unit ?? ''})`}>
                    <Input type="number" min={1} value={q} onChange={(e) => setQ(e.target.value)} />
                </Field>
                <Field label="Коментар">
                    <Input value={comment} maxLength={300} onChange={(e) => setComment(e.target.value)} />
                </Field>
                <Field label="Скріншот (необовʼязково)">
                    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button tone="primary" disabled={busy || Number(q) < 1} onClick={() => void onSubmit(Number(q), comment, file)}>
                        Готово
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

function ItemModal({ item, categories, busy, onClose, onSubmit }: { item: Item | null; categories: Record<string, string>; busy: boolean; onClose: () => void; onSubmit: (p: Record<string, unknown>) => Promise<void> }) {
    const [f, setF] = useState({ category: item?.category ?? Object.keys(categories)[0], name: item?.name ?? '', unit: item?.unit ?? 'шт', quantity: String(item?.quantity ?? 0), hourly_quota: item?.hourly_quota ? String(item.hourly_quota) : '', min_stock: item?.min_stock ? String(item.min_stock) : '', is_archived: item?.is_archived ?? false });
    return (
        <Modal title={item ? `Позиція: ${item.name}` : 'Нова позиція'} onClose={onClose}>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Категорія">
                    <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                        {Object.entries(categories).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Назва">
                    <Input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
                </Field>
                <Field label="Одиниця">
                    <Input value={f.unit} maxLength={12} onChange={(e) => setF({ ...f, unit: e.target.value })} />
                </Field>
                <Field label="Кількість">
                    <Input type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
                </Field>
                <Field label="Квота на годину">
                    <Input type="number" min={1} value={f.hourly_quota} onChange={(e) => setF({ ...f, hourly_quota: e.target.value })} />
                </Field>
                <Field label="Мінімальний залишок">
                    <Input type="number" min={0} value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} />
                </Field>
                {item && (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="accent-[#22d3ee]" checked={f.is_archived} onChange={(e) => setF({ ...f, is_archived: e.target.checked })} /> В архіві
                    </label>
                )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <Button onClick={onClose}>Скасувати</Button>
                <Button
                    tone="primary"
                    disabled={busy || !f.name}
                    onClick={() => void onSubmit({ ...f, quantity: Number(f.quantity), hourly_quota: f.hourly_quota ? Number(f.hourly_quota) : null, min_stock: f.min_stock ? Number(f.min_stock) : null, ...(item ? {} : { is_archived: undefined }) })}
                >
                    Зберегти
                </Button>
            </div>
        </Modal>
    );
}
