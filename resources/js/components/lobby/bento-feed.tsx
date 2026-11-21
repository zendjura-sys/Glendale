import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PostItem } from '@/types';
import { cn } from '@/lib/utils';
import { MediaCarouselContext } from '@/components/gc/media-grid';

/**
 * Форма клітинки бенто за вмістом запису: горизонтальне фото чи мозаїка — широка (2 колонки),
 * вертикальне фото, опитування, короткий текст — звичайна. Висоту дає сам вміст (без розтягування).
 */
export function bentoShape(post: PostItem): 'wide' | 'normal' {
    const media = post.attachments ?? [];
    const first = media[0];
    if (first?.width && first.height) {
        return first.width / first.height >= 1.2 ? 'wide' : 'normal';
    }
    if (!media.length && !post.poll && (post.body?.length ?? 0) > 420) {
        return 'wide';
    }
    return 'normal';
}

/**
 * Клітинка бенто: рядки сітки по 1px, тож клітинка займає рівно стільки рядків, скільки
 * пікселів у її вмісті (+ проміжок). Так картки різної висоти щільно складаються без дір.
 */
/** Висота вмісту → кількість рядків сітки по 1px (+ проміжок): щільне бенто без дір. */
export function useRowSpan(enabled = true) {
    const ref = useRef<HTMLDivElement>(null);
    const [rows, setRows] = useState<number | null>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || !enabled) {
            setRows(null);
            return;
        }
        const measure = () =>
            setRows(Math.ceil(el.getBoundingClientRect().height));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [enabled]);

    const style =
        rows === null || !enabled
            ? undefined
            : { gridRowEnd: `span ${rows + BENTO_GAP}` };

    return { ref, style, rows };
}

/** Клітинка бенто стрічки «Для вас». */
export function BentoCell({
    post,
    badge,
    children,
}: {
    post: PostItem;
    /** Мітка в куті (що це): «Допис». */
    badge?: string;
    children: ReactNode;
}) {
    const { ref, style } = useRowSpan();

    return (
        <div
            className={cn(
                'gc-bento-cell',
                bentoShape(post) === 'wide' && 'is-wide',
            )}
            style={style}
        >
            <div ref={ref} className="gc-live-block">
                {badge && (
                    <span className="gc-live-badge">
                        <span className="gc-live-badge__pill">{badge}</span>
                    </span>
                )}
                <MediaCarouselContext.Provider value>
                    {children}
                </MediaCarouselContext.Provider>
            </div>
        </div>
    );
}

/** Проміжок між картками бенто, px (мінімальний — як у макеті). */
export const BENTO_GAP = 6;

/**
 * Живий блок лобі: клітинка бенто з міткою в куті — що відбувається зараз
 * (LIVE, GameCast, «Виконується зміна»…). Висота — за вмістом, ширина — 1 або 2 колонки.
 */
export function LiveBlock({
    badge,
    tone,
    wide = false,
    isNew = false,
    children,
}: {
    badge?: string;
    /** Додано за останні 7 днів — червона бірка «New!». */
    isNew?: boolean;
    tone?: 'live' | 'alert' | 'accent';
    wide?: boolean;
    children: ReactNode;
}) {
    const { ref, style, rows } = useRowSpan();

    return (
        <div
            className={cn('gc-bento-cell', wide && 'is-wide')}
            // Порожній блок (у категорії зараз нічого не відбувається) не займає місця.
            style={rows !== null && rows <= 40 ? { display: 'none' } : style}
        >
            <div ref={ref} className="gc-live-block">
                {(badge || isNew) && (
                    <span className="gc-live-badge">
                        {isNew && <span className="gc-new-tag">New!</span>}
                        {badge && (
                            <span
                                className={cn(
                                    'gc-live-badge__pill',
                                    tone && `gc-live-badge--${tone}`,
                                )}
                            >
                                {tone === 'live' || tone === 'alert' ? (
                                    <span
                                        className="gc-live-badge__dot"
                                        aria-hidden
                                    />
                                ) : null}
                                {badge}
                            </span>
                        )}
                    </span>
                )}
                {children}
            </div>
        </div>
    );
}
