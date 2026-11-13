import { Link } from '@inertiajs/react';
import { ChevronRight, Smartphone } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Кнопка сторінки офіційного застосунку (замість значка магазину): усі платформи на /app. */
export function AppPageButton({ className }: { className?: string }) {
    return (
        <Link
            href="/app"
            className={cn(
                'gc-live-edge group inline-flex items-center gap-3 rounded-2xl p-px transition active:scale-[0.98]',
                className,
            )}
        >
            <span className="gc-app-promo flex h-[52px] items-center gap-3 rounded-[15px] px-3.5 pr-4">
                <img
                    src="/images/app/logo.webp"
                    alt=""
                    width={34}
                    height={34}
                    className="size-[34px] rounded-[10px] shadow-[0_0_14px_rgba(56,189,248,0.45)]"
                />
                <span className="text-left leading-tight">
                    <span className="flex items-center gap-1 text-[11px] text-white/65">
                        <Smartphone className="size-3" />
                        {tr('Android, iPhone, ПК')}
                    </span>
                    <span className="block text-[15px] font-bold text-white">
                        {tr('Офіційний застосунок')}
                    </span>
                </span>
                <ChevronRight className="size-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Link>
    );
}
