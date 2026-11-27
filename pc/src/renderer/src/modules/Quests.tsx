import { Check, Flame, Target } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Empty } from '@/components/ui';
import { api, useLive } from '@/lib/api';

type Quest = { key: string; title: string; target: number; progress: number; xp: number; done: boolean; claimed: boolean };
type Board = { quests: Quest[]; weekly?: Quest[] | { quests?: Quest[] }; resets_at?: string };

/** «Завдання»: завдання дня й виклики тижня з прогресом; виконане — забрати XP одним натиском. */
export function QuestsModule({ header }: { header?: ReactNode }) {
    const { data, error, reload } = useLive<Board>('/api/v1/site/quests', 60_000, ['quests']);
    const [busy, setBusy] = useState<string | null>(null);
    const daily = data?.quests ?? [];
    const weekly = Array.isArray(data?.weekly) ? data.weekly : (data?.weekly?.quests ?? []);
    const done = daily.filter((q) => q.done).length;
    const claim = async (q: Quest, week: boolean): Promise<void> => {
        setBusy(q.key);
        try {
            await api('POST', `/api/v1/site/quests/${week ? 'week/' : ''}${q.key}/claim`);
        } catch {
            // Помилку покаже повторне завантаження (кнопка лишиться).
        }
        await reload();
        setBusy(null);
    };
    const list = (items: Quest[], week: boolean): ReactNode =>
        items.map((q) => (
            <li key={`${week}:${q.key}`} className="rounded-xl px-2 py-2">
                <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{q.title}</span>
                    {q.claimed ? (
                        <Check size={16} className="text-emerald-400" />
                    ) : q.done ? (
                        <button type="button" disabled={busy === q.key} onClick={() => void claim(q, week)} className="no-drag rounded-full bg-neon-cyan/20 px-2.5 py-0.5 text-xs font-semibold text-neon-cyan ring-1 ring-neon-cyan/50 disabled:opacity-50">
                            +{q.xp} XP
                        </button>
                    ) : (
                        <span className="text-xs text-white/45">
                            {q.progress}/{q.target}
                        </span>
                    )}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${q.done ? 'bg-emerald-400' : 'bg-gradient-to-r from-neon-cyan to-neon-violet'}`} style={{ width: `${Math.min(100, (q.progress / Math.max(1, q.target)) * 100)}%` }} />
                </div>
            </li>
        ));
    return (
        <NotchedCard title="Завдання" subtitle="Щодня й щотижня — за XP сезону" glow="cyan" header={header} badge={<NotchBadge tone={done === daily.length && daily.length ? 'cyan' : 'muted'}>{`${done}/${daily.length}`}</NotchBadge>} badgeWidth={52}>
            {!data && <Empty>{error ?? 'Завантажуємо…'}</Empty>}
            {data && (
                <>
                    <h3 className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-white/45 uppercase">
                        <Target size={12} /> Сьогодні
                    </h3>
                    <ul>{list(daily, false)}</ul>
                    {weekly.length > 0 && (
                        <>
                            <h3 className="mt-3 mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-white/45 uppercase">
                                <Flame size={12} /> Виклики тижня
                            </h3>
                            <ul>{list(weekly, true)}</ul>
                        </>
                    )}
                </>
            )}
        </NotchedCard>
    );
}
