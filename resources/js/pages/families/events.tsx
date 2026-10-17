import { router, useForm } from '@inertiajs/react';
import {
    CalendarDays,
    CalendarPlus,
    Check,
    Coins,
    Download,
    Hourglass,
    Images,
    KeyRound,
    Star,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Modal,
    Panel,
    btnGhost,
    btnPrimary,
    btnSuccess,
    textareaClass,
} from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import { Field, inputClass } from '@/components/servers/server-form';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyShellProps, RosterEntry } from '@/types';
import { eventDay, eventTime } from '@/lib/event-time';
import { tr } from '@/lib/i18n';

type FamilyEvent = {
    id: number;
    title: string;
    type: string;
    type_label: string;
    description: string | null;
    starts_at: string;
    points: number;
    reward: number;
    status: 'planned' | 'done' | 'cancelled';
    creator: string | null;
    going: boolean;
    capacity: number | null;
    seats: number;
    waitlist_count: number;
    my_status: 'going' | 'attended' | 'absent' | 'declined' | 'waitlist' | null;
    cover_url: string | null;
    checkin_code: string | null;
    checkin_open: boolean;
    album_url: string | null;
    can_album: boolean;
    attendance: {
        member_id: number;
        display: string;
        status: 'going' | 'attended' | 'absent';
    }[];
};

type Props = FamilyShellProps & {
    events: FamilyEvent[];
    types: Record<string, string>;
    roster: RosterEntry[];
    default_points: number;
};

const kyivInput = () => {
    const d = new Date(Date.now() + 3600000);
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);

    return parts.replace(' ', 'T').slice(0, 14) + '00';
};

