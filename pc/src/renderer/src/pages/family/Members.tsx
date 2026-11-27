import { Search, Settings2, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Modal, Select, TextArea, money, useAction, useSite, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import type { FamilyTabProps } from './FamilyPage';
import type { Member } from './types';

type Application = Member & { note: string | null; applied_at: string; answers: { question: string; answer: string }[] };
type MembersPage = { members: Member[]; applications: Application[]; permissions: Record<string, string>; voice_rooms: Record<string, string>; matrix: Record<string, number[]>; warn_limit: number };

/** Склад: учасники (ранг, обов’язки, ніки, виключення, передача сім’ї), заявки й права рангів. */
export function FamilyMembers({ slug, shell, reloadShell }: FamilyTabProps) {
    const page = useSite<MembersPage>(`/f/${slug}/members`);
    const { run, busy } = useAction();
    const [q, setQ] = useState('');
    const [edit, setEdit] = useState<Member | null>(null);
    const [ranks, setRanks] = useState(false);
    if (!page.data) return <Loading error={page.error} />;
    const done = async (): Promise<void> => {
        await page.reload();
        await reloadShell();
    };
    const { members, applications } = page.data;
    const canManage = !!shell.can['members.manage'];
    const list = members.filter((m) => !q || `${m.display} ${m.static_id ?? ''} ${m.username ?? ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.rank - a.rank);
    return (
        <div className="space-y-5">
            {canManage && applications.length > 0 && (
                <Card title={`Заявки (${applications.length})`}>
                    {applications.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 border-b border-white/5 py-2.5 last:border-0">
                            <Avatar user={{ name: a.display, avatar_url: a.avatar_url }} size={34} />
                            <div className="min-w-0 flex-1 text-sm">
                                <div className="font-semibold">
                                    {a.display}
                                </div>
                                {a.note && <p className="text-white/60">{a.note}</p>}
                                {a.answers.map((x, i) => (
                                    <p key={i} className="text-xs text-white/50">
                                        <b className="text-white/70">{x.question}</b> {x.answer}
                                    </p>
                                ))}
                                <p className="text-[11px] text-white/35">{when(a.applied_at)}</p>
                            </div>
                            <Button small tone="ok" disabled={busy} onClick={() => void run('POST', `/f/${slug}/members/${a.id}/accept`, {}, `${a.display} у сім’ї!`, done)}>
                                <UserCheck size={13} /> Прийняти
                            </Button>
                            <Button
                                small
                                tone="danger"
                                disabled={busy}
                                onClick={() => {
                                    const reason = window.prompt('Причина відмови (необов’язково)') ?? undefined;
                                    void run('POST', `/f/${slug}/members/${a.id}/decline`, { reason: reason || null }, 'Заявку відхилено.', done);
                                }}
                            >
                                <UserX size={13} /> Відхилити
                            </Button>
                        </div>
                    ))}
                </Card>
            )}
            <Card
                title={`Учасники (${members.length})`}
                actions={
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute top-2.5 left-2.5 text-white/40" />
                            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Нік, статик…" className="!w-52 pl-8" />
                        </div>
                        {shell.can['ranks.manage'] && (
                            <Button small onClick={() => setRanks(true)}>
                                <Settings2 size={13} /> Ранги й права
                            </Button>
                        )}
                    </div>
                }
            >
                <div className="divide-y divide-white/5">
                    {list.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                            <Avatar user={{ name: m.display, avatar_url: m.avatar_url }} size={32} dot={m.is_online ? 'online' : null} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                    {m.display} {m.is_owner && <span className="text-amber-300">★</span>}
                                </div>
                                <div className="truncate text-xs text-white/45">
                                    {m.rank} · {m.rank_title}
                                    {m.duties ? ` · ${m.duties}` : ''}
                                </div>
                            </div>
                            {m.balance !== undefined && <span className="w-28 text-right text-white/60">{money(m.balance)}</span>}
                            {(m.warns ?? 0) > 0 && (
                                <span className="text-xs text-rose-300">
                                    {m.warns}/{page.data!.warn_limit} варн
                                </span>
                            )}
                            <span className="w-28 text-right text-[11px] text-white/35">{m.is_online ? 'у мережі' : m.last_seen_at ? when(m.last_seen_at) : ''}</span>
                            {canManage && m.manageable && (
                                <Button small onClick={() => setEdit(m)}>
                                    Керувати
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
            {edit && <ManageMember slug={slug} member={edit} titles={shell.family.rank_titles} isOwner={!!shell.can.owner} onClose={() => setEdit(null)} onDone={async () => (setEdit(null), await done())} />}
            {ranks && <RanksEditor slug={slug} page={page.data} titles={shell.family.rank_titles} onClose={() => setRanks(false)} onDone={async () => (setRanks(false), await done())} />}
        </div>
    );
}

function ManageMember({ slug, member, titles, isOwner, onClose, onDone }: { slug: string; member: Member; titles: Record<string, string>; isOwner: boolean; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [rank, setRank] = useState(String(member.rank));
    const [duties, setDuties] = useState(member.duties ?? '');
    const [nick, setNick] = useState(member.nickname ?? '');
    const [staticId, setStatic] = useState(member.static_id ?? '');
    const [reason, setReason] = useState('');
    const path = `/f/${slug}/members/${member.id}`;
    return (
        <Modal title={`Керування: ${member.display}`} onClose={onClose}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Ранг">
                        <Select value={rank} onChange={(e) => setRank(e.target.value)}>
                            {Array.from({ length: 9 }, (_, i) => 9 - i).map((r) => (
                                <option key={r} value={r}>
                                    {r} · {titles[r]}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Обов’язки">
                        <Input value={duties} maxLength={160} onChange={(e) => setDuties(e.target.value)} />
                    </Field>
                    <Field label="Нік у грі">
                        <Input value={nick} onChange={(e) => setNick(e.target.value)} />
                    </Field>
                    <Field label="Статик">
                        <Input value={staticId} onChange={(e) => setStatic(e.target.value)} />
                    </Field>
                </div>
                <Button tone="primary" disabled={busy} onClick={() => void run('PATCH', path, { rank: Number(rank), duties: duties || null, rp_nickname: nick, static_id: staticId }, 'Збережено.', onDone)}>
                    Зберегти
                </Button>
                <div className="border-t border-white/10 pt-4">
                    <Field label="Виключити з сім’ї — причина">
                        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                    <div className="mt-2 flex gap-2">
                        <Button tone="danger" disabled={busy || reason.trim().length < 3} onClick={() => void run('POST', `${path}/kick`, { reason }, `${member.display} виключено.`, onDone)}>
                            Виключити
                        </Button>
                        <Button disabled={busy} onClick={() => void run('POST', `${path}/nudge`, {}, 'Нагадування надіслано.')}>
                            Нагадати про звіт
                        </Button>
                        {isOwner && (
                            <Button tone="danger" disabled={busy} onClick={() => window.confirm(`Передати сім’ю ${member.display}? Ви станете заступником.`) && void run('POST', `${path}/transfer`, {}, 'Сім’ю передано.', onDone)}>
                                Передати сім’ю
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

/** Назви рангів і матриця прав (ранги 1–9; лідер має все). */
function RanksEditor({ slug, page, titles, onClose, onDone }: { slug: string; page: MembersPage; titles: Record<string, string>; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [names, setNames] = useState(Array.from({ length: 10 }, (_, i) => titles[i + 1] ?? ''));
    const [matrix, setMatrix] = useState<Record<string, number[]>>(page.matrix);
    const perms = { ...page.permissions, ...page.voice_rooms };
    const toggle = (perm: string, rank: number): void => setMatrix((m) => ({ ...m, [perm]: (m[perm] ?? []).includes(rank) ? m[perm].filter((r) => r !== rank) : [...(m[perm] ?? []), rank] }));
    return (
        <Modal title="Ранги й права" onClose={onClose} wide>
            <div className="mb-4 grid grid-cols-5 gap-2">
                {names.map((n, i) => (
                    <Field key={i} label={`Ранг ${i + 1}`}>
                        <Input value={n} maxLength={24} onChange={(e) => setNames((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
                    </Field>
                ))}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-white/50">
                            <th className="py-1 text-left font-normal">Право</th>
                            {Array.from({ length: 9 }, (_, i) => (
                                <th key={i} className="w-8 font-normal">
                                    {i + 1}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(perms).map(([key, label]) => (
                            <tr key={key} className="border-t border-white/5">
                                <td className="py-1.5 pr-2 text-white/75">{label}</td>
                                {Array.from({ length: 9 }, (_, i) => (
                                    <td key={i} className="text-center">
                                        <input type="checkbox" className="accent-[#22d3ee]" checked={(matrix[key] ?? []).includes(i + 1)} onChange={() => toggle(key, i + 1)} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <Button onClick={onClose}>Скасувати</Button>
                <Button tone="primary" disabled={busy} onClick={() => void run('PUT', `/f/${slug}/ranks`, { titles: names, matrix }, 'Ранги й права збережено.', onDone)}>
                    Зберегти
                </Button>
            </div>
        </Modal>
    );
}
