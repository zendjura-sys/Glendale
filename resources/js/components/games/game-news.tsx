import { ExternalLink, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RowSkeleton } from '@/components/gc/skeletons';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';

type NewsItem = {
    id: number;
    title: string;
    url: string;
    excerpt: string | null;
    patch: boolean;
    published_at: string;
};

/**
 * «Новини й патчі» гри — офіційні оголошення розробників зі Steam.
 * Вантажиться окремо від сторінки; нічого немає — блок ховається.
 */
export function GameNews({
    slug,
    onEmpty,
}: {
    slug: string;
    onEmpty?: () => void;
}) {
    const [items, setItems] = useState<NewsItem[] | null>(null);

    useEffect(() => {
        let alive = true;
        api<{ items: NewsItem[] }>('GET', `/games/${slug}/news`)
            .then((data) => {
                if (!alive) return;
                setItems(data.items);
                if (data.items.length === 0) onEmpty?.();
            })
            .catch(() => alive && onEmpty?.());

        return () => {
            alive = false;
        };
    }, [slug, onEmpty]);

    if (items === null) {
        return (
            <div className="space-y-4">
                <RowSkeleton avatar="none" />
                <RowSkeleton avatar="none" />
                <RowSkeleton avatar="none" />
            </div>
        );
    }

    return (
        <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="group block"
                    >
                        <div className="flex items-start gap-2">
                            <span className="min-w-0 flex-1 text-sm font-semibold text-white group-hover:text-gc-sky">
                                {item.title}
                            </span>
                            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-white/30 group-hover:text-white/60" />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
                            {item.patch && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-200">
                                    <Wrench className="size-3" />
                                    {tr('Патч')}
                                </span>
                            )}
                            <span>{formatDate(item.published_at, false)}</span>
                        </div>
                        {item.excerpt && (
                            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-white/60">
                                {item.excerpt}
                            </p>
                        )}
                    </a>
                </li>
            ))}
        </ul>
    );
}
