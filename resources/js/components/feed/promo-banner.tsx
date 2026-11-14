import { ArrowUpRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Banner = {
    banner_id: number;
    variant_id: number;
    title: string;
    text: string | null;
    cta: string;
    tone: 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose';
    href: string;
};

const TONE: Record<Banner['tone'], string> = {
    indigo: 'from-indigo-500/25 text-indigo-200',
    sky: 'from-sky-500/25 text-sky-200',
    emerald: 'from-emerald-500/25 text-emerald-200',
    amber: 'from-amber-500/25 text-amber-200',
    rose: 'from-rose-500/25 text-rose-200',
};

const BUTTON: Record<Banner['tone'], string> = {
    indigo: 'bg-indigo-500',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500 text-black',
    rose: 'bg-rose-500',
};

/** Банер команди (A/B-тест): варіант обирає сервер, клік рахується переходом через /promo/{id}. */
export function PromoBanner({ placement = 'feed' }: { placement?: string }) {
    const reduce = useReducedMotion();
    const [banner, setBanner] = useState<Banner | null>(null);

    useEffect(() => {
        api<{ banner: Banner | null }>('GET', `/promo/slot/${placement}`)
            .then((d) => setBanner(d.banner))
            .catch(() => undefined);
    }, [placement]);

    const dismiss = () => {
        if (!banner) return;
        void api('POST', `/promo/dismiss/${banner.banner_id}`).catch(
            () => undefined,
        );
        setBanner(null);
    };

    return (
        <AnimatePresence initial={false}>
            {banner && (
                <motion.aside
                    key={banner.variant_id}
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                        reduce
                            ? { opacity: 0 }
                            : { opacity: 0, height: 0, marginTop: 0 }
                    }
                    className={cn(
                        'gc-solid relative overflow-hidden rounded-2xl bg-gradient-to-r to-transparent p-4 pr-12',
                        TONE[banner.tone],
                    )}
                >
                    <p className="font-display text-[15px] font-bold text-white">
                        {banner.title}
                    </p>
                    {banner.text && (
                        <p className="mt-0.5 text-sm text-white/65">
                            {banner.text}
                        </p>
                    )}
                    <a
                        href={banner.href}
                        className={cn(
                            'mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-white',
                            BUTTON[banner.tone],
                        )}
                    >
                        {banner.cta}
                        <ArrowUpRight className="size-4" />
                    </a>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label={tr('Закрити')}
                        className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                    >
                        <X className="size-4" />
                    </button>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
