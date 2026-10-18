import { router } from '@inertiajs/react';
import {
    Dices,
    Gift,
    Loader2,
    ShoppingBag,
    Sparkles,
    Wand2,
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FriendSelect } from '@/components/phone/friend-select';
import { PhoneBadge } from '@/components/phone/phone-badge';
import { PlusBadge } from '@/components/gc/plus';
import { api, ApiError } from '@/lib/api';
import { money, openPurchase } from '@/lib/billing';
import { tr } from '@/lib/i18n';
import { PHONE_TIERS, percent, TIER_HINTS, TIER_LABELS } from '@/lib/phones';
import type { PhoneCheck, PickerProps } from '@/lib/phones';
import { cn } from '@/lib/utils';
import type { PhoneCard, PhoneTier, UserCard } from '@/types';

/**
 * Вибір внутрішнього номера: «Випадковий» (безкоштовно, +555, з шансом на рідкісний) або «Купити» (+777:
 * свій код оператора 01–99 і 7 цифр, сайт одразу показує рівень, ціну й чи номер вільний).
 */
export function NumberPicker({
    props,
    onPhone,
    friends,
    className,
}: {
    props: PickerProps;
    onPhone?: (phone: PhoneCard) => void;
    /** Друзі — тоді номер можна купити в подарунок. */
    friends?: UserCard[];
    className?: string;
}) {
    return (
        <div className={cn('grid gap-3 lg:grid-cols-2', className)}>
            <RandomCard props={props} onPhone={onPhone} />
            <BuyCard props={props} friends={friends} />
        </div>
    );
}

const randomDigits = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

