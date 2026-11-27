import { Card, Loading, money, useSite, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import type { FamilyTabProps } from './FamilyPage';
import type { Member } from './types';

type Overview = {
    stats: { week_earned: number; week_total: number; pending_reports: number; warns: number; warn_limit: number };
    leaders: (Member & { points: number; earned: number; place: number })[];
    goals: { type: string; label: string; progress: number; target: number; done: boolean }[];
    events: { id: number; title: string; type_label: string; starts_at: string }[];
    transactions: { id: number; amount: number; type_label?: string; label?: string; comment?: string | null; created_at: string }[];
    low_stock: { id: number; name: string; quantity: number; min_stock: number; unit?: string }[];
    activity: { id: number; action_label: string; actor?: string | null; target?: string | null; created_at: string }[];
    chat?: { latest: { id: number; name: string; body: string; at: string }[] } | null;
};

export function FamilyOverview({ slug, shell }: FamilyTabProps) {
    const { data, error } = useSite<Overview>(`/f/${slug}`);
    if (!data) return <Loading error={error} />;
    const s = data.stats;
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            <Card title="Мій тиждень">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Баланс" value={money(shell.me?.balance)} />
                    <Stat label="Заробив за тиждень" value={money(s.week_earned)} hint={s.week_total ? `${Math.round((s.week_earned / s.week_total) * 100)}% від ${money(s.week_total)}` : undefined} />
                    <Stat label="Звіти на перевірці" value={String(s.pending_reports)} />
                    <Stat label="Варни" value={`${s.warns}/${s.warn_limit}`} alert={s.warns > 0} />
                    {shell.family.treasury !== null && <Stat label="Казна" value={money(shell.family.treasury)} />}
                </div>
            </Card>
            <Card title="Лідери тижня">
                <ol className="space-y-2">
                    {data.leaders.slice(0, 6).map((l) => (
                        <li key={l.id} className="flex items-center gap-2.5 text-sm">
                            <span className="w-5 text-center text-white/40">{l.place}</span>
                            <Avatar user={{ name: l.display, avatar_url: l.avatar_url }} size={26} />
                            <span className="min-w-0 flex-1 truncate">{l.display}</span>
                            <span className="text-neon-cyan">{l.points}</span>
                        </li>
                    ))}
                    {data.leaders.length === 0 && <p className="text-sm text-white/45">Ще немає балів цього тижня.</p>}
                </ol>
            </Card>
            {data.goals.length > 0 && (
                <Card title="Цілі">
                    {data.goals.map((g) => (
                        <div key={g.type} className="mb-2">
                            <div className="flex text-sm">
                                <span className="flex-1">{g.label}</span>
                                <span className="text-white/50">
                                    {g.progress}/{g.target}
                                </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full bg-gradient-to-r from-neon-cyan to-neon-violet" style={{ width: `${Math.min(100, (g.progress / Math.max(1, g.target)) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </Card>
            )}
            <Card title="Найближчі події">
                {data.events.length === 0 && <p className="text-sm text-white/45">Подій не заплановано.</p>}
                {data.events.map((e) => (
                    <div key={e.id} className="flex py-1 text-sm">
                        <span className="min-w-0 flex-1 truncate">{e.title}</span>
                        <span className="text-white/50">
                            {e.type_label} · {when(e.starts_at)}
                        </span>
                    </div>
                ))}
            </Card>
            <Card title="Мої операції">
                {data.transactions.length === 0 && <p className="text-sm text-white/45">Операцій ще не було.</p>}
                {data.transactions.map((t) => (
                    <div key={t.id} className="flex py-1 text-sm">
                        <span className="min-w-0 flex-1 truncate">{t.type_label ?? 'Операція'}{t.comment ? ` · ${t.comment}` : ''}</span>
                        <span className={t.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{(t.amount >= 0 ? '+' : '') + money(t.amount)}</span>
                    </div>
                ))}
            </Card>
            {data.low_stock.length > 0 && (
                <Card title="Закінчується на складі">
                    {data.low_stock.map((i) => (
                        <div key={i.id} className="flex py-1 text-sm">
                            <span className="flex-1">{i.name}</span>
                            <span className="text-amber-300">
                                {i.quantity} / мін. {i.min_stock} {i.unit ?? ''}
                            </span>
                        </div>
                    ))}
                </Card>
            )}
            {data.chat?.latest && data.chat.latest.length > 0 && (
                <Card title="Чат сім’ї">
                    {data.chat.latest.map((m) => (
                        <p key={m.id} className="truncate py-0.5 text-sm">
                            <span className="text-neon-cyan">{m.name}:</span> {m.body}
                        </p>
                    ))}
                </Card>
            )}
            <Card title="Що відбувається">
                {data.activity.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex gap-2 py-1 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                            {a.actor ?? 'Система'} — {a.action_label}
                            {a.target ? `: ${a.target}` : ''}
                        </span>
                        <span className="shrink-0 text-white/40">{when(a.created_at)}</span>
                    </div>
                ))}
            </Card>
        </div>
    );
}

export function Stat({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
    return (
        <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <div className={`text-base font-bold ${alert ? 'text-rose-300' : ''}`}>{value}</div>
            <div className="text-xs text-white/50">{label}</div>
            {hint && <div className="text-[11px] text-white/35">{hint}</div>}
        </div>
    );
}
