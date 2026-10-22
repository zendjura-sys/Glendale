import { Link, usePage } from '@inertiajs/react';
import { Sparkles, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';

/** Банер «Твої підсумки року готові» у стрічці — лише в сезон (грудень — січень); хрестик ховає до наступного року. */
export function WrappedBanner() {
    const year = usePage().props.site.wrapped ?? null;
    const reduce = useReducedMotion();
    const key = `gc-wrapped-hidden-${year}`;
    const [hidden, setHidden] = useState(true);

    useEffect(() => {
        try {
            setHidden(localStorage.getItem(key) === '1');
        } catch {
            setHidden(false);
        }
    }, [key]);

    if (!year) return null;

    const hide = () => {
        setHidden(true);
        try {
            localStorage.setItem(key, '1');
        } catch {
            // Без сховища — просто ховаємо до перезавантаження.
        }
    };

    return (
        <AnimatePresence>
            {!hidden && (
                <m.div
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, height: 0 }}
                    transition={motionOr(reduce, RISE)}
                    className="relative overflow-hidden rounded-3xl text-white"
                    style={{
                        background:
                            'radial-gradient(90% 120% at 0% 0%, #2f7bff 0%, transparent 60%), radial-gradient(90% 120% at 100% 100%, #22d3ee 0%, transparent 60%), #050913',
                    }}
                >
                    <Link
                        href="/wrapped"
                        className="flex items-center gap-4 p-5 pr-14"
                    >
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                            <Sparkles className="size-6" />
                        </span>
                        <span className="min-w-0">
                            <span className="block font-display text-lg font-bold">
                                {tr('Твій {year} у GameCon', { year })}
                            </span>
                            <span className="block text-sm text-white/75">
                                {tr(
                                    'Підсумки року готові — подивися й поділися з друзями.',
                                )}
                            </span>
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={hide}
                        aria-label={tr('Сховати')}
                        className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <X className="size-5" />
                    </button>
                </m.div>
            )}
        </AnimatePresence>
    );
}
