import { router } from '@inertiajs/react';
import { Check, Gift, Send, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { FriendSelect } from '@/components/phone/friend-select';
import { PhoneBadge } from '@/components/phone/phone-badge';
import { tr } from '@/lib/i18n';
import type { PhoneCard, UserCard } from '@/types';

export type PhoneOfferCard = {
    id: number;
    kind: 'gift' | 'transfer';
    phone: PhoneCard;
    from: UserCard;
    to: UserCard;
    created_at: string;
};

export type UnusedGift = PhoneCard & { id: number };

const btn =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-40';
const opts = { preserveScroll: true };

/** Вхідні пропозиції: друг дарує чи передає номер — прийняти або відмовитися. */
export function IncomingOffers({
    offers,
    mine,
}: {
    offers: PhoneOfferCard[];
    mine: PhoneCard | null;
}) {
    if (offers.length === 0) return null;

    return (
        <section className="glass rounded-2xl p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                <Gift className="size-4 text-pink-300" />
                {tr('Вам пропонують номер')}
            </h3>
            <ul className="space-y-3">
                {offers.map((offer) => (
                    <li
                        key={offer.id}
                        className="rounded-2xl bg-white/[0.04] p-3"
                    >
                        <div className="flex items-start gap-3">
                            <UserAvatar user={offer.from} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-white/70">
                                    {offer.kind === 'gift'
                                        ? tr('{name} дарує вам номер', {
                                              name: offer.from.name,
                                          })
                                        : tr('{name} передає вам свій номер', {
                                              name: offer.from.name,
                                          })}
                                </p>
                                <PhoneBadge phone={offer.phone} showLabel />
                                {mine && (
                                    <p className="mt-1 text-xs text-white/40">
                                        {tr('Ваш номер {n} звільниться.', {
                                            n: mine.number,
                                        })}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        `/phone/offers/${offer.id}/decline`,
                                        {},
                                        opts,
                                    )
                                }
                                className={`${btn} bg-white/[0.06] text-white/80 hover:bg-white/[0.1]`}
                            >
                                <X className="size-4" />
                                {tr('Відмовитися')}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        `/phone/offers/${offer.id}/accept`,
                                        {},
                                        opts,
                                    )
                                }
                                className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}
                            >
                                <Check className="size-4" />
                                {tr('Прийняти')}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Мої надіслані пропозиції (чекають відповіді) і невикористані подарунки. */
export function OutgoingOffers({
    offers,
    gifts,
    friends,
}: {
    offers: PhoneOfferCard[];
    gifts: UnusedGift[];
    friends: UserCard[];
}) {
    if (offers.length === 0 && gifts.length === 0) return null;

    return (
        <section className="glass rounded-2xl p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                <Send className="size-4 text-white/50" />
                {tr('Подарунки й передачі')}
            </h3>
            <ul className="space-y-3">
                {offers.map((offer) => (
                    <li
                        key={offer.id}
                        className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] p-3"
                    >
                        <PhoneBadge phone={offer.phone} size="sm" />
                        <span className="min-w-0 flex-1 text-sm text-white/55">
                            {tr('чекає відповіді від {name}', {
                                name: offer.to.name,
                            })}
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                router.delete(`/phone/offers/${offer.id}`, opts)
                            }
                            className={`${btn} bg-white/[0.06] text-white/70 hover:bg-white/[0.1]`}
                        >
                            {tr('Скасувати')}
                        </button>
                    </li>
                ))}
                {gifts.map((gift) => (
                    <GiftRow key={gift.id} gift={gift} friends={friends} />
                ))}
            </ul>
        </section>
    );
}

function GiftRow({ gift, friends }: { gift: UnusedGift; friends: UserCard[] }) {
    const [to, setTo] = useState<number | null>(null);

    return (
        <li className="rounded-2xl bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-center gap-2">
                <PhoneBadge phone={gift} size="sm" />
                <span className="text-xs text-white/45">
                    {tr('Подарунок без отримувача')}
                </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                <FriendSelect
                    friends={friends}
                    value={to}
                    onChange={setTo}
                    className="min-w-48 flex-1"
                />
                <button
                    type="button"
                    disabled={!to}
                    onClick={() =>
                        router.post(
                            `/phone/gifts/${gift.id}/give`,
                            { user_id: to },
                            opts,
                        )
                    }
                    className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}
                >
                    <Gift className="size-4" />
                    {tr('Подарувати')}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (
                            window.confirm(
                                tr(
                                    'Взяти номер {n} собі? Ваш поточний номер звільниться.',
                                    { n: gift.number },
                                ),
                            )
                        ) {
                            router.post(
                                `/phone/gifts/${gift.id}/claim`,
                                {},
                                opts,
                            );
                        }
                    }}
                    className={`${btn} bg-white/[0.06] text-white/80 hover:bg-white/[0.1]`}
                >
                    {tr('Взяти собі')}
                </button>
            </div>
        </li>
    );
}

/** Передати свій куплений номер другові. */
export function TransferForm({
    phone,
    friends,
}: {
    phone: PhoneCard;
    friends: UserCard[];
}) {
    const [to, setTo] = useState<number | null>(null);

    return (
        <div className="mt-4 rounded-2xl bg-white/[0.03] p-3">
            <p className="mb-2 text-sm text-white/70">
                {tr(
                    'Передати номер другові. Він перейде, коли друг прийме, а ви отримаєте безкоштовний випадковий +555.',
                )}
            </p>
            <div className="flex flex-wrap gap-2">
                <FriendSelect
                    friends={friends}
                    value={to}
                    onChange={setTo}
                    className="min-w-48 flex-1"
                />
                <button
                    type="button"
                    disabled={!to}
                    onClick={() => {
                        if (
                            window.confirm(
                                tr(
                                    'Передати номер {n}? Після згоди друга повернути його не вийде.',
                                    { n: phone.number },
                                ),
                            )
                        ) {
                            router.post(
                                '/phone/transfer',
                                { user_id: to },
                                opts,
                            );
                        }
                    }}
                    className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}
                >
                    <Send className="size-4" />
                    {tr('Передати')}
                </button>
            </div>
        </div>
    );
}
