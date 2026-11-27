import { CalendarClock, ChevronRight, ShieldAlert, Trophy, Wallet } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { useLive } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Widget = {
    family: { id: number; slug?: string; name: string; tag?: string | null; logo_url?: string | null };
    member: { display: string; rank: number; rank_title: string };
    balance: number;
    treasury: number | null;
    week_earned: number;
    week_total: number;
    pending_reports: number;
    warns: number;
    warn_limit: number;
    rating: { place: number | null; of: number; points: number; bizwar_wins: number; bizwar_losses: number; contracts: number; events: number };
    next_event: { title: string; type_label: string; starts_at: string } | null;
};

const money = (n: number): string => `${Math.round(n).toLocaleString('uk-UA')} $`;

/** «Сім’ї»: ваш стан у сім’ї — гроші, ранг, тиждень, рейтинг, бізвари, варни й найближча подія. */
export function FamiliesModule({ header }: { header?: ReactNode }) {
    const { data, error } = useLive<{ families: Widget[] }>('/api/v1/me/family-widget', 60_000, ['families']);
    const families = data?.families ?? [];
    const [index, setIndex] = useState(0);
    const nav = useNav();
    const web = (path: string): void => nav.go(path);
    const w = families[Math.min(index, families.length - 1)];
    return (
        <NotchedCard title="Сім’ї" subtitle={w ? `${w.member.rank_title} · ${w.member.display}` : 'Ваша сім’я'} glow="violet" header={header} badge={<NotchBadge tone={w?.warns ? 'violet' : 'muted'}>{w?.rating.place ? `#${w.rating.place}` : '—'}</NotchBadge>} badgeWidth={52}>
            {!w && <Empty>{error ?? (data ? 'Ви ще не в сім’ї. Знайдіть свою на GameCon.' : 'Завантажуємо…')}</Empty>}
            {w && (
                <div className="space-y-3">
                    {families.length > 1 && (
                        <div className="flex gap-1 overflow-x-auto">
                            {families.map((f, i) => (
                                <button key={f.family.id} type="button" onClick={() => setIndex(i)} className={`no-drag shrink-0 rounded-full px-3 py-1 text-xs ring-1 ${i === index ? 'bg-neon-violet/20 ring-neon-violet/50' : 'ring-white/10 hover:bg-white/5'}`}>
                                    {f.family.tag ? `[${f.family.tag}] ` : ''}
                                    {f.family.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <button type="button" onClick={() => web(`/families/${w.family.slug ?? w.family.id}`)} className="no-drag flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-white/[0.04]">
                        <Avatar user={{ name: w.family.name, avatar_url: w.family.logo_url }} size={40} />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{w.family.tag ? `[${w.family.tag}] ` : ''}{w.family.name}</span>
                            <span className="block truncate text-xs text-white/50">Ранг {w.member.rank} · {w.member.rank_title}</span>
                        </span>
                        <ChevronRight size={14} className="text-white/40" />
                    </button>
                    <div className="grid grid-cols-3 gap-2">
                        <Stat icon={<Wallet size={13} />} label="Баланс" value={money(w.balance)} />
                        <Stat label="За тиждень" value={money(w.week_earned)} hint={w.week_total ? `${Math.round((w.week_earned / w.week_total) * 100)}% сім’ї` : undefined} />
                        <Stat icon={<Trophy size={13} />} label="Місце" value={w.rating.place ? `${w.rating.place}/${w.rating.of}` : '—'} hint={`${w.rating.points} балів`} />
                        <Stat label="Бізвари" value={`${w.rating.bizwar_wins}:${w.rating.bizwar_losses}`} />
                        <Stat label="Контракти" value={String(w.rating.contracts)} />
                        <Stat icon={<ShieldAlert size={13} />} label="Варни" value={`${w.warns}/${w.warn_limit}`} alert={w.warns > 0} />
                        {w.treasury !== null && <Stat label="Казна" value={money(w.treasury)} />}
                        {w.pending_reports > 0 && <Stat label="Звіти чекають" value={String(w.pending_reports)} />}
                    </div>
                    {w.next_event && (
                        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5">
                            <CalendarClock size={16} className="text-neon-violet" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{w.next_event.title}</span>
                                <span className="block text-xs text-white/50">
                                    {w.next_event.type_label} · {new Date(w.next_event.starts_at).toLocaleString('uk-UA', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button type="button" onClick={() => web(`/families/${w.family.slug ?? w.family.id}?tab=reports`)} className="no-drag flex-1 rounded-lg bg-gradient-to-r from-neon-violet/80 to-neon-blue/80 py-2 text-sm font-semibold">
                            Здати звіт
                        </button>
                        <button type="button" onClick={() => web(`/families/${w.family.slug ?? w.family.id}?tab=bank`)} className="no-drag flex-1 rounded-lg py-2 text-sm ring-1 ring-white/15 hover:bg-white/5">
                            Банк
                        </button>
                    </div>
                </div>
            )}
        </NotchedCard>
    );
}

function Stat({ icon, label, value, hint, alert }: { icon?: ReactNode; label: string; value: string; hint?: string; alert?: boolean }) {
    return (
        <div className="rounded-xl bg-white/[0.04] px-2.5 py-2 ring-1 ring-white/5">
            <div className={`truncate text-sm font-bold ${alert ? 'text-rose-300' : ''}`}>{value}</div>
            <div className="flex items-center gap-1 truncate text-[11px] text-white/45">
                {icon}
                {label}
            </div>
            {hint && <div className="truncate text-[10px] text-white/35">{hint}</div>}
        </div>
    );
}