export default function FamilyEvents(props: Props) {
    const { family, can, events, types, roster, default_points } = props;
    const base = `/f/${family.slug}`;
    const [creating, setCreating] = useState(false);
    const [closing, setClosing] = useState<FamilyEvent | null>(null);
    const form = useForm({
        title: '',
        type: 'meeting',
        description: '',
        starts_at: kyivInput(),
        points: default_points,
        reward: '',
        weekly: false,
        capacity: '',
        cover: null as File | null,
    });
    const [code, setCode] = useState<Record<number, string>>({});

    const planned = events.filter((e) => e.status === 'planned');
    const past = events.filter((e) => e.status !== 'planned');

    return (
        <FamilyShell {...props} title={tr('Події')}>
            <div className="flex items-center gap-2">
                <h2 className="mr-auto font-display text-lg font-semibold text-white">
                    {tr('Заплановані')}
                </h2>
                {can['events.manage'] && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className={btnPrimary}
                    >
                        <CalendarPlus className="size-4" /> {tr('Нова подія')}
                    </button>
                )}
            </div>

            {planned.length === 0 ? (
                <Panel>
                    <Empty
                        icon={CalendarDays}
                        text={tr('Запланованих подій немає')}
                    />
                </Panel>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {planned.map((e) => (
                        <Panel key={e.id}>
                            {e.cover_url && (
                                <img
                                    loading="lazy"
                                    decoding="async"
                                    src={e.cover_url}
                                    alt=""
                                    className="-mx-1 -mt-1 mb-3 aspect-[3/1] w-[calc(100%+0.5rem)] rounded-2xl object-cover"
                                />
                            )}
                            <div className="flex items-start gap-3">
                                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/20 to-rose-500/20 ring-1 ring-amber-300/25">
                                    <span className="font-display text-lg leading-none font-bold text-white">
                                        {eventDay(e.starts_at, 'day')}
                                    </span>
                                    <span className="text-xs text-white/55 uppercase">
                                        {eventDay(e.starts_at, 'month')}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-white">
                                        {e.title}
                                    </div>
                                    <div className="text-xs text-white/45">
                                        {e.type_label} ·{' '}
                                        {eventTime(e.starts_at)}
                                    </div>
                                    {e.description && (
                                        <p className="mt-1.5 text-sm text-white/60">
                                            {e.description}
                                        </p>
                                    )}
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/50">
                                        <span className="flex items-center gap-1">
                                            <Users className="size-3.5" />
                                            {e.capacity
                                                ? tr(
                                                      '{seats} з {capacity} місць',
                                                      {
                                                          seats: e.seats,
                                                          capacity: e.capacity,
                                                      },
                                                  )
                                                : `${e.attendance.length} ${tr('йдуть')}`}
                                        </span>
                                        {e.waitlist_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Hourglass className="size-3.5" />
                                                {tr('у черзі: {count}', {
                                                    count: e.waitlist_count,
                                                })}
                                            </span>
                                        )}
                                        {e.points > 0 && (
                                            <span className="flex items-center gap-1 text-amber-200">
                                                <Star className="size-3.5" /> +
                                                {e.points}
                                            </span>
                                        )}
                                        {e.reward > 0 && (
                                            <span className="flex items-center gap-1 text-emerald-300">
                                                <Coins className="size-3.5" />{' '}
                                                {uah(e.reward)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `${base}/events/${e.id}/rsvp`,
                                            { going: !e.going },
                                            { preserveScroll: true },
                                        )
                                    }
                                    className={cn(
                                        e.going || e.my_status === 'waitlist'
                                            ? btnSuccess
                                            : btnGhost,
                                        'flex-1',
                                    )}
                                >
                                    {e.my_status === 'attended' ? (
                                        <>
                                            <Check className="size-4" />{' '}
                                            {tr('Відмітився')}
                                        </>
                                    ) : e.going ? (
                                        <>
                                            <Check className="size-4" />{' '}
                                            {tr('Я буду')}
                                        </>
                                    ) : e.my_status === 'waitlist' ? (
                                        <>
                                            <Hourglass className="size-4" />{' '}
                                            {tr('У черзі · вийти')}
                                        </>
                                    ) : e.capacity !== null &&
                                      e.seats >= e.capacity ? (
                                        tr('Стати в чергу')
                                    ) : (
                                        tr('Піду')
                                    )}
                                </button>
                                <a
                                    href={`/events/family/${e.id}.ics`}
                                    className={btnGhost}
                                    title={tr('Додати в календар телефона')}
                                >
                                    <Download className="size-4" />
                                    <span className="sr-only">
                                        {tr('У календар')}
                                    </span>
                                </a>
                                {can['events.manage'] && (
                                    <button
                                        type="button"
                                        onClick={() => setClosing(e)}
                                        className={btnGhost}
                                    >
                                        {tr('Підсумок')}
                                    </button>
                                )}
                            </div>
                            {e.checkin_code && (
                                <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                                    <KeyRound className="size-4 shrink-0" />
                                    {tr('Код відмітки:')}{' '}
                                    <span className="font-mono text-base font-bold tracking-[0.3em]">
                                        {e.checkin_code}
                                    </span>
                                    <span className="text-xs text-amber-100/60">
                                        {tr('назвіть його на початку')}
                                    </span>
                                </p>
                            )}
                            {e.checkin_open &&
                                !e.checkin_code &&
                                e.my_status !== 'attended' && (
                                    <form
                                        className="mt-3 flex gap-2"
                                        onSubmit={(ev) => {
                                            ev.preventDefault();
                                            router.post(
                                                `${base}/events/${e.id}/checkin`,
                                                { code: code[e.id] ?? '' },
                                                { preserveScroll: true },
                                            );
                                        }}
                                    >
                                        <input
                                            value={code[e.id] ?? ''}
                                            onChange={(ev) =>
                                                setCode((c) => ({
                                                    ...c,
                                                    [e.id]: ev.target.value,
                                                }))
                                            }
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder={tr(
                                                'Код від організатора',
                                            )}
                                            aria-label={tr('Код відмітки')}
                                            className={cn(inputClass, 'flex-1')}
                                        />
                                        <button
                                            type="submit"
                                            className={btnPrimary}
                                        >
                                            <KeyRound className="size-4" />{' '}
                                            {tr('Відмітитися')}
                                        </button>
                                    </form>
                                )}
                        </Panel>
                    ))}
                </div>
            )}

            {past.length > 0 && (
                <Panel title={tr('Минулі події')} icon={CalendarDays}>
                    <ul className="divide-y divide-white/[0.05]">
                        {past.map((e) => (
                            <li
                                key={e.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm text-white">
                                        {e.title}
                                    </div>
                                    <div className="text-xs text-white/40">
                                        {e.type_label} ·{' '}
                                        {eventTime(e.starts_at)}
                                    </div>
                                </div>
                                {e.album_url ? (
                                    <a
                                        href={e.album_url}
                                        className="flex items-center gap-1 text-xs text-gc-lilac-300 hover:text-white"
                                    >
                                        <Images className="size-3.5" />
                                        {tr('Альбом')}
                                    </a>
                                ) : (
                                    e.can_album && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    `${base}/events/${e.id}/album`,
                                                )
                                            }
                                            className="flex items-center gap-1 text-xs text-gc-lilac-300 hover:text-white"
                                        >
                                            <Images className="size-3.5" />
                                            {tr('Створити альбом')}
                                        </button>
                                    )
                                )}
                                {e.status === 'cancelled' ? (
                                    <span className="text-xs text-white/40">
                                        {tr('скасовано')}
                                    </span>
                                ) : (
                                    <span className="text-xs text-emerald-300">
                                        {
                                            e.attendance.filter(
                                                (a) => a.status === 'attended',
                                            ).length
                                        }{' '}
                                        {tr('були')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}

            <Modal
                open={creating}
                onClose={() => setCreating(false)}
                title={tr('Нова подія')}
                description={tr(
                    'Анонс з’явиться в чаті сім’ї, учасники отримають сповіщення.',
                )}
                wide
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setCreating(false)}
                            className={btnGhost}
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() =>
                                form.post(`${base}/events`, {
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        form.reset();
                                        setCreating(false);
                                    },
                                })
                            }
                            className={btnPrimary}
                        >
                            {tr('Створити')}
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                        label={tr('Назва')}
                        error={form.errors.title}
                        className="sm:col-span-2"
                    >
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Збори сім’ї в маєтку')}
                            className={inputClass}
                        />
                    </Field>
                    <Field label={tr('Тип')}>
                        <select
                            value={form.data.type}
                            onChange={(e) =>
                                form.setData('type', e.target.value)
                            }
                            className={cn(selectClass, 'h-11 w-full')}
                        >
                            {Object.entries(types).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                        <input
                            type="checkbox"
                            checked={form.data.weekly}
                            onChange={(e) =>
                                form.setData('weekly', e.target.checked)
                            }
                        />
                        {tr('Щотижня')}
                    </label>
                    <Field
                        label={tr('Початок (за Києвом)')}
                        error={form.errors.starts_at}
                    >
                        <input
                            type="datetime-local"
                            value={form.data.starts_at}
                            onChange={(e) =>
                                form.setData('starts_at', e.target.value)
                            }
                            className={cn(inputClass, '[color-scheme:dark]')}
                        />
                    </Field>
                    <Field
                        label={tr('Бали за присутність')}
                        error={form.errors.points}
                    >
                        <input
                            type="number"
                            min={0}
                            value={form.data.points}
                            onChange={(e) =>
                                form.setData('points', Number(e.target.value))
                            }
                            className={inputClass}
                        />
                    </Field>
                    <Field
                        label={tr('Нагорода кожному, ₴')}
                        error={form.errors.reward}
                    >
                        <input
                            value={form.data.reward}
                            onChange={(e) =>
                                form.setData('reward', e.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className={inputClass}
                        />
                    </Field>
                    <Field
                        label={tr('Місць (порожньо — без обмежень)')}
                        error={form.errors.capacity}
                    >
                        <input
                            type="number"
                            min={2}
                            value={form.data.capacity}
                            onChange={(e) =>
                                form.setData('capacity', e.target.value)
                            }
                            placeholder="—"
                            className={inputClass}
                        />
                    </Field>
                    <Field label={tr('Обкладинка')} error={form.errors.cover}>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                                form.setData(
                                    'cover',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                            className={cn(inputClass, 'py-2 text-sm')}
                        />
                    </Field>
                    <Field label={tr('Опис')} className="sm:col-span-2">
                        <textarea
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            rows={3}
                            className={textareaClass}
                        />
                    </Field>
                </div>
            </Modal>

            {closing && (
                <CloseDialog
                    key={closing.id}
                    action={`${base}/events/${closing.id}/close`}
                    event={closing}
                    roster={roster}
                    onClose={() => setClosing(null)}
                />
            )}
        </FamilyShell>
    );
}

function CloseDialog({
    action,
    event,
    roster,
    onClose,
}: {
    action: string;
    event: FamilyEvent;
    roster: RosterEntry[];
    onClose: () => void;
}) {
    // Хто відмітився кодом — уже присутній; якщо ніхто, пропонуємо тих, хто записався.
    const checkedIn = event.attendance
        .filter((a) => a.status === 'attended')
        .map((a) => a.member_id);
    const [attended, setAttended] = useState<number[]>(
        checkedIn.length > 0
            ? checkedIn
            : event.attendance.map((a) => a.member_id),
    );
    const going = new Set(event.attendance.map((a) => a.member_id));
    const send = (cancelled: boolean) =>
        router.post(
            action,
            { attended: cancelled ? [] : attended, cancelled },
            { preserveScroll: true, onSuccess: onClose },
        );

    return (
        <Modal
            open
            onClose={onClose}
            title={tr('Підсумок: {title}', { title: event.title })}
            description={tr(
                'Позначте, хто був присутній. Кожен отримає +{points} балів{v}.',
                {
                    points: event.points,
                    v: event.reward
                        ? tr(' і {uah}', { uah: uah(event.reward) })
                        : '',
                },
            )}
            wide
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => send(true)}
                        className={btnGhost}
                    >
                        {tr('Скасувати подію')}
                    </button>
                    <button
                        type="button"
                        onClick={() => send(false)}
                        className={btnPrimary}
                    >
                        {tr('Зберегти ·')} {attended.length}
                    </button>
                </>
            }
        >
            <div className="grid max-h-[50vh] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {roster.map((m) => {
                    const on = attended.includes(m.id);

                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                                setAttended((s) =>
                                    on
                                        ? s.filter((x) => x !== m.id)
                                        : [...s, m.id],
                                )
                            }
                            className={cn(
                                'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
                                on
                                    ? 'bg-emerald-400/15 text-white ring-1 ring-emerald-300/30'
                                    : 'bg-white/[0.03] text-white/60',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-5 items-center justify-center rounded-md',
                                    on
                                        ? 'bg-emerald-400 text-black'
                                        : 'bg-white/10',
                                )}
                            >
                                {on && <Check className="size-3.5" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs">
                                {m.display}
                            </span>
                            {going.has(m.id) && (
                                <span className="text-xs text-white/40">
                                    {tr('записався')}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </Modal>
    );
}
