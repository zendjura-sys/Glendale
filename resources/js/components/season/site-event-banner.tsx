import { Link, usePage } from '@inertiajs/react';
import { PartyPopper } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { eventColors } from '@/components/season/site-event-theme';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';

/** Тонкий банер поточної сезонної події у стрічці. */
export function SiteEventBanner() {
    const event = usePage().props.siteEvent ?? null;
    const reduce = useReducedMotion();
    if (!event) return null;
    const days = Math.max(
        0,
        Math.ceil(
            (new Date(event.ends_at).getTime() - Date.now()) / 86_400_000,
        ),
    );

    return (
        <m.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionOr(reduce, RISE)}
        >
            <Link
                href={`/season-events/${event.slug}`}
                data-on-dark
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white"
                style={{
                    backgroundImage: `linear-gradient(120deg, ${eventColors(event.theme).join(', ')})`,
                }}
            >
                <PartyPopper className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {event.title}
                </span>
                <span className="shrink-0 text-xs text-white/80">
                    {tr('Ще {n} дн.', { n: days })}
                </span>
            </Link>
        </m.div>
    );
}
