import { Head, Link, router } from '@inertiajs/react';
import {
    Delete,
    Loader2,
    MessageCircle,
    Phone,
    PhoneIncoming,
    PhoneMissed,
    PhoneOutgoing,
    Repeat2,
    ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState, Widget } from '@/components/gc/widget';
import { NumberPicker } from '@/components/phone/number-picker';
import {
    IncomingOffers,
    OutgoingOffers,
    TransferForm,
} from '@/components/phone/phone-offers';
import type {
    PhoneOfferCard,
    UnusedGift,
} from '@/components/phone/phone-offers';
import { PhoneBadge } from '@/components/phone/phone-badge';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { PickerProps } from '@/lib/phones';
import { cn } from '@/lib/utils';
import { startCall } from '@/lib/voice';
import type { PhoneCard, UserCard } from '@/types';

type HistoryItem = {
    id: number;
    direction: 'in' | 'out' | 'missed';
    at: string;
    seconds: number | null;
    conversation_id: number;
    user: UserCard;
    phone: PhoneCard | null;
};

type Props = PickerProps & {
    privacy: 'everyone' | 'friends' | 'nobody';
    visible: boolean;
    history: HistoryItem[];
    incoming: PhoneOfferCard[];
    outgoing: PhoneOfferCard[];
    gifts: UnusedGift[];
    friends: UserCard[];
};

type Lookup =
    | { found: true; phone: PhoneCard; user: UserCard }
    | { found: false; message: string };

const KEYS = [
    ['1', ''],
    ['2', 'ABC'],
    ['3', 'DEF'],
    ['4', 'GHI'],
    ['5', 'JKL'],
    ['6', 'MNO'],
    ['7', 'PQRS'],
    ['8', 'TUV'],
    ['9', 'WXYZ'],
    ['+', ''],
    ['0', ''],
    ['#', ''],
] as const;

/**
 * Гарний вигляд набраного: з «+» — «+777 (05) 123-45-67», без нього — «(05) 123-45-67»
 * (код мережі можна не набирати: оператор + 7 цифр унікальні).
 */
function pretty(raw: string): string {
    const d = raw.replace(/\D/g, '');
    const withCode = raw.startsWith('+');
    if (withCode && d.length <= 3) return `+${d}`;
    const code = withCode ? d.slice(0, 3) : '';
    const rest = withCode ? d.slice(3) : d;
    if (rest.length === 0) return `+${code}`;
    const op = rest.slice(0, 2);
    const n = rest.slice(2, 9);
    const parts = [n.slice(0, 3), n.slice(3, 5), n.slice(5, 7)].filter(Boolean);
    const local = `(${op}${op.length === 2 ? ')' : ''}${parts.length ? ' ' + parts.join('-') : ''}`;

    return code ? `+${code} ${local}` : local;
}

