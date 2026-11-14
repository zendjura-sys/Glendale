import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { GiftCardArt } from '@/components/plus/gift-card';
import type { GiftTheme } from '@/components/plus/gift-card';
import { tr } from '@/lib/i18n';

type Props = {
    gift: {
        id: number;
        days: number;
        message: string | null;
        theme: GiftTheme;
        status: 'draft' | 'scheduled' | 'delivered';
        deliver_at: string | null;
        delivered_at: string | null;
        payer: { name: string; username: string } | null;
        recipient: { name: string; username: string } | null;
    };
    /** Дивиться отримувач (а не дарувальник). */
    mine: boolean;
    plus_until: string | null;
};

const day = (iso: string) =>
    new Date(iso).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

/** Листівка подарунка GameCon+ — для отримувача (з датою дії) і дарувальника (статус вручення). */
export default function PlusGiftPage({ gift, mine, plus_until }: Props) {
    const reduce = useReducedMotion();

    return (
        <>
            <Head title={tr('Подарунок GameCon+')} />
            <div className="mx-auto max-w-md space-y-4">
                <Link
                    href="/plus"
                    className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> GameCon+
                </Link>
                <m.div
                    initial={reduce ? false : { opacity: 0, y: 24, rotate: -2 }}
                    animate={{ opacity: 1, y: 0, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                >
                    <GiftCardArt
                        theme={gift.theme}
                        from={gift.payer?.name ?? '—'}
                        to={gift.recipient?.name ?? ''}
                        days={gift.days}
                        message={gift.message}
                        className="min-h-72"
                    />
                </m.div>
                <section className="gc-solid rounded-2xl p-4 text-sm text-white/75">
                    {mine ? (
                        <p className="flex items-start gap-2">
                            <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-300" />
                            <span>
                                {plus_until
                                    ? tr(
                                          'GameCon+ уже працює — до {date}. Оберіть рамку, колір ніку й тему в налаштуваннях.',
                                          { date: day(plus_until) },
                                      )
                                    : tr('GameCon+ уже працює.')}{' '}
                                <Link
                                    href="/plus"
                                    className="font-semibold text-sky-400 hover:underline"
                                >
                                    {tr('Налаштувати')}
                                </Link>
                            </span>
                        </p>
                    ) : gift.status === 'delivered' ? (
                        <p>
                            {tr(
                                'Вручено {date} — дякуємо, що даруєте GameCon+!',
                                {
                                    date: day(gift.delivered_at ?? ''),
                                },
                            )}
                        </p>
                    ) : (
                        <p>
                            {tr(
                                'Листівку буде вручено {date} — друг отримає сповіщення.',
                                { date: day(gift.deliver_at ?? '') },
                            )}
                        </p>
                    )}
                </section>
            </div>
        </>
    );
}
