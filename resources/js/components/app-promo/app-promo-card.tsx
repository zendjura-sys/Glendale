import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Жива картка «Офіційний застосунок»: логотип G, що м'яко пливе, градієнтна грань, що повільно
 * переливається, і світіння. Веде на сторінку /app з усіма магазинами. Без посилань — не видно.
 */
export function AppPromoCard({ className }: { className?: string }) {
    const links = usePage().props.site.app_links ?? {};
    if (Object.keys(links).length === 0) return null;

    return (
        <Link
            href="/app"
            className={cn(
                'gc-live-edge gc-live-edge-strong group block rounded-[20px] p-px transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 active:scale-[0.98]',
                className,
            )}
        >
            <span className="relative flex items-center gap-3.5 overflow-hidden rounded-[19px] bg-[linear-gradient(135deg,#123058_0%,#0c1a30_55%,#0a1322_100%)] px-4 py-3.5">
                {/* Іскри довкола логотипа — повільно мерехтять. */}
                <span className="gc-sparkle pointer-events-none absolute top-2.5 left-14 size-1.5 rounded-full bg-sky-200" />
                <span className="gc-sparkle pointer-events-none absolute bottom-3 left-3 size-1 rounded-full bg-sky-300 [animation-delay:1.2s]" />
                <img
                    src="/images/app/logo.webp"
                    alt=""
                    width={52}
                    height={52}
                    className="gc-float size-[52px] shrink-0 rounded-[14px] shadow-[0_0_18px_rgba(56,189,248,0.45)]"
                />
                <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] leading-snug font-bold text-white">
                        {tr('Офіційний застосунок')}
                    </span>
                    <span className="block text-xs leading-snug text-white/65">
                        {tr('Усі сервіси на вашому смартфоні')}
                    </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Link>
    );
}