export default function PhonePage(props: Props) {
    const params = new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
    );
    const [dialed, setDialed] = useState(
        (params.get('dial') ?? '').replace(/[^\d+]/g, ''),
    );
    const [lookup, setLookup] = useState<Lookup | null>(null);
    const [busy, setBusy] = useState<'call' | 'message' | null>(null);
    const [changing, setChanging] = useState(!props.phone);
    const digits = dialed.replace(/\D/g, '');

    useEffect(() => {
        setLookup(null);
        if (digits.length < 9) return;
        const handle = window.setTimeout(() => {
            api<Lookup>(
                'GET',
                `/phone/lookup?number=${encodeURIComponent(dialed)}`,
            )
                .then(setLookup)
                .catch(() => setLookup(null));
        }, 250);

        return () => window.clearTimeout(handle);
    }, [dialed, digits.length]);

    const press = (key: string) => {
        if (key === '#') return;
        if (key === '+') {
            if (!dialed.includes('+')) setDialed('+' + dialed);
            return;
        }
        if (digits.length < 12) setDialed(dialed + key);
    };

    const contact = async (action: 'call' | 'message') => {
        setBusy(action);
        try {
            const data = await api<{
                conversation: { id: number; title: string };
                can_call: boolean;
            }>('POST', '/phone/dial', { number: dialed });
            if (action === 'message') {
                router.visit(`/messages/${data.conversation.id}`);
            } else if (data.can_call) {
                await startCall(data.conversation);
            } else {
                toast.error(tr('Цьому абоненту зараз не можна подзвонити.'));
            }
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr('Щось пішло не так. Спробуйте ще раз.'),
            );
        } finally {
            setBusy(null);
        }
    };

    const saveSettings = (privacy: Props['privacy'], visible: boolean) =>
        router.put(
            '/phone/settings',
            { privacy, visible },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={tr('Телефон')} />
            <div className="grid gap-4 *:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                {/* Набирач */}
                <section className="glass rounded-3xl p-5">
                    <div className="flex min-h-[4.5rem] flex-col items-center justify-center text-center">
                        <div className="flex w-full items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[1.7rem] font-semibold tracking-tight text-white tabular-nums">
                                {dialed ? (
                                    pretty(dialed)
                                ) : (
                                    <span className="text-white/25">
                                        +{props.codes.premium} (05) 123-45-67
                                    </span>
                                )}
                            </span>
                            {dialed && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDialed(dialed.slice(0, -1))
                                    }
                                    aria-label={tr('Стерти')}
                                    className="flex size-10 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                                >
                                    <Delete className="size-5" />
                                </button>
                            )}
                        </div>
                        <div className="mt-2 min-h-12" aria-live="polite">
                            {lookup?.found ? (
                                <Link
                                    href={`/${lookup.user.username}`}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.04] py-1.5 pr-3 pl-1.5 transition hover:bg-white/[0.08]"
                                >
                                    <UserAvatar user={lookup.user} size="md" />
                                    <span className="text-left">
                                        <span className="block text-sm font-semibold text-white">
                                            {lookup.user.name}
                                        </span>
                                        <PhoneBadge
                                            phone={lookup.phone}
                                            size="sm"
                                        />
                                    </span>
                                </Link>
                            ) : lookup ? (
                                <p className="text-sm text-white/45">
                                    {lookup.message}
                                </p>
                            ) : (
                                <p className="text-xs text-white/35">
                                    {tr(
                                        'Наберіть номер — покажемо, чий він. Код мережі можна не вводити.',
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2.5">
                        {KEYS.map(([key, letters]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => press(key)}
                                disabled={key === '#'}
                                className="phone-key flex aspect-[1.35] flex-col items-center justify-center rounded-2xl bg-white/[0.05] text-white hover:bg-white/[0.09] disabled:opacity-30"
                            >
                                <span className="text-2xl font-medium">
                                    {key}
                                </span>
                                <span className="h-3 text-[9px] tracking-[0.2em] text-white/35">
                                    {letters}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="mx-auto mt-4 flex max-w-xs gap-2.5">
                        <button
                            type="button"
                            onClick={() => void contact('message')}
                            disabled={!lookup?.found || busy !== null}
                            className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] font-semibold text-white transition hover:bg-white/[0.11] disabled:opacity-35"
                        >
                            {busy === 'message' ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : (
                                <MessageCircle className="size-5" />
                            )}
                            {tr('Написати')}
                        </button>
                        <button
                            type="button"
                            onClick={() => void contact('call')}
                            disabled={!lookup?.found || busy !== null}
                            className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-35"
                        >
                            {busy === 'call' ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : (
                                <Phone className="size-5" />
                            )}
                            {tr('Подзвонити')}
                        </button>
                    </div>
                </section>

                <div className="flex flex-col gap-4">
                    {/* Мій номер */}
                    <section className="glass rounded-3xl p-5">
                        <p className="text-xs font-medium tracking-wide text-white/45 uppercase">
                            {tr('Мій номер')}
                        </p>
                        {props.phone ? (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <PhoneBadge
                                    phone={props.phone}
                                    size="lg"
                                    showLabel
                                />
                                <span className="text-xs text-white/40">
                                    {props.phone.kind === 'purchased'
                                        ? tr('Куплений')
                                        : tr('Випадковий, безкоштовний')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setChanging((v) => !v)}
                                    className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.1]"
                                >
                                    <Repeat2 className="size-4" />
                                    {changing
                                        ? tr('Сховати')
                                        : tr('Змінити номер')}
                                </button>
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-white/55">
                                {tr(
                                    'У вас ще немає номера — оберіть випадковий безкоштовно або купіть гарний.',
                                )}
                            </p>
                        )}
                        {props.phone?.kind === 'purchased' &&
                            !props.outgoing.some(
                                (o) => o.kind === 'transfer',
                            ) && (
                                <TransferForm
                                    phone={props.phone}
                                    friends={props.friends}
                                />
                            )}
                    </section>

                    <IncomingOffers
                        offers={props.incoming}
                        mine={props.phone}
                    />
                    <OutgoingOffers
                        offers={props.outgoing}
                        gifts={props.gifts}
                        friends={props.friends}
                    />

                    {/* Приватність */}
                    <Widget
                        title={tr('Хто може дзвонити й писати за номером')}
                        icon={ShieldCheck}
                    >
                        <div
                            className="grid grid-cols-3 gap-1.5"
                            role="radiogroup"
                        >
                            {(
                                [
                                    ['everyone', tr('Усі')],
                                    ['friends', tr('Друзі')],
                                    ['nobody', tr('Ніхто')],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={props.privacy === value}
                                    onClick={() =>
                                        saveSettings(value, props.visible)
                                    }
                                    className={cn(
                                        'h-10 rounded-xl text-sm font-medium transition',
                                        props.privacy === value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.09]',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-white">
                            <input
                                type="checkbox"
                                checked={props.visible}
                                onChange={(e) =>
                                    saveSettings(
                                        props.privacy,
                                        e.target.checked,
                                    )
                                }
                                className="gc-switch"
                            />
                            {tr('Показувати номер у профілі')}
                        </label>
                    </Widget>
                </div>
            </div>

            {/* Вибір чи зміна номера — на всю ширину, щоб обидві картки мали місце. */}
            {changing && (
                <NumberPicker
                    props={props}
                    friends={props.friends}
                    className="mt-4"
                />
            )}

            {/* Історія дзвінків */}
            <Widget title={tr('Останні дзвінки')} icon={Phone} className="mt-4">
                {props.history.length === 0 ? (
                    <EmptyState
                        icon={PhoneMissed}
                        title={tr('Дзвінків ще не було')}
                        text={tr(
                            'Наберіть номер друга або подзвоніть із чату.',
                        )}
                    />
                ) : (
                    <ul className="divide-y divide-white/[0.05]">
                        {props.history.map((call) => {
                            const Icon =
                                call.direction === 'out'
                                    ? PhoneOutgoing
                                    : call.direction === 'in'
                                      ? PhoneIncoming
                                      : PhoneMissed;

                            return (
                                <li
                                    key={call.id}
                                    className="flex items-center gap-3 py-2.5"
                                >
                                    <UserAvatar user={call.user} size="md" />
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={cn(
                                                'truncate text-sm font-semibold',
                                                call.direction === 'missed'
                                                    ? 'text-red-300'
                                                    : 'text-white',
                                            )}
                                        >
                                            {call.user.name}
                                        </p>
                                        <p className="flex items-center gap-1.5 text-xs text-white/45">
                                            <Icon className="size-3.5" />
                                            {new Date(call.at).toLocaleString(
                                                'uk-UA',
                                                {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                },
                                            )}
                                            {call.seconds !== null &&
                                                ` · ${Math.floor(call.seconds / 60)}:${String(call.seconds % 60).padStart(2, '0')}`}
                                            {call.phone && (
                                                <>
                                                    {' · '}
                                                    <PhoneBadge
                                                        phone={call.phone}
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void startCall({
                                                id: call.conversation_id,
                                                title: call.user.name,
                                            })
                                        }
                                        aria-label={tr('Подзвонити')}
                                        className="flex size-10 items-center justify-center rounded-full bg-white/[0.05] text-emerald-300 transition hover:bg-white/[0.1]"
                                    >
                                        <Phone className="size-4" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Widget>
        </>
    );
}
