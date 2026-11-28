import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Modal, Select, TextArea, useAction, useSite, when } from '@/components/kit';
import type { FamilyTabProps } from './FamilyPage';
import type { Roster } from './types';

/** Простий Markdown (# заголовки, списки, абзаци) — як статут і вікі на сайті. */
export function Markdown({ text }: { text: string }) {
    return (
        <div className="space-y-2 text-sm leading-relaxed text-white/80">
            {text.split(/\r?\n/).map((line, i) => {
                const h = line.match(/^(#{1,3})\s+(.*)$/);
                if (h) return <h3 key={i} className={`${h[1].length === 1 ? 'text-lg' : 'text-base'} pt-2 font-semibold text-white`}>{h[2]}</h3>;
                if (/^\s*[-*]\s+/.test(line)) return <p key={i} className="pl-4">• {line.replace(/^\s*[-*]\s+/, '')}</p>;
                return line.trim() ? <p key={i}>{line}</p> : null;
            })}
        </div>
    );
}

type Quiz = { q: string; options: string[]; correct: number }[];
type CharterPage = { text: string | null; quiz: { q: string; options: string[] }[]; pass: number; passed?: boolean; edit?: { text: string; quiz: Quiz; pass: number } | null };

/** Статут: текст і тест на знання; лідер редагує текст, питання й прохідний бал. */
export function FamilyCharter({ slug, shell }: FamilyTabProps) {
    const page = useSite<CharterPage>(`/f/${slug}/charter`);
    const [editing, setEditing] = useState(false);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const canEdit = !!shell.can['settings.manage'] && !!d.edit;
    return (
        <div className="space-y-4">
            {canEdit && (
                <div className="flex justify-end">
                    <Button onClick={() => setEditing(true)}>Редагувати статут</Button>
                </div>
            )}
            <Card>{d.text ? <Markdown text={d.text} /> : <p className="text-sm text-white/45">Статут ще не написано.</p>}</Card>
            {d.quiz.length > 0 && <p className="text-xs text-white/45">Новачки проходять тест зі статуту ({d.quiz.length} питань, прохідний бал {d.pass}%) під час вступу.</p>}
            {editing && d.edit && <CharterEditor slug={slug} edit={d.edit} onClose={() => setEditing(false)} onDone={async () => (setEditing(false), await page.reload())} />}
        </div>
    );
}

function CharterEditor({ slug, edit, onClose, onDone }: { slug: string; edit: { text: string; quiz: Quiz; pass: number }; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [text, setText] = useState(edit.text);
    const [quiz, setQuiz] = useState<Quiz>(edit.quiz);
    const [pass, setPass] = useState(String(edit.pass));
    const upd = (i: number, patch: Partial<Quiz[number]>): void => setQuiz((q) => q.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    return (
        <Modal title="Статут" onClose={onClose} wide>
            <div className="space-y-3">
                <TextArea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="# Розділ&#10;Правила…" />
                <Button
                    small
                    disabled={busy}
                    onClick={() =>
                        void (async () => {
                            const res = await window.gamecon.request<{ text?: string }>('POST', `/api/v1/site/f/${slug}/ai/charter`, { description: text });
                            if (res.ok && res.data.text) setText(res.data.text);
                        })()
                    }
                >
                    ✨ Скласти з ШІ за описом
                </Button>
                <h3 className="pt-2 text-sm font-semibold">Тест</h3>
                {quiz.map((q, i) => (
                    <div key={i} className="space-y-1.5 rounded-xl bg-white/[0.03] p-3">
                        <div className="flex gap-2">
                            <Input value={q.q} placeholder="Питання" onChange={(e) => upd(i, { q: e.target.value })} />
                            <button type="button" onClick={() => setQuiz((x) => x.filter((_, j) => j !== i))} aria-label="Видалити питання" className="text-white/50 hover:text-rose-300">
                                <Trash2 size={15} />
                            </button>
                        </div>
                        {q.options.map((o, j) => (
                            <div key={j} className="flex items-center gap-2">
                                <input type="radio" className="accent-[#22d3ee]" checked={q.correct === j} onChange={() => upd(i, { correct: j })} title="Правильна відповідь" />
                                <Input value={o} placeholder={`Варіант ${j + 1}`} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
                            </div>
                        ))}
                        {q.options.length < 4 && (
                            <Button small onClick={() => upd(i, { options: [...q.options, ''] })}>
                                + варіант
                            </Button>
                        )}
                    </div>
                ))}
                <div className="flex items-center gap-3">
                    <Button small onClick={() => setQuiz((x) => [...x, { q: '', options: ['', ''], correct: 0 }])}>
                        <Plus size={13} /> Питання
                    </Button>
                    <span className="text-sm text-white/60">Прохідний бал, %</span>
                    <Input type="number" min={50} max={100} value={pass} onChange={(e) => setPass(e.target.value)} className="!w-24" />
                </div>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button tone="primary" disabled={busy} onClick={() => void run('PUT', `/f/${slug}/settings/charter`, { text, quiz, pass: Number(pass) }, 'Статут збережено.', onDone)}>
                        Зберегти
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

type WikiPage = { pages: { slug: string; title: string }[]; page: { slug: string; title: string; body: string | null; updated_at: string; editor: string | null } | null; can_edit: boolean };

/** Вікі сім’ї: сторінки з інструкціями (гайди, маршрути, правила бізварів), редагування й видалення. */
export function FamilyWiki({ slug }: FamilyTabProps) {
    const [current, setCurrent] = useState<string | null>(null);
    const page = useSite<WikiPage>(`/f/${slug}/wiki${current ? `/${current}` : ''}`);
    const { run, busy } = useAction();
    const [edit, setEdit] = useState<{ slug: string | null; title: string; body: string } | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="grid grid-cols-[240px_1fr] gap-4">
            <Card title="Сторінки" actions={d.can_edit && <Button small onClick={() => setEdit({ slug: null, title: '', body: '' })}>+ Нова</Button>}>
                {d.pages.length === 0 && <p className="text-sm text-white/45">Порожньо.</p>}
                {d.pages.map((p) => (
                    <button key={p.slug} type="button" onClick={() => setCurrent(p.slug)} className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${p.slug === (d.page?.slug ?? current) ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                        {p.title}
                    </button>
                ))}
            </Card>
            <Card
                title={d.page?.title ?? 'Вікі'}
                actions={
                    d.page &&
                    d.can_edit && (
                        <div className="flex gap-1">
                            <Button small onClick={() => setEdit({ slug: d.page!.slug, title: d.page!.title, body: d.page!.body ?? '' })}>
                                Редагувати
                            </Button>
                            <Button small tone="danger" disabled={busy} onClick={() => window.confirm('Видалити сторінку?') && void run('DELETE', `/f/${slug}/wiki/${d.page!.slug}`, undefined, 'Сторінку видалено.', async () => (setCurrent(null), await page.reload()))}>
                                Видалити
                            </Button>
                        </div>
                    )
                }
            >
                {d.page ? (
                    <>
                        <Markdown text={d.page.body ?? ''} />
                        <p className="mt-4 text-[11px] text-white/35">
                            Оновлено {when(d.page.updated_at)} {d.page.editor ? `· ${d.page.editor}` : ''}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-white/45">Оберіть сторінку ліворуч.</p>
                )}
            </Card>
            {edit && (
                <Modal title={edit.slug ? 'Редагувати сторінку' : 'Нова сторінка'} onClose={() => setEdit(null)} wide>
                    <div className="space-y-3">
                        <Input value={edit.title} maxLength={120} placeholder="Назва" onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                        <TextArea rows={14} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setEdit(null)}>Скасувати</Button>
                            <Button tone="primary" disabled={busy || !edit.title} onClick={() => void run('POST', `/f/${slug}/wiki`, edit, 'Збережено.', async () => (setEdit(null), await page.reload()))}>
                                Зберегти
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

type Relation = { id: number; type: 'alliance' | 'war'; status: string; incoming: boolean; note: string | null; family: { id: number; slug: string; name: string; tag: string | null; logo_url: string | null }; started_at: string | null; ended_at: string | null; created_at: string };
type RelationsPage = { relations: Relation[]; can_manage: boolean; candidates: { id: number; name: string; tag: string | null }[] };

/** Союзи й війни з іншими сім’ями: пропозиції, відповіді, завершення. */
export function FamilyRelations({ slug }: FamilyTabProps) {
    const page = useSite<RelationsPage>(`/f/${slug}/relations`);
    const { run, busy } = useAction();
    const [f, setF] = useState({ type: 'alliance', other_family_id: '', note: '' });
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="space-y-4">
            {d.can_manage && (
                <Card title="Запропонувати">
                    <div className="grid grid-cols-[140px_1fr_1fr_auto] gap-2">
                        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                            <option value="alliance">Союз</option>
                            <option value="war">Війна</option>
                        </Select>
                        <Select value={f.other_family_id} onChange={(e) => setF({ ...f, other_family_id: e.target.value })}>
                            <option value="">Сім’я…</option>
                            {d.candidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.tag ? `[${c.tag}] ` : ''}
                                    {c.name}
                                </option>
                            ))}
                        </Select>
                        <Input value={f.note} maxLength={300} placeholder="Повідомлення" onChange={(e) => setF({ ...f, note: e.target.value })} />
                        <Button tone="primary" disabled={busy || !f.other_family_id} onClick={() => void run('POST', `/f/${slug}/relations`, { ...f, other_family_id: Number(f.other_family_id), note: f.note || null }, 'Пропозицію надіслано.', page.reload)}>
                            Надіслати
                        </Button>
                    </div>
                </Card>
            )}
            <Card title="Стосунки">
                {d.relations.length === 0 && <p className="text-sm text-white/45">Ні союзів, ні воєн.</p>}
                {d.relations.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                        <span className={`w-16 font-semibold ${r.type === 'war' ? 'text-rose-300' : 'text-emerald-300'}`}>{r.type === 'war' ? 'Війна' : 'Союз'}</span>
                        <span className="min-w-0 flex-1">
                            {r.family.tag ? `[${r.family.tag}] ` : ''}
                            {r.family.name}
                            <span className="block text-xs text-white/45">
                                {r.status === 'pending' ? (r.incoming ? 'Пропонують вам' : 'Чекаємо відповіді') : r.status === 'active' ? `з ${when(r.started_at, false)}` : `завершено ${when(r.ended_at, false)}`}
                                {r.note ? ` · ${r.note}` : ''}
                            </span>
                        </span>
                        {d.can_manage && r.status === 'pending' && r.incoming && (
                            <>
                                <Button small tone="ok" disabled={busy} onClick={() => void run('POST', `/f/${slug}/relations/${r.id}/respond`, { accept: true }, 'Прийнято.', page.reload)}>
                                    Прийняти
                                </Button>
                                <Button small tone="danger" disabled={busy} onClick={() => void run('POST', `/f/${slug}/relations/${r.id}/respond`, { accept: false }, 'Відхилено.', page.reload)}>
                                    Відхилити
                                </Button>
                            </>
                        )}
                        {d.can_manage && (r.status === 'active' || (r.status === 'pending' && !r.incoming)) && (
                            <Button small disabled={busy} onClick={() => void run('POST', `/f/${slug}/relations/${r.id}/end`, {}, 'Завершено.', page.reload)}>
                                {r.status === 'active' ? 'Завершити' : 'Скасувати'}
                            </Button>
                        )}
                    </div>
                ))}
            </Card>
        </div>
    );
}

type HistoryPage = { events: { at: string; kind: string; text: string }[]; achievements: { key: string; title: string; progress: number; target: number; done: boolean }[]; totals: { reports: number; wins: number; contracts: number; days: number } };

/** Історія сім’ї: віхи, досягнення й підсумки за весь час. */
export function FamilyHistory({ slug }: FamilyTabProps) {
    const page = useSite<HistoryPage>(`/f/${slug}/history`);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="grid grid-cols-[1fr_320px] gap-4">
            <Card title="Хроніка">
                <ol className="relative space-y-3 border-l border-white/10 pl-4">
                    {d.events.map((e, i) => (
                        <li key={i} className="text-sm">
                            <span className="absolute -left-1 mt-1.5 h-2 w-2 rounded-full bg-neon-violet" />
                            <span className="text-white/40">{when(e.at, false)}</span> — {e.text}
                        </li>
                    ))}
                </ol>
            </Card>
            <div className="space-y-4">
                <Card title="Разом">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <span>Днів: {d.totals.days}</span>
                        <span>Звітів: {d.totals.reports}</span>
                        <span>Перемог: {d.totals.wins}</span>
                        <span>Контрактів: {d.totals.contracts}</span>
                    </div>
                </Card>
                <Card title="Досягнення">
                    {d.achievements.map((a) => (
                        <div key={a.key} className="mb-2 text-sm">
                            <div className="flex">
                                <span className={`flex-1 ${a.done ? 'text-amber-300' : ''}`}>
                                    {a.done ? '🏆 ' : ''}
                                    {a.title}
                                </span>
                                <span className="text-white/45">
                                    {a.progress}/{a.target}
                                </span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-amber-300/80" style={{ width: `${Math.min(100, (a.progress / Math.max(1, a.target)) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}

type AuditPage = { logs: { data: { id: number; action: string; action_label: string; actor: string | null; target: string | null; details: Record<string, unknown> | null; created_at: string }[]; current_page: number; last_page: number }; actions: Record<string, string>; action: string | null };

/** Журнал дій: хто що зробив (фільтр за дією, сторінки). */
export function FamilyAudit({ slug }: FamilyTabProps) {
    const [action, setAction] = useState('');
    const [p, setP] = useState(1);
    const page = useSite<AuditPage>(`/f/${slug}/audit?page=${p}${action ? `&action=${action}` : ''}`);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <Card
            title="Журнал дій"
            actions={
                <Select value={action} onChange={(e) => (setAction(e.target.value), setP(1))} className="!w-64">
                    <option value="">Усі дії</option>
                    {Object.entries(d.actions).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </Select>
            }
        >
            {d.logs.data.map((l) => (
                <div key={l.id} className="flex gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                    <span className="w-28 shrink-0 text-white/40">{when(l.created_at)}</span>
                    <span className="min-w-0 flex-1">
                        <b>{l.actor ?? 'Система'}</b> — {l.action_label}
                        {l.target ? ` → ${l.target}` : ''}
                        {l.details && Object.keys(l.details).length > 0 && (
                            <span className="block truncate text-xs text-white/40">
                                {Object.entries(l.details)
                                    .filter(([, v]) => v !== null && typeof v !== 'object')
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(' · ')}
                            </span>
                        )}
                    </span>
                </div>
            ))}
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                <Button small disabled={p <= 1} onClick={() => setP(p - 1)}>
                    ←
                </Button>
                {d.logs.current_page} / {d.logs.last_page}
                <Button small disabled={p >= d.logs.last_page} onClick={() => setP(p + 1)}>
                    →
                </Button>
            </div>
        </Card>
    );
}

type Shift = { id: number; title: string; note: string | null; starts_at: string; ends_at: string; member: { id: number; display: string } | null; mine: boolean; partners: { id: number; member_id: number; display: string; status: string; me: boolean }[]; goal: { label: string; count: number; progress: number; done: boolean; missed?: boolean } | null; can_lead: boolean; can_join: boolean };
type ShiftsPage = { week: { offset: number; start: string }; shifts: Shift[]; roster: Roster; rules: { self_claim: boolean; week_limit: number; remind: boolean }; goal_types: Record<string, string>; tiers: Record<string, string>; my_week: unknown };

/** Зміни: тиждень, взяти / звільнити / приєднатися, ціль зміни; для організаторів — створити й призначити. */
export function FamilyShifts({ slug, shell }: FamilyTabProps) {
    const [offset, setOffset] = useState(0);
    const page = useSite<ShiftsPage>(`/f/${slug}/shifts?week=${offset}`);
    const { run, busy } = useAction();
    const [create, setCreate] = useState(false);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const manage = !!shell.can['events.manage'];
    const act = (s: Shift, what: string, body: Record<string, unknown> = {}): void => void run('POST', `/f/${slug}/shifts/${s.id}/${what}`, body, undefined, page.reload);
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Button small onClick={() => setOffset(offset - 1)}>
                    ←
                </Button>
                <span className="text-sm">Тиждень з {when(d.week.start, false)}</span>
                <Button small onClick={() => setOffset(offset + 1)}>
                    →
                </Button>
                <div className="flex-1" />
                {manage && (
                    <Button tone="primary" onClick={() => setCreate(true)}>
                        <Plus size={15} /> Нова зміна
                    </Button>
                )}
            </div>
            {d.shifts.length === 0 && <p className="py-10 text-center text-sm text-white/45">На цей тиждень змін немає.</p>}
            {d.shifts.map((s) => (
                <Card key={s.id}>
                    <div className="flex items-start gap-3 text-sm">
                        <div className="w-32 shrink-0 text-white/60">
                            {when(s.starts_at)}
                            <br />— {new Date(s.ends_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold">{s.title}</div>
                            {s.note && <p className="text-white/55">{s.note}</p>}
                            <p className="text-white/60">Відповідальний: {s.member?.display ?? 'вільно'}</p>
                            {s.partners.length > 0 && <p className="text-xs text-white/45">Разом: {s.partners.map((p) => `${p.display}${p.status === 'pending' ? ' (чекає)' : ''}`).join(', ')}</p>}
                            {s.goal && (
                                <p className={`text-xs ${s.goal.done ? 'text-emerald-300' : s.goal.missed ? 'text-rose-300' : 'text-white/55'}`}>
                                    Ціль: {s.goal.label} — {s.goal.progress}/{s.goal.count}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                            {!s.member && d.rules.self_claim && (
                                <Button small tone="ok" disabled={busy} onClick={() => act(s, 'claim')}>
                                    Взяти
                                </Button>
                            )}
                            {s.mine && (
                                <Button small disabled={busy} onClick={() => act(s, 'release')}>
                                    Звільнити
                                </Button>
                            )}
                            {s.can_join && (
                                <Button small disabled={busy} onClick={() => act(s, 'join')}>
                                    Приєднатися
                                </Button>
                            )}
                            {s.partners.some((p) => p.me) && (
                                <Button small disabled={busy} onClick={() => act(s, 'leave')}>
                                    Вийти
                                </Button>
                            )}
                            {s.can_lead &&
                                s.partners
                                    .filter((p) => p.status === 'pending')
                                    .map((p) => (
                                        <Button key={p.id} small tone="ok" disabled={busy} onClick={() => act(s, `partners/${p.id}`, { accept: true })}>
                                            Прийняти {p.display}
                                        </Button>
                                    ))}
                            {manage && (
                                <Select
                                    value=""
                                    onChange={(e) => e.target.value && act(s, 'assign', { member_id: Number(e.target.value) })}
                                    className="!w-40 !py-1 text-xs"
                                >
                                    <option value="">Призначити…</option>
                                    {d.roster.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.display}
                                        </option>
                                    ))}
                                </Select>
                            )}
                            {manage && (
                                <Button small tone="danger" disabled={busy} onClick={() => window.confirm('Видалити зміну?') && void run('DELETE', `/f/${slug}/shifts/${s.id}`, undefined, 'Зміну видалено.', page.reload)}>
                                    Видалити
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
            {create && <NewShift slug={slug} page={d} onClose={() => setCreate(false)} onDone={async () => (setCreate(false), await page.reload())} />}
        </div>
    );
}

function NewShift({ slug, page, onClose, onDone }: { slug: string; page: ShiftsPage; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [f, setF] = useState({ title: '', note: '', starts_at: '', hours: '2', member_id: '', repeat_weeks: '', goal_type: '', goal_tier: '', goal_count: '' });
    return (
        <Modal title="Нова зміна" onClose={onClose}>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Назва">
                    <Input value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} />
                </Field>
                <Field label="Початок">
                    <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
                </Field>
                <Field label="Годин">
                    <Input type="number" min={0.5} max={24} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
                </Field>
                <Field label="Відповідальний">
                    <Select value={f.member_id} onChange={(e) => setF({ ...f, member_id: e.target.value })}>
                        <option value="">Вільна зміна</option>
                        {page.roster.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.display}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Повторювати тижнів">
                    <Input type="number" min={1} max={8} value={f.repeat_weeks} onChange={(e) => setF({ ...f, repeat_weeks: e.target.value })} />
                </Field>
                <Field label="Ціль">
                    <Select value={f.goal_type} onChange={(e) => setF({ ...f, goal_type: e.target.value })}>
                        <option value="">Без цілі</option>
                        {Object.entries(page.goal_types).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </Select>
                </Field>
                {f.goal_type === 'contract' && (
                    <Field label="Рівень контракту">
                        <Select value={f.goal_tier} onChange={(e) => setF({ ...f, goal_tier: e.target.value })}>
                            <option value="">Будь-який</option>
                            {Object.entries(page.tiers).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </Select>
                    </Field>
                )}
                {f.goal_type && (
                    <Field label="Скільки">
                        <Input type="number" min={1} value={f.goal_count} onChange={(e) => setF({ ...f, goal_count: e.target.value })} />
                    </Field>
                )}
            </div>
            <Field label="Нотатка">
                <Input value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
                <Button onClick={onClose}>Скасувати</Button>
                <Button
                    tone="primary"
                    disabled={busy || !f.title || !f.starts_at}
                    onClick={() =>
                        void run(
                            'POST',
                            `/f/${slug}/shifts`,
                            {
                                title: f.title,
                                note: f.note || null,
                                starts_at: new Date(f.starts_at).toISOString(),
                                hours: Number(f.hours),
                                member_id: f.member_id ? Number(f.member_id) : null,
                                repeat_weeks: f.repeat_weeks ? Number(f.repeat_weeks) : null,
                                goal_type: f.goal_type || null,
                                goal_tier: f.goal_tier || null,
                                goal_count: f.goal_count ? Number(f.goal_count) : null,
                            },
                            'Зміну створено.',
                            onDone,
                        )
                    }
                >
                    Створити
                </Button>
            </div>
        </Modal>
    );
}
