import { router } from '@inertiajs/react';
import { MonitorSmartphone, Play, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import type { MovieCard } from '@/types';

type Handoff = {
    key: string;
    movie: MovieCard;
    season: number | null;
    episode: number;
    time: string | null;
    device_label: string;
};

const SEEN_KEY = 'gc:handoff-seen';

/**
 * «Продовжити на цьому пристрої»: якщо фільм чи серію дивились на іншому пристрої,
 * пропонуємо продовжити тут із того самого місця. Стоїть поза сторінкою Inertia (у withApp).
 */
export function HandoffCard({ enabled }: { enabled: boolean }) {
    const reduce = useReducedMotion();
    const [offer, setOffer] = useState<Handoff | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        // Невелика пауза: спершу сторінка, потім пропозиція.
        const timer = window.setTimeout(() => {
            api<{ handoff: Handoff | null }>('GET', '/cinema/handoff')
                .then(({ handoff }) => {
                    if (!alive || !handoff) return;
                    let seen: string | null = null;
                    try {
                        seen = window.localStorage.getItem(SEEN_KEY);
                    } catch {
                        // Без сховища пропозиція може з’явитися ще раз.
                    }
                    if (seen === handoff.key) return;
                    if (window.location.pathname === handoff.movie.href) return;
                    setOffer(handoff);
                })
                .catch(() => undefined);
        }, 2500);

        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [enabled]);

    const close = (dismiss: boolean) => {
        if (!offer) return;
        try {
            window.localStorage.setItem(SEEN_KEY, offer.key);
        } catch {
            // Нічого страшного.
        }
        if (dismiss)
            void api('DELETE', '/cinema/handoff').catch(() => undefined);
        setOffer(null);
    };

    const where = offer
        ? [
              offer.season
                  ? tr('Сезон {season}, серія {episode}', {
                        season: offer.season,
                        episode: offer.episode,
                    })
                  : offer.movie.episodes_count
                    ? tr('Серія {episode}', { episode: offer.episode })
                    : null,
              offer.time,
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    return (
        <AnimatePresence>
            {offer && (
                <m.section
                    role="dialog"
                    aria-live="polite"
                    aria-label={tr('Продовжити на цьому пристрої')}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    transition={motionOr(reduce, RISE)}
                    className="gc-island fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[54] mx-auto flex max-w-[560px] items-center gap-3 rounded-2xl p-3 text-white md:inset-x-auto md:right-6 md:bottom-6 md:mx-0 md:w-[400px]"
                >
                    {offer.movie.poster ? (
                        <img
                            src={offer.movie.poster}
                            alt=""
                            className="h-16 w-11 shrink-0 rounded-lg object-cover"
                        />
                    ) : (
                        <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.07]">
                            <MonitorSmartphone className="size-5 text-white/60" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/55">
                            {tr('Ви дивились {where}', {
                                where: tr(offer.device_label),
                            })}
                        </p>
                        <p className="truncate text-sm font-semibold">
                            {offer.movie.title}
                        </p>
                        {where && (
                            <p className="truncate text-xs text-white/60">
                                {where}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            close(false);
                            router.visit(offer.movie.href);
                        }}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                        <Play className="size-4" />
                        {tr('Продовжити')}
                    </button>
                    <button
                        type="button"
                        onClick={() => close(true)}
                        aria-label={tr('Закрити')}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                    >
                        <X className="size-4" />
                    </button>
                </m.section>
            )}
        </AnimatePresence>
    );
}
