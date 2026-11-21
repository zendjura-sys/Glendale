import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Кнопка сторінки офіційного застосунку (замість значка магазину) — таке саме скло, як інші кнопки. */
export function AppPageButton({
    className,
    onDark = false,
}: {
    className?: string;
    /** На темному банері: власне напівпрозоре тло без «скла» теми, текст завжди білий. */
    onDark?: boolean;
}) {
    return (
        <Link
            href="/app"
            data-on-dark={onDark || undefined}
            className={cn(
                'group inline-flex h-13 items-center gap-3 rounded-2xl pr-5 pl-2.5 text-white transition hover:text-white active:scale-[0.98]',
                onDark
                    ? 'bg-white/12 ring-1 ring-white/15 backdrop-blur-md ring-inset hover:bg-white/18'
                    : 'glass',
                className,
            )}
        >
            <img
                src="/images/app/logo.webp"
                alt=""
                width={34}
                height={34}
                className="size-[34px] rounded-[10px]"
            />
            <span className="text-left leading-tight">
                <span className="block text-[11px] text-white/55">
                    {tr('Android, iPhone, ПК')}
                </span>
                <span className="block text-[15px] font-semibold text-white/90">
                    {tr('Офіційний застосунок')}
                </span>
            </span>
            <ChevronRight className="size-4 text-white/45 transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}
