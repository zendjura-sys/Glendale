import { Head, router } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { BillingHost } from '@/components/billing/billing-host';
import { Logo } from '@/components/gc/logo';
import { PaletteSync } from '@/components/gc/palette-sync';
import { NumberPicker } from '@/components/phone/number-picker';
import { PhoneBadge } from '@/components/phone/phone-badge';
import { tr } from '@/lib/i18n';
import { EASE_OUT, motionOr, RISE } from '@/lib/motion';
import type { PickerProps } from '@/lib/phones';
import type { PhoneCard } from '@/types';

/**
 * Перший крок після реєстрації (далі — вибір режиму): внутрішній номер GameCon. Випадковий — безкоштовно (+555) з шансом на рідкісний,
 * або купити гарний (+777). Можна відкласти — номер завжди є в розділі «Телефон».
 */
export default function StartPhone(props: PickerProps) {
    const reduce = useReducedMotion();
    const [phone, setPhone] = useState<PhoneCard | null>(props.phone);
    const [sending, setSending] = useState(false);
    const rise = (i: number) =>
        reduce
            ? {}
            : {
                  initial: { opacity: 0, y: 24 },
                  animate: { opacity: 1, y: 0 },
                  transition: {
                      duration: 0.6,
                      ease: EASE_OUT,
                      delay: 0.1 + i * 0.07,
                  },
              };

    const next = () => {
        setSending(true);
        router.post('/start/phone', {}, { onFinish: () => setSending(false) });
    };

    return (
        <>
            <Head title={tr('Твій номер у GameCon')} />
            <PaletteSync />
            <SiteBackground />
            <BillingHost />

            <main
                id="main-content"
                className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-36 sm:px-6"
            >
                <m.div {...rise(0)} className="flex justify-center">
                    <Logo />
                </m.div>

                <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
                    <m.p
                        {...rise(1)}
                        className="text-sm font-medium text-primary"
                    >
                        {tr('Ласкаво просимо!')}
                    </m.p>
                    <m.h1
                        {...rise(2)}
                        className="mt-3 font-display text-[clamp(2rem,5vw,3.2rem)] leading-[1.05] font-bold tracking-tight text-balance text-white"
                    >
                        {tr('Твій номер у GameCon')}
                    </m.h1>
                    <m.p
                        {...rise(3)}
                        className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-white/65 sm:text-base"
                    >
                        {tr(
                            'Внутрішній номер, як у грі: за ним тобі можуть подзвонити чи написати, а рідкісний номер видно в профілі. Він не пов’язаний зі справжнім телефоном.',
                        )}
                    </m.p>
                </header>

                <m.div {...rise(4)} className="mt-10">
                    <NumberPicker
                        props={{ ...props, phone }}
                        onPhone={setPhone}
                    />
                </m.div>
            </main>

            <m.div
                initial={reduce ? false : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionOr(reduce, { ...RISE, delay: 0.5 })}
                className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
            >
                <div className="liquid-glass liquid-glass--dense pointer-events-auto flex w-full max-w-[560px] items-center gap-3 rounded-[24px] py-2.5 pr-2.5 pl-5">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/60">
                        {phone ? (
                            <PhoneBadge phone={phone} size="sm" />
                        ) : (
                            tr('Номер можна взяти й пізніше')
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={next}
                        disabled={sending}
                        className="btn-glow inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold disabled:opacity-60"
                    >
                        {phone ? tr('Продовжити') : tr('Пізніше')}
                        <ArrowRight className="size-4" />
                    </button>
                </div>
            </m.div>
        </>
    );
}
