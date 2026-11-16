import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
            <img
                src={items[current].url}
                alt=""
                className="max-h-[90vh] max-w-[92vw] animate-in rounded-xl object-contain shadow-2xl zoom-in-95"
                onClick={(event) => event.stopPropagation()}
            />
            <button
                type="button"
                className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
                onClick={onClose}
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
                    <div className="absolute bottom-6 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
                        {current + 1} / {items.length}
                    </div>
                </>
            )}
        </div>,
        document.body,
    );
}

/**
 * Сітка фото у стилі ВК: 1 — велике, 2 — пополам, 3 — велике + 2, 4+ — 2×2 з «+N».
 */
export function MediaGrid({ items }: { items: Attachment[] }) {
    const [open, setOpen] = useState<number | null>(null);

    if (items.length === 0) {
        return null;
    }

    const visible = items.slice(0, 4);
    const rest = items.length - visible.length;
    const layout =
        items.length === 1
            ? 'grid-cols-1'
            : items.length === 2
              ? 'grid-cols-2'
              : items.length === 3
                ? 'grid-cols-2 grid-rows-2'
                : 'grid-cols-2 grid-rows-2';

    return (
        <>
            <div
                className={cn(
                    'grid gap-1 overflow-hidden rounded-2xl',
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
                            'group relative overflow-hidden bg-white/5',
                            items.length === 3 && index === 0 && 'row-span-2',
                        )}
                    >
                        <img
                            src={item.url}
                            alt=""
                            loading="lazy"
                            className={cn(
                                'size-full object-cover transition duration-500 group-hover:scale-[1.03]',
                                items.length === 1 && 'max-h-[560px]',
                            )}
                            style={
                                items.length === 1 && item.width && item.height
                                    ? {
                                          aspectRatio: `${item.width} / ${item.height}`,
                                      }
                                    : undefined
                            }
                        />
                        {rest > 0 && index === 3 && (
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
