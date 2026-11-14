import { Link, router, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Hand,
    Plus,
    Trash2,
    Undo2,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import { Modal, Panel, btnGhost, btnPrimary } from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import { Field, inputClass } from '@/components/servers/server-form';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FamilyShellProps, RosterEntry } from '@/types';

type Shift = {
    id: number;
    title: string;
    note: string | null;
    starts_at: string;
    ends_at: string;
    member: { id: number; display: string } | null;
    mine: boolean;
};

type Props = FamilyShellProps & {
    week: { offset: number; start: string };
    shifts: Shift[];
    roster: RosterEntry[];
    my_week: number;
    rules: { self_claim: boolean; week_limit: number; remind: boolean };
};

const KYIV = 'Europe/Kyiv';
const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: KYIV,
    });
const dayKey = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: KYIV });

/** Сім’я → Зміни: тиждень по днях; вільні зміни можна взяти, свої — віддати. */
export default function Shifts(props: Props) {
    const { family, can, week, shifts, roster, my_week, rules } = props;
    const base = `/f/${family.slug}`;
    const manage = can['events.manage'];
    const [creating, setCreating] = useState(false);
    const form = useForm({
        title: '',
        note: '',
        starts_at: '',
        hours: '4',
        member_id: '',
        repeat_weeks: '1',
    });

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${week.start}T12:00:00`);
        d.setDate(d.getDate() + i);

        return d;
    });
    const today = new Date().toLocaleDateString('en-CA', { timeZone: KYIV });
    const post = (url: string, data: Record<string, unknown> = {}) =>
        router.post(url, data as never, { preserveScroll: true });

    return (
        <FamilyShell {...props} title={tr('Зміни')}>
            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href={`${base}/shifts?week=${week.offset - 1}`}
                    preserveScroll
                    className={btnGhost}
                    aria-label={tr('Попередній тиждень')}
                >
                    <ChevronLeft className="size-4" />
                </Link>
                <h2 className="font-display text-lg font-semibold text-white">
                    {days[0].toLocaleDateString('uk-UA', {
                        day: 'numeric',
                        month: 'long',
                    })}{' '}
                    —{' '}
                    {days[6].toLocaleDateString('uk-UA', {
                        day: 'numeric',
                        month: 'long',
                    })}
                </h2>
                <Link
                    href={`${base}/shifts?week=${week.offset + 1}`}
                    preserveScroll
                    className={btnGhost}
                    aria-label={tr('Наступний тиждень')}
                >
                    <ChevronRight className="size-4" />
                </Link>
                {week.offset !== 0 && (
                    <Link
                        href={`${base}/shifts`}
                        preserveScroll
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        {tr('Цей тиждень')}
                    </Link>
                )}
                <span className="ml-auto text-sm text-white/55">
                    {rules.week_limit > 0
                        ? tr('Моїх змін цього тижня: {n} з {max}', {
                              n: my_week,
                              max: rules.week_limit,
                          })
                        : tr('Моїх змін цього тижня: {n}', { n: my_week })}
                </span>
                {manage && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className={btnPrimary}
                    >
                        <Plus className="size-4" />
                        {tr('Нова зміна')}
                    </button>
                )}
            </div>

            <div className="grid gap-3 min-[1920px]:grid-cols-7 sm:grid-cols-2 xl:grid-cols-4">
                {days.map((d) => {
                    const key = d.toLocaleDateString('en-CA');
                    const list = shifts.filter(
                        (s) => dayKey(s.starts_at) === key,
                    );

                    return (
                        <Panel
                            key={key}
                            className={cn(
                                'min-h-36',
                                key === today && 'ring-2 ring-primary/60',
                            )}
                            title={
                                <span className="capitalize">
                                    {d.toLocaleDateString('uk-UA', {
                                        weekday: 'long',
                                    })}{' '}
                                    <span className="font-normal text-white/45">
                                        {d.getDate()}
                                    </span>
                                </span>
                            }
                        >
                            {list.length === 0 ? (
                                <p className="text-sm text-white/35">
                                    {tr('Змін немає')}
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {list.map((s) => (
                                        <li
                                            key={s.id}
                                            className={cn(
                                                'rounded-xl p-2.5',
                                                s.mine
                                                    ? 'bg-primary/20'
                                                    : s.member
                                                      ? 'bg-white/[0.05]'
                                                      : 'bg-amber-500/10',
                                            )}
                                        >
                                            <p className="text-xs font-semibold text-white/60 tabular-nums">
                                                {time(s.starts_at)}–
                                                {time(s.ends_at)}
                                            </p>
                                            <p className="text-sm font-semibold break-words text-white">
                                                {s.title}
                                            </p>
                                            {s.note && (
                                                <p className="text-xs break-words text-white/50">
                                                    {s.note}
                                                </p>
                                            )}
                                            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                                                <UserRound className="size-3.5" />
                                                {s.member ? (
                                                    s.member.display
                                                ) : (
                                                    <span className="text-amber-300">
                                                        {tr('Вільна')}
                                                    </span>
                                                )}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {!s.member &&
                                                    (rules.self_claim ||
                                                        manage) &&
                                                    new Date(s.ends_at) >
                                                        new Date() && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                post(
                                                                    `${base}/shifts/${s.id}/claim`,
                                                                )
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
                                                                post(
                                                                    `${base}/shifts/${s.id}/release`,
                                                                )
                                                            }
                                                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-medium text-white/75"
                                                        >
                                                            <Undo2 className="size-3.5" />
                                                            {tr('Віддати')}
                                                        </button>
                                                    )}
                                                {manage && (
                                                    <>
                                                        <select
                                                            value={
                                                                s.member?.id ??
                                                                ''
                                                            }
                                                            onChange={(e) =>
                                                                post(
                                                                    `${base}/shifts/${s.id}/assign`,
                                                                    {
                                                                        member_id:
                                                                            e
                                                                                .target
                                                                                .value ||
                                                                            null,
                                                                    },
                                                                )
                                                            }
                                                            aria-label={tr(
                                                                'Призначити',
                                                            )}
                                                            className="input-glass h-8 max-w-36 rounded-lg px-2 text-xs text-white"
                                                        >
                                                            <option value="">
                                                                {tr('Вільна')}
                                                            </option>
                                                            {roster.map((r) => (
                                                                <option
                                                                    key={r.id}
                                                                    value={r.id}
                                                                >
                                                                    {r.display}
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
                                                                ) &&
                                                                router.delete(
                                                                    `${base}/shifts/${s.id}`,
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            aria-label={tr(
                                                                'Видалити',
                                                            )}
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
                            )}
                        </Panel>
                    );
                })}
            </div>

            <Modal
                open={creating}
                onClose={() => setCreating(false)}
                title={
                    <span className="flex items-center gap-2">
                        <CalendarClock className="size-5 text-sky-400" />
                        {tr('Нова зміна')}
                    </span>
                }
                description={tr(
                    'Чергування на складі, патруль, набір — хто й коли. Без учасника зміна вільна: її може взяти будь-хто.',
                )}
            >
                <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(`${base}/shifts`, {
                            preserveScroll: true,
                            onSuccess: () => {
                                setCreating(false);
                                form.reset();
                            },
                        });
                    }}
                >
                    <Field label={tr('Назва')} error={form.errors.title}>
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            maxLength={80}
                            placeholder={tr('Чергування на складі')}
                            className={inputClass}
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            label={tr('Початок')}
                            error={form.errors.starts_at}
                        >
                            <input
                                type="datetime-local"
                                value={form.data.starts_at}
                                onChange={(e) =>
                                    form.setData('starts_at', e.target.value)
                                }
                                className={inputClass}
                            />
                        </Field>
                        <Field
                            label={tr('Тривалість, год')}
                            error={form.errors.hours}
                        >
                            <input
                                type="number"
                                min={0.5}
                                max={24}
                                step={0.5}
                                value={form.data.hours}
                                onChange={(e) =>
                                    form.setData('hours', e.target.value)
                                }
                                className={inputClass}
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={tr('Хто')} error={form.errors.member_id}>
                            <select
                                value={form.data.member_id}
                                onChange={(e) =>
                                    form.setData('member_id', e.target.value)
                                }
                                className={selectClass}
                            >
                                <option value="">{tr('Вільна зміна')}</option>
                                {roster.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.display}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label={tr('Повторити')}
                            error={form.errors.repeat_weeks}
                        >
                            <select
                                value={form.data.repeat_weeks}
                                onChange={(e) =>
                                    form.setData('repeat_weeks', e.target.value)
                                }
                                className={selectClass}
                            >
                                {[1, 2, 3, 4, 6, 8].map((n) => (
                                    <option key={n} value={n}>
                                        {n === 1
                                            ? tr('Лише раз')
                                            : tr('{n} тижн. поспіль', { n })}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <Field label={tr('Примітка')} error={form.errors.note}>
                        <input
                            value={form.data.note}
                            onChange={(e) =>
                                form.setData('note', e.target.value)
                            }
                            maxLength={200}
                            placeholder={tr('Напр. ключі в сейфі №2')}
                            className={inputClass}
                        />
                    </Field>
                    <button
                        type="submit"
                        disabled={
                            form.processing ||
                            !form.data.title.trim() ||
                            !form.data.starts_at
                        }
                        className={cn(btnPrimary, 'w-full')}
                    >
                        {tr('Додати')}
                    </button>
                </form>
            </Modal>
        </FamilyShell>
    );
}