function RandomCard({
    props,
    onPhone,
}: {
    props: PickerProps;
    onPhone?: (phone: PhoneCard) => void;
}) {
    const reduce = useReducedMotion();
    const labels = TIER_LABELS();
    const [rolling, setRolling] = useState(false);
    const [scramble, setScramble] = useState<string | null>(null);
    const [result, setResult] = useState<PhoneCard | null>(null);
    const [next, setNext] = useState(props.nextRandomAt);
    const timer = useRef<number | null>(null);
    useEffect(() => setNext(props.nextRandomAt), [props.nextRandomAt]);
    useEffect(
        () => () => {
            if (timer.current) window.clearInterval(timer.current);
        },
        [],
    );

    const locked = next !== null && new Date(next).getTime() > Date.now();
    // Куплений номер не міняється на випадковий — лише на інший куплений.
    const purchased = props.phone?.kind === 'purchased';

    const roll = async () => {
        setRolling(true);
        setResult(null);
        // «Барабан»: цифри перебираються, поки сервер обирає номер.
        if (!reduce) {
            timer.current = window.setInterval(
                () =>
                    setScramble(
                        `+${props.codes.random} (${randomDigits(2)}) ${randomDigits(3)}-${randomDigits(2)}-${randomDigits(2)}`,
                    ),
                70,
            );
        }
        const started = Date.now();
        try {
            const data = await api<{
                phone: PhoneCard;
                next_random_at: string | null;
            }>('POST', '/phone/random');
            await new Promise((resolve) =>
                window.setTimeout(
                    resolve,
                    reduce ? 0 : Math.max(0, 1300 - (Date.now() - started)),
                ),
            );
            setResult(data.phone);
            setNext(data.next_random_at);
            onPhone?.(data.phone);
            router.reload();
            if (data.phone.tier !== 'regular') {
                toast.success(
                    tr('Пощастило! {tier} номер безкоштовно.', {
                        tier: labels[data.phone.tier],
                    }),
                );
            }
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? (Object.values(e.errors)[0]?.[0] ?? e.message)
                    : tr('Щось пішло не так. Спробуйте ще раз.'),
            );
        } finally {
            if (timer.current) window.clearInterval(timer.current);
            timer.current = null;
            setScramble(null);
            setRolling(false);
        }
    };

    return (
        <section className="glass flex min-w-0 flex-col rounded-3xl p-4 sm:p-5">
            <header className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                    <Dices className="size-5" />
                </span>
                <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Випадковий номер')}
                    </h3>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Безкоштовно, мережа +{code}. Є шанс одразу отримати рідкісний!',
                            { code: props.codes.random },
                        )}
                    </p>
                </div>
            </header>

            <div className="mt-4 flex min-h-[5.5rem] items-center justify-center rounded-2xl bg-white/[0.03] px-3 py-5 text-center">
                {scramble ? (
                    <span className="text-2xl font-semibold tracking-tight text-white/70 tabular-nums sm:text-3xl">
                        {scramble}
                    </span>
                ) : result ? (
                    <div className="flex flex-col items-center gap-2">
                        <PhoneBadge phone={result} size="lg" />
                        <span className="text-xs text-white/50">
                            {result.tier === 'regular'
                                ? tr('Ваш новий номер')
                                : tr('{tier} номер — пощастило!', {
                                      tier: labels[result.tier],
                                  })}
                        </span>
                    </div>
                ) : (
                    <span className="text-sm text-white/40">
                        {tr('Натисніть кнопку — і номер ваш')}
                    </span>
                )}
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {PHONE_TIERS.filter((t) => t !== 'regular').map((tier) => (
                    <li
                        key={tier}
                        className={cn(
                            'flex items-center justify-between gap-2',
                            `phone-tier--${tier}`,
                        )}
                    >
                        <span className="text-[color:var(--tier)]">
                            {labels[tier]}
                        </span>
                        <span className="whitespace-nowrap text-white/45 tabular-nums">
                            {percent(
                                props.chances[
                                    tier as Exclude<PhoneTier, 'regular'>
                                ],
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            <div className="mt-auto pt-5">
                <button
                    type="button"
                    onClick={() => void roll()}
                    disabled={rolling || locked || purchased}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.08] text-[15px] font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-50"
                >
                    {rolling ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Sparkles className="size-4" />
                    )}
                    {props.phone
                        ? tr('Змінити безкоштовно')
                        : tr('Отримати номер')}
                </button>
                <p className="mt-2 text-center text-xs text-white/40">
                    {purchased
                        ? tr(
                              'У вас куплений номер — змінити його можна лише на інший куплений.',
                          )
                        : locked
                          ? tr('Наступна безкоштовна зміна — {date}', {
                                date: new Date(next as string).toLocaleString(
                                    'uk-UA',
                                    {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    },
                                ),
                            })
                          : tr(
                                'Змінювати випадковий номер можна безкоштовно раз на {n} дн.',
                                { n: props.cooldownDays },
                            )}
                </p>
            </div>
        </section>
    );
}

function BuyCard({
    props,
    friends,
}: {
    props: PickerProps;
    friends?: UserCard[];
}) {
    const labels = TIER_LABELS();
    const [gift, setGift] = useState(false);
    const [giftTo, setGiftTo] = useState<number | null>(null);
    const hints = TIER_HINTS();
    const [operator, setOperator] = useState('');
    const [digits, setDigits] = useState('');
    const [check, setCheck] = useState<PhoneCheck | null>(null);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tier, setTier] = useState<PhoneTier | null>(null);
    const [ideas, setIdeas] = useState<PhoneCheck[] | null>(null);
    const [loadingIdeas, setLoadingIdeas] = useState(false);
    const digitsRef = useRef<HTMLInputElement>(null);

    const complete = /^\d{2}$/.test(operator) && /^\d{7}$/.test(digits);

    // Перевірка номера, щойно введено всі цифри (з невеликою паузою).
    useEffect(() => {
        setCheck(null);
        setError(null);
        if (!complete) return;
        setChecking(true);
        const handle = window.setTimeout(() => {
            api<PhoneCheck>(
                'GET',
                `/phone/check?operator=${operator}&digits=${digits}`,
            )
                .then(setCheck)
                .catch((e) =>
                    setError(
                        e instanceof ApiError
                            ? (Object.values(e.errors)[0]?.[0] ?? e.message)
                            : tr('Не вдалося перевірити номер.'),
                    ),
                )
                .finally(() => setChecking(false));
        }, 300);

        return () => window.clearTimeout(handle);
    }, [operator, digits, complete]);

    const suggest = async (picked: PhoneTier) => {
        setTier(picked);
        setLoadingIdeas(true);
        try {
            const op = /^\d{2}$/.test(operator) ? `&operator=${operator}` : '';
            const data = await api<{ numbers: PhoneCheck[] }>(
                'GET',
                `/phone/suggest?tier=${picked}${op}`,
            );
            setIdeas(data.numbers);
        } catch {
            setIdeas([]);
        } finally {
            setLoadingIdeas(false);
        }
    };

    const buy = () => {
        if (!check?.available || (gift && !giftTo)) return;
        openPurchase({
            product: check.product,
            extra: {
                phone_operator: check.operator,
                phone_digits: check.digits,
                ...(gift && giftTo ? { gift_to: giftTo } : {}),
            },
        });
    };

    const digitsShown = digits.replace(
        /^(\d{3})(\d{0,2})(\d{0,2}).*$/,
        (_, a, b, c) => [a, b, c].filter(Boolean).join('-'),
    );

    return (
        <section className="glass flex min-w-0 flex-col rounded-3xl p-4 sm:p-5">
            <header className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                    <ShoppingBag className="size-5" />
                </span>
                <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Купити гарний номер')}
                    </h3>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Мережа +{code}: свій код оператора й цифри. Ціна — за рівнем номера.',
                            { code: props.codes.premium },
                        )}
                        {props.isPlus && props.discount > 0 && (
                            <span className="ml-1 inline-flex items-center gap-1 text-white/80">
                                <PlusBadge className="size-3.5" />
                                {tr('−{n}% для вас', { n: props.discount })}
                            </span>
                        )}
                    </p>
                </div>
            </header>

            <div className="mt-4 flex items-center gap-1.5 rounded-2xl bg-white/[0.04] px-3 py-2 text-xl font-semibold tracking-tight text-white tabular-nums ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-primary sm:text-2xl">
                <span className="text-white/50">+{props.codes.premium}</span>
                <span className="text-white/40">(</span>
                <input
                    value={operator}
                    onChange={(e) => {
                        const value = e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 2);
                        setOperator(value);
                        if (value.length === 2) digitsRef.current?.focus();
                    }}
                    inputMode="numeric"
                    placeholder="01"
                    aria-label={tr('Код оператора (01–99)')}
                    className="w-[2.4ch] bg-transparent text-center outline-none placeholder:text-white/20"
                />
                <span className="text-white/40">)</span>
                <input
                    ref={digitsRef}
                    value={digitsShown}
                    onChange={(e) =>
                        setDigits(e.target.value.replace(/\D/g, '').slice(0, 7))
                    }
                    inputMode="numeric"
                    placeholder="777-77-77"
                    aria-label={tr('Номер, 7 цифр')}
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/20"
                />
                {checking && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-white/40" />
                )}
            </div>

            <div className="mt-3 min-h-[3.25rem]" aria-live="polite">
                {error && <p className="text-sm text-red-300">{error}</p>}
                {check && (
                    <div
                        className={cn(
                            'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2.5',
                            `phone-tier--${check.tier}`,
                            'phone-tier-ring',
                        )}
                    >
                        <span className="text-sm font-semibold text-[color:var(--tier)]">
                            {labels[check.tier]}
                        </span>
                        <span className="text-sm text-white/70">
                            {check.available ? (
                                <>
                                    {money(check.price)}
                                    {check.price < check.full_price && (
                                        <s className="ml-1.5 text-white/35">
                                            {money(check.full_price)}
                                        </s>
                                    )}
                                </>
                            ) : (
                                check.reason
                            )}
                        </span>
                    </div>
                )}
                {!check && !error && (
                    <p className="text-xs text-white/40">
                        {tr(
                            'Введіть код оператора й 7 цифр — побачите рівень і ціну. Або підберіть готовий нижче.',
                        )}
                    </p>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                {PHONE_TIERS.map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => void suggest(t)}
                        title={hints[t]}
                        className={cn(
                            'rounded-xl px-2.5 py-1.5 text-xs font-medium transition',
                            `phone-tier--${t}`,
                            tier === t
                                ? 'phone-tier-ring text-[color:var(--tier)]'
                                : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]',
                        )}
                    >
                        {labels[t]} · {money(props.prices[t].price)}
                    </button>
                ))}
            </div>

            {tier && (
                <div className="mt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-white/45">
                        <Wand2 className="size-3.5" />
                        {hints[tier]}
                    </p>
                    {loadingIdeas ? (
                        <Loader2 className="size-4 animate-spin text-white/40" />
                    ) : ideas && ideas.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {ideas.map((idea) => (
                                <button
                                    key={idea.operator + idea.digits}
                                    type="button"
                                    onClick={() => {
                                        setOperator(idea.operator);
                                        setDigits(idea.digits);
                                    }}
                                    className="rounded-xl bg-white/[0.04] px-2.5 py-1.5 transition hover:bg-white/[0.08]"
                                >
                                    <PhoneBadge phone={idea} size="sm" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-white/40">
                            {tr(
                                'Вільних номерів цього рівня з таким кодом не знайшлося.',
                            )}
                        </p>
                    )}
                </div>
            )}

            {friends && (
                <div className="mt-4 rounded-2xl bg-white/[0.03] p-3">
                    <label className="flex min-h-9 items-center gap-3 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={gift}
                            onChange={(e) => setGift(e.target.checked)}
                            className="gc-switch"
                        />
                        <Gift className="size-4 text-pink-300" />
                        {tr('Подарувати другові')}
                    </label>
                    {gift && (
                        <>
                            <FriendSelect
                                friends={friends}
                                value={giftTo}
                                onChange={setGiftTo}
                                className="mt-2"
                            />
                            <p className="mt-2 text-xs text-white/40">
                                {tr(
                                    'Друг отримає сповіщення й сам прийме подарунок. Якщо відмовиться — номер лишиться у вас: подаруєте іншому або візьмете собі.',
                                )}
                            </p>
                        </>
                    )}
                </div>
            )}

            <div className="mt-auto pt-5">
                <button
                    type="button"
                    onClick={buy}
                    disabled={!check?.available || (gift && !giftTo)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--btn-primary,#6366f1)] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                    {gift ? (
                        <Gift className="size-4" />
                    ) : (
                        <ShoppingBag className="size-4" />
                    )}
                    {check?.available
                        ? gift
                            ? tr('Подарувати за {price}', {
                                  price: money(check.price),
                              })
                            : tr('Купити за {price}', {
                                  price: money(check.price),
                              })
                        : tr('Купити номер')}
                </button>
                <p className="mt-2 text-center text-xs text-white/40">
                    {tr(
                        'Купити новий номер можна будь-коли. Кожен номер існує лише в одного власника.',
                    )}
                </p>
            </div>
        </section>
    );
}
