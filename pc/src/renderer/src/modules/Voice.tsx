import { Headphones, Lock, Mic, MicOff, PhoneCall, Radio } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import type { CallRoom, CallState } from '../../../preload';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';

type Person = User & { muted?: boolean; hand?: boolean; speaker?: boolean };
type Room = { id: number; name: string; locked: boolean; stage: boolean; count: number; participants: Person[] };
type Owner = { type: string; id: number; title: string };
type Group = Owner & { enabled: boolean; rooms: Room[] };

/** Мої групи з голосом: сім’ї, клани, спільноти — лише ті розділи, що ввімкнено людині. */
async function myOwners(sections: string[] | null): Promise<Owner[]> {
    const on = (s: string): boolean => sections === null || sections.includes(s);
    const owners: Owner[] = [];
    const tasks: Promise<void>[] = [];
    if (on('families')) {
        tasks.push(
            api<{ mine: { id: number; name: string; membership?: { status?: string } }[] }>('GET', '/api/v1/families').then((r) => {
                for (const f of r.mine ?? []) if (f.membership?.status !== 'pending') owners.push({ type: 'family', id: f.id, title: f.name });
            }, () => undefined),
        );
    }
    if (on('clans')) {
        tasks.push(
            api<{ mine: { id: number; name: string; display_name?: string; pending?: boolean }[] }>('GET', '/api/v1/site/clans').then((r) => {
                for (const c of r.mine ?? []) if (!c.pending) owners.push({ type: 'clan', id: c.id, title: c.display_name ?? c.name });
            }, () => undefined),
        );
    }
    if (on('communities')) {
        tasks.push(
            api<{ communities: { data: { id: number; name: string }[] } }>('GET', '/api/v1/communities?tab=mine').then((r) => {
                for (const c of r.communities?.data ?? []) owners.push({ type: 'community', id: c.id, title: c.name });
            }, () => undefined),
        );
    }
    await Promise.all(tasks);
    return owners;
}

/**
 * Голосові кімнати GameCon: усі кімнати ваших сімей, кланів і спільнот з тими, хто там зараз.
 * Вхід — в окреме вікно дзвінка (LiveKit), яке лишається поверх гри; Ctrl+Shift+M — мікрофон.
 */
export function VoiceModule({ header }: { header?: ReactNode }) {
    const { sections } = useMe();
    const [groups, setGroups] = useState<Group[] | null>(null);
    const [call, setCall] = useState<CallState | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        const load = async (): Promise<void> => {
            try {
                const owners = await myOwners(sections);
                const states = await Promise.all(
                    owners.map((o) =>
                        api<{ enabled: boolean; rooms: Room[] }>('GET', `/api/v1/voice/${o.type}/${o.id}`).then(
                            (s) => ({ ...o, enabled: s.enabled, rooms: s.rooms ?? [] }),
                            () => null,
                        ),
                    ),
                );
                if (alive) setGroups(states.filter((g): g is Group => g !== null));
            } catch (e) {
                if (alive) setError((e as Error).message);
            }
        };
        void load();
        const timer = window.setInterval(() => void load(), 15_000);
        const off = window.gamecon.call.onState(setCall);
        return () => {
            alive = false;
            window.clearInterval(timer);
            off();
        };
    }, [sections]);

    const live = groups?.reduce((n, g) => n + g.rooms.reduce((m, r) => m + r.count, 0), 0) ?? 0;
    const join = (g: Group, r: Room): void => {
        const room: CallRoom = { id: r.id, name: r.name, owner: { type: g.type, id: g.id, title: g.title } };
        void window.gamecon.call.join(room);
    };

    return (
        <NotchedCard title="Голосові кімнати" subtitle="Сім’ї, клани й спільноти" glow="cyan" header={header} badge={<NotchBadge tone={live ? 'cyan' : 'muted'}>{live}</NotchBadge>} badgeWidth={44}>
            {call && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-neon-cyan/10 px-3 py-2 ring-1 ring-neon-cyan/40">
                    <PhoneCall size={15} className="text-neon-cyan" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                        {call.room.name} · {call.room.owner.title}
                    </span>
                    {call.muted ? <MicOff size={14} className="text-rose-300" /> : <Mic size={14} className="text-emerald-300" />}
                    {call.deafened && <Headphones size={14} className="text-rose-300" />}
                </div>
            )}
            {groups === null && <Empty>{error ?? 'Завантажуємо…'}</Empty>}
            {groups && groups.length > 0 && groups.every((g) => !g.enabled) && <p className="mb-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-white/50">Голос на сервері ще не налаштовано — кімнати видно, зайти поки не можна.</p>}
            {groups?.length === 0 && <Empty>Голосові кімнати є в сім’ях, кланах і спільнотах. Вступіть у групу — і заходьте поговорити.</Empty>}
            <div className="space-y-3">
                {groups?.map((g) => (
                    <section key={`${g.type}:${g.id}`}>
                        <h3 className="mb-1 truncate px-1 text-[11px] font-semibold tracking-wide text-white/45 uppercase">{g.title}</h3>
                        <ul className="space-y-1">
                            {g.rooms.map((r) => {
                                const here = call?.room.id === r.id;
                                return (
                                    <li key={r.id} className={`rounded-xl px-2 py-1.5 ${here ? 'bg-white/[0.06] ring-1 ring-neon-cyan/30' : 'hover:bg-white/[0.04]'}`}>
                                        <button type="button" disabled={r.locked || !g.enabled} onClick={() => join(g, r)} className="no-drag flex w-full items-center gap-2 text-left disabled:opacity-50">
                                            {r.stage ? <Radio size={14} className="text-neon-violet" /> : <Mic size={14} className="text-white/50" />}
                                            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                                            {r.locked && <Lock size={12} className="text-white/40" />}
                                            {r.count > 0 && <span className="text-xs text-neon-cyan">{r.count}</span>}
                                        </button>
                                        {r.participants.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1 pl-6">
                                                {r.participants.slice(0, 8).map((p) => (
                                                    <span key={p.id} title={p.name} className="flex items-center gap-1 rounded-full bg-white/[0.05] py-0.5 pr-2 pl-0.5 text-[11px] text-white/70">
                                                        <Avatar user={p} size={16} />
                                                        <span className="max-w-20 truncate">{p.first_name ?? p.name}</span>
                                                        {p.muted && <MicOff size={10} className="text-rose-300" />}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </NotchedCard>
    );
}
