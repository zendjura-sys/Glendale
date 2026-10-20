import { Link } from '@inertiajs/react';
import { Cookie } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import {
    onConsent,
    readConsent,
    saveConsent,
    startAnalytics,
    stopAnalytics,
} from '@/lib/consent';
import type { Consent } from '@/lib/consent';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';

/**
 * Банер згоди на cookie: обов’язкові потрібні для входу й безпеки, аналітичні (Google Analytics) —
 * лише з дозволу. На телефоні стоїть над нижнім островом, на ПК — у кутку.
 * Стоїть поза сторінкою Inertia (у withApp), тому usePage тут недоступний — ідентифікатор аналітики приходить пропом.
 */
export function CookieConsent({ analytics }: { analytics: string | null }) {
    const reduce = useReducedMotion();
    const [choice, setChoice] = useState<Consent | null | undefined>(undefined);

    useEffect(() => {
        setChoice(readConsent());

        return onConsent((next) => setChoice(next));
    }, []);

    useEffect(() => {
        if (choice === 'all' && analytics) startAnalytics(analytics);
        if (choice === 'necessary') stopAnalytics();
    }, [choice, analytics]);

    const open = choice === null;

    return (
        <AnimatePresence>
            {open && (
                <m.section
                    role="dialog"
                    aria-live="polite"
                    aria-label={tr('Згода на cookie')}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    transition={motionOr(reduce, RISE)}
                    className="gc-island fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[55] mx-auto max-w-[560px] rounded-3xl p-4 text-white lg:inset-x-auto lg:right-6 lg:bottom-6 lg:mx-0 lg:w-[400px]"
                >
                    <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Cookie className="size-[18px]" />
                        </span>
                        <p className="text-sm leading-relaxed text-white/80">
                            {tr(
                                'Ми використовуємо обов’язкові cookie для входу й безпеки, а з вашого дозволу — аналітичні, щоб робити GameCon кращим.',
                            )}{' '}
                            <Link
                                href="/privacy"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                                {tr('Докладніше')}
                            </Link>
                        </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => saveConsent('necessary')}
                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white/[0.07] px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.11]"
                        >
                            {tr('Лише обов’язкові')}
                        </button>
                        <button
                            type="button"
                            onClick={() => saveConsent('all')}
                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                            {tr('Дозволити всі')}
                        </button>
                    </div>
                </m.section>
            )}
        </AnimatePresence>
    );
}
