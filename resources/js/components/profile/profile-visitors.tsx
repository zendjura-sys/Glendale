import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Visitor = UserCard & { visited_at: string; first_name?: string };

/** Компактна горизонтальна карусель «Хто заходив». */
export function ProfileVisitorsCarousel({ visitors }: { visitors: Visitor[] }) {
    const scroller = useRef<HTMLDivElement>(null);
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(false);

    const sync = () => {
        const el = scroller.current;
        if (!el) return;
        setCanPrev(el.scrollLeft > 4);
        setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    useEffect(() => {
        sync();
        const el = scroller.current;
        if (!el) return;
        el.addEventListener('scroll', sync, { passive: true });
        const ro = new ResizeObserver(sync);
        ro.observe(el);

        return () => {
            el.removeEventListener('scroll', sync);
            ro.disconnect();
        };
    }, [visitors.length]);

    const scrollBy = (dir: -1 | 1) => {
        scroller.current?.scrollBy({
            left:
                dir *
                Math.max(180, (scroller.current.clientWidth || 240) * 0.7),
            behavior: 'smooth',
        });
    };

    if (visitors.length === 0) {
        return (
            <p className="px-1 text-sm text-white/45">
                {tr('Поки ніхто не заходив.')}
            </p>
        );
    }

    return (
        <div className="relative">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
                    <Eye className="size-3.5 opacity-80" />
                    {tr('Хто заходив')}
                </p>
                <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/45 tabular-nums">
                    {visitors.length}
                </span>
            </div>

            <div className="group/visitors relative">
                {visitors.length > 6 && (
                    <>
                        <button
                            type="button"
                            aria-label={tr('Назад')}
                            onClick={() => scrollBy(-1)}
                            disabled={!canPrev}
                            className={cn(
                                'ios27-glass-capsule absolute top-[18px] -left-1 z-10 hidden size-7 items-center justify-center rounded-full text-white/80 transition lg:flex',
                                'opacity-0 group-hover/visitors:opacity-100',
                                !canPrev && 'pointer-events-none opacity-0',
                            )}
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label={tr('Далі')}
                            onClick={() => scrollBy(1)}
                            disabled={!canNext}
                            className={cn(
                                'ios27-glass-capsule absolute top-[18px] -right-1 z-10 hidden size-7 items-center justify-center rounded-full text-white/80 transition lg:flex',
                                'opacity-0 group-hover/visitors:opacity-100',
                                !canNext && 'pointer-events-none opacity-0',
                            )}
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </>
                )}

                <div
                    ref={scroller}
                    className="scrollbar-none flex snap-x snap-mandatory items-start gap-3.5 overflow-x-auto scroll-smooth px-0.5 py-1.5"
                >
                    {visitors.map((visitor) => (
                        <Link
                            key={visitor.id}
                            href={`/${visitor.username}`}
                            className="group flex w-[64px] shrink-0 snap-start flex-col items-center text-center"
                        >
                            <span className="relative size-[52px] rounded-full bg-gradient-to-b from-white/20 to-white/5 p-[2px] transition-transform duration-200 group-hover:from-white/40 group-active:scale-95">
                                <UserAvatar
                                    user={visitor}
                                    size="md"
                                    className="!size-full rounded-full bg-[#151922] [&_img]:rounded-full"
                                    showOnline={false}
                                />
                                {visitor.is_online && (
                                    <span
                                        aria-hidden
                                        className="absolute right-0.5 bottom-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-[#0D1017]"
                                    />
                                )}
                            </span>
                            <span className="mt-1.5 w-full truncate text-[11px] leading-tight font-medium text-white/85 group-hover:text-white">
                                {visitor.first_name || visitor.name}
                            </span>
                            <span className="mt-0.5 w-full truncate text-[10px] leading-tight text-white/40">
                                {formatDate(visitor.visited_at, false)}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
