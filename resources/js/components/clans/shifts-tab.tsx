import { router, useForm } from '@inertiajs/react';
import { CalendarClock, Hand, Trash2, Undo2, UserRound } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type ClanShift = {
    id: number;
    title: string;
    starts_at: string;
    ends_at: string;
    user: UserCard | null;
    mine: boolean;
};

const input =
    'input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';
const KYIV = 'Europe/Kyiv';
const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: KYIV,
    });
// День тижня окремо від дати — інакше «п’ятницю, 13 листопада».
const day = (iso: string) =>
    `${new Date(iso).toLocaleDateString('uk-UA', { weekday: 'long', timeZone: KYIV })}, ${new Date(
        iso,
    ).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        timeZone: KYIV,
    })}`;

/** Клан → Зміни: найближчі два тижні по днях; вільну зміну можна взяти, свою — віддати. */
export function ShiftsTab({
    base,
    shifts,
    members,
    canManage,
}: {
    base: string;
    shifts: ClanShift[];
    members: { user: UserCard | null; nickname: string | null }[];
    canManage: boolean;
}) {
    const form = useForm({
        title: '',
        starts_at: '',
        hours: '4',
        user_id: '',
        repeat_weeks: '1',
    });
    const act = (id: number, action: string, extra: object = {}) =>
        router.post(
            `${base}/shifts/${id}`,
            { action, ...extra },
            { preserveScroll: true },
        );
    const byDay = shifts.reduce<Record<string, ClanShift[]>>((acc, s) => {
        (acc[day(s.starts_at)] ??= []).push(s);

        return acc;
    }, {});
    const people = members.filter((m) => m.user);

    return (
        <div className="space-y-4">
            {canManage && (
                <section className="rounded-3xl bg-white/[0.04] p-4">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
                        <CalendarClock className="size-4 text-sky-400" />
                        {tr('Нова зміна')}
                    </h3>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(`${base}/shifts`, {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                        className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_200px_90px_180px_150px_auto]"
                    >
                        <input
                            value={form.data.title}
                            maxLength={80}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Патруль, охорона бази…')}
                            className={cn(input, 'col-span-2 lg:col-span-1')}
                        />
                        <input
                            type="datetime-local"
                            value={form.data.starts_at}
                            onChange={(e) =>
                                form.setData('starts_at', e.target.value)
                            }
                            aria-label={tr('Початок')}
                            className={input}
                        />
                        <input
                            type="number"
                            min={0.5}
                            max={24}
                            step={0.5}
                            value={form.data.hours}
                            onChange={(e) =>
                                form.setData('hours', e.target.value)
                            }
                            aria-label={tr('Тривалість, год')}
                            className={input}
                        />
                        <select
                            value={form.data.user_id}
                            onChange={(e) =>
                                form.setData('user_id', e.target.value)
                            }
                            aria-label={tr('Хто')}
                            className={input}
                        >
                            <option value="">{tr('Вільна зміна')}</option>
                            {people.map((m) => (
                                <option key={m.user!.id} value={m.user!.id}>
                                    {m.nickname || m.user!.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={form.data.repeat_weeks}
                            onChange={(e) =>
                                form.setData('repeat_weeks', e.target.value)
                            }
                            aria-label={tr('Повторити')}
                            className={input}
                        >
                            {[1, 2, 3, 4, 6, 8].map((n) => (
                                <option key={n} value={n}>
                                    {n === 1
                                        ? tr('Лише раз')
                                        : tr('{n} тижн. поспіль', { n })}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={
                                form.processing ||
                                !form.data.title.trim() ||
                                !form.data.starts_at
                            }
                            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                            {tr('Додати')}
                        </button>
                    </form>
                    {Object.values(form.errors)[0] && (
                        <p className="mt-2 text-xs text-rose-300">
                            {Object.values(form.errors)[0]}
                        </p>
                    )}
                </section>
            )}

            {shifts.length === 0 ? (
                <p className="rounded-3xl bg-white/[0.04] p-6 text-center text-sm text-white/45">
                    {tr('На найближчі два тижні змін немає.')}
                </p>
            ) : (
                Object.entries(byDay).map(([label, list]) => (
                    <section key={label}>
                        <h3 className="mb-2 text-sm font-semibold text-white/70 first-letter:uppercase">
                            {label}
                        </h3>
                        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {list.map((s) => (
                                <li
                                    key={s.id}
                                    className={cn(
                                        'rounded-2xl p-3',
                                        s.mine
                                            ? 'bg-primary/20'
                                            : s.user
                                              ? 'bg-white/[0.05]'
                                              : 'bg-amber-500/10',
                                    )}
                                >
                                    <p className="text-xs font-semibold text-white/60 tabular-nums">
                                        {time(s.starts_at)}–{time(s.ends_at)}
                                    </p>
                                    <p className="text-sm font-semibold break-words text-white">
                                        {s.title}
                                    </p>
                                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                                        <UserRound className="size-3.5" />
                                        {s.user ? (
                                            s.user.name
                                        ) : (
                                            <span className="text-amber-300">
                                                {tr('Вільна')}
                                            </span>
                                        )}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {!s.user && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    act(s.id, 'claim')
                                                }
                                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-300"
                                            >
                                                <Hand className="size-3.5" />
                                                {tr('Взяти')}
                                            </button>
                                        )}
                                        {s.mine &&
                                            new Date(s.starts_at) >
                                                new Date() && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        act(s.id, 'release')
                                                    }
                                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-medium text-white/75"
                                                >
                                                    <Undo2 className="size-3.5" />
                                                    {tr('Віддати')}
                                                </button>
                                            )}
                                        {canManage && (
                                            <>
                                                <select
                                                    value={s.user?.id ?? ''}
                                                    onChange={(e) =>
                                                        act(s.id, 'assign', {
                                                            user_id:
                                                                e.target
                                                                    .value ||
                                                                null,
                                                        })
                                                    }
                                                    aria-label={tr(
                                                        'Призначити',
                                                    )}
                                                    className="input-glass h-8 max-w-36 rounded-lg px-2 text-xs text-white"
                                                >
                                                    <option value="">
                                                        {tr('Вільна')}
                                                    </option>
                                                    {people.map((m) => (
                                                        <option
                                                            key={m.user!.id}
                                                            value={m.user!.id}
                                                        >
                                                            {m.nickname ||
                                                                m.user!.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        window.confirm(
                                                            tr(
                                                                'Видалити зміну?',
                                                            ),
                                                        ) && act(s.id, 'delete')
                                                    }
                                                    aria-label={tr('Видалити')}
                                                    className="grid size-8 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))
            )}
        </div>
    );
}
