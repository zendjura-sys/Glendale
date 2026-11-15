import { ChevronLeft, ChevronRight, ImageDown, Play, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDataSaver } from '@/lib/data-saver';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/types';

export function Lightbox({
    items,
    index,
    onClose,
}: {
    items: Attachment[];
    index: number;
    onClose: () => void;
}) {
    const [current, setCurrent] = useState(index);
    const go = useCallback(
        (delta: number) =>
            setCurrent(
                (value) => (value + delta + items.length) % items.length,
            ),
        [items.length],
    );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') go(1);
            if (event.key === 'ArrowLeft') go(-1);
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [go, onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-black/90 backdrop-blur-xl fade-in"
            onClick={onClose}
        >
            {items[current].type === 'video' ? (
                <video
                    key={items[current].id}
                    src={items[current].url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[90vh] max-w-[92vw] animate-in rounded-xl zoom-in-95"
                    onClick={(event) => event.stopPropagation()}
                />
            ) : (
                <img
                    loading="lazy"
                    decoding="async"
                    src={items[current].url}
                    alt=""
                    className="max-h-[90vh] max-w-[92vw] animate-in rounded-xl object-contain zoom-in-95"
                    onClick={(event) => event.stopPropagation()}
                />
            )}
            <button
                type="button"
                className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
                onClick={onClose}
                aria-label={tr('Закрити')}
            >
                <X className="size-5" />
            </button>
            {items.length > 1 && (
                <>
                    <button
                        type="button"
                        className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                        onClick={(event) => {
                            event.stopPropagation();
                            go(-1);
                        }}
                    >
                        <ChevronLeft className="size-6" />
                    </button>
                    <button
                        type="button"
                        className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                        onClick={(event) => {
                            event.stopPropagation();
                            go(1);
                        }}
                    >
                        <ChevronRight className="size-6" />
                    </button>
                    <div className="absolute bottom-6 rounded-chip bg-white/10 px-3 py-1 text-sm text-white/80">
                        {current + 1} / {items.length}
                    </div>
                </>
            )}
        </div>,
        document.body,
    );
}

/**
 * Медіа поста: 1 — велике, 2 — пополам, 3 — велике + 2, 4–10 — карусель-альбом. Відео грають на місці.
 */
export function MediaGrid({ items }: { items: Attachment[] }) {
    const [open, setOpen] = useState<number | null>(null);
    const saver = useDataSaver();
    const [shown, setShown] = useState(false);

    if (items.length === 0) {
        return null;
    }

    // Економія трафіку: фото не вантажимо, доки людина не попросить.
    if (saver && !shown) {
        return (
            <button
                type="button"
                onClick={() => setShown(true)}
                className="gc-solid-2 flex h-28 w-full items-center justify-center gap-2 rounded-[10px] text-sm text-white/60 transition hover:bg-[var(--gc-l3)] hover:text-white"
            >
                <ImageDown className="size-4" />
                {items.length === 1
                    ? tr('Фото · натисніть, щоб завантажити')
                    : tr('{n} фото · натисніть, щоб завантажити', {
                          n: items.length,
                      })}
            </button>
        );
    }

    // Альбом із 4+ фото/відео — карусель, гортається пальцем, стрілками й крапками.
    if (items.length > 3) {
        return (
            <>
                <Carousel items={items} onOpen={setOpen} />
                {open !== null && (
                    <Lightbox
                        items={items}
                        index={open}
                        onClose={() => setOpen(null)}
                    />
                )}
            </>
        );
    }

    // Мозаїка: 3 — велике зліва й два праворуч.
    const visible = items.slice(0, 3);
    const rest = items.length - visible.length;
    const layout =
        items.length === 1
            ? 'grid-cols-1'
            : items.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-[1.25fr_1fr] grid-rows-2';

    return (
        <>
            <div
                data-media-grid
                className={cn(
                    'grid gap-2 overflow-hidden rounded-2xl',
                    layout,
                    items.length > 1 && 'aspect-[4/3]',
                )}
            >
                {visible.map((item, index) => (
                    <button
                        type="button"
                        key={item.id}
                        onClick={() => setOpen(index)}
                        className={cn(
                            'group relative overflow-hidden rounded-2xl bg-white/5',
                            items.length >= 3 && index === 0 && 'row-span-2',
                        )}
                    >
                        <MediaThumb item={item} single={items.length === 1} />
                        {rest > 0 && index === 2 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-2xl font-bold text-white backdrop-blur-sm">
                                +{rest}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            {open !== null && (
                <Lightbox
                    items={items}
                    index={open}
                    onClose={() => setOpen(null)}
                />
            )}
        </>
    );
}

/** Прев’ю в стрічці: фото або відео без звуку з позначкою «відтворити». */
function MediaThumb({ item, single }: { item: Attachment; single?: boolean }) {
    const style =
        single && item.width && item.height
            ? { aspectRatio: `${item.width} / ${item.height}` }
            : undefined;
    const cls = cn(
        'size-full object-cover transition duration-500 group-hover:scale-[1.03]',
        single && 'max-h-[560px]',
    );

    if (item.type === 'video') {
        return (
            <>
                <video
                    src={`${item.url}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className={cls}
                    style={style}
                />
                <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/55 p-3 text-white backdrop-blur-sm">
                        <Play className="size-5 fill-current" />
                    </span>
                </span>
            </>
        );
    }

    return (
        <img
            src={item.url}
            alt=""
            loading="lazy"
            className={cls}
            style={style}
        />
    );
}

/** Карусель альбому: scroll-snap, стрілки на десктопі, лічильник і крапки знизу. */
function Carousel({
    items,
    onOpen,
}: {
    items: Attachment[];
    onOpen: (index: number) => void;
}) {
    const track = useRef<HTMLDivElement>(null);
    const [current, setCurrent] = useState(0);

    const scrollTo = (index: number) => {
        const el = track.current;
        if (!el) return;
        const next = Math.max(0, Math.min(items.length - 1, index));
        el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    };

    return (
        <div className="group/carousel relative" data-media-carousel>
            <div
                ref={track}
                onScroll={(event) => {
                    const el = event.currentTarget;
                    setCurrent(Math.round(el.scrollLeft / el.clientWidth));
                }}
                className="flex aspect-[4/3] snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain rounded-2xl [&::-webkit-scrollbar]:hidden"
            >
                {items.map((item, index) => (
                    <button
                        type="button"
                        key={item.id}
                        onClick={() => onOpen(index)}
                        className="group relative size-full shrink-0 snap-center overflow-hidden bg-white/5"
                        aria-label={tr('Відкрити {n} з {total}', {
                            n: index + 1,
                            total: items.length,
                        })}
                    >
                        <MediaThumb item={item} />
                    </button>
                ))}
            </div>
            <span className="pointer-events-none absolute top-3 right-3 rounded-chip bg-black/55 px-2.5 py-1 text-xs font-semibold text-white tabular-nums backdrop-blur-sm">
                {current + 1} / {items.length}
            </span>
            {current > 0 && (
                <button
                    type="button"
                    onClick={() => scrollTo(current - 1)}
                    aria-label={tr('Попереднє')}
                    className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition group-hover/carousel:opacity-100 hover:bg-black/70 sm:block sm:opacity-0"
                >
                    <ChevronLeft className="size-5" />
                </button>
            )}
            {current < items.length - 1 && (
                <button
                    type="button"
                    onClick={() => scrollTo(current + 1)}
                    aria-label={tr('Наступне')}
                    className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition group-hover/carousel:opacity-100 hover:bg-black/70 sm:block sm:opacity-0"
                >
                    <ChevronRight className="size-5" />
                </button>
            )}
            <div className="mt-2 flex justify-center gap-1.5">
                {items.map((item, index) => (
                    <button
                        type="button"
                        key={item.id}
                        onClick={() => scrollTo(index)}
                        aria-label={tr('Перейти до {n}', { n: index + 1 })}
                        className={cn(
                            'h-1.5 rounded-full transition-all',
                            index === current
                                ? 'w-4 bg-primary'
                                : 'w-1.5 bg-white/25 hover:bg-white/45',
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
