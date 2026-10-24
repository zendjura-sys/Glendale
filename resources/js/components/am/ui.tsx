import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Music2, Play, Shuffle } from 'lucide-react';
import type { ReactNode } from 'react';
import { TrackCover } from '@/components/music/track-cover';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Будівельні блоки розділу «Музика» в стилі Apple Music: обкладинки, великі заголовки,
 * полиці з прокруткою вбік, плитки, кнопки «Слухати / Перемішати», значки якості звуку.
 * Кольори — змінні .am (app.css), шрифт — системний, як в iOS.
 */

export function Artwork({
    src,
    seed,
    className,
    round,
}: {
    src: string | null | undefined;
    seed?: string | number;
    className?: string;
    round?: boolean;
}) {
    return (
        <TrackCover
            url={src}
            seed={seed}
            className={cn(
                'am-art aspect-square w-full',
                round && 'rounded-full',
                className,
            )}
        />
    );
}

/** Великий заголовок сторінки (Large Title iOS) з кнопкою «назад» і діями праворуч. */
export function LargeTitle({
    title,
    back,
    actions,
    className,
}: {
    title: ReactNode;
    back?: { href: string; label: string };
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header className={cn('px-[var(--am-gutter)] pt-2 pb-3', className)}>
            {back && (
                <Link
                    href={back.href}
                    className="am-body mb-1 -ml-1.5 inline-flex min-h-11 items-center text-[var(--am-accent)]"
                >
                    <ChevronLeft className="size-7" strokeWidth={2.4} />
                    <span className="-ml-0.5">{back.label}</span>
                </Link>
            )}
            <div className="flex items-end justify-between gap-3">
                <h1 className="am-large-title min-w-0 truncate">{title}</h1>
                {actions && (
                    <div className="flex shrink-0 items-center gap-2 pb-1">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}

/** Заголовок розділу: «Нещодавно прослухане ›». */
export function SectionHeader({
    title,
    href,
    subtitle,
}: {
    title: string;
    href?: string;
    subtitle?: string;
}) {
    const heading = (
        <span className="am-title2 inline-flex items-center gap-0.5">
            {title}
            {href && (
                <ChevronRight
                    className="size-5 text-[var(--am-label2)]"
                    strokeWidth={2.6}
                />
            )}
        </span>
    );

    return (
        <div className="px-[var(--am-gutter)] pt-6 pb-2.5">
            {href ? (
                <Link href={href} className="hover:opacity-80">
                    {heading}
                </Link>
            ) : (
                heading
            )}
            {subtitle && (
                <p className="am-subhead text-[var(--am-label2)]">{subtitle}</p>
            )}
        </div>
    );
}

/** Полиця: плитки в ряд із прокруткою вбік і «прилипанням» до краю. */
export function Shelf({
    children,
    className,
    rows = 1,
}: {
    children: ReactNode;
    className?: string;
    rows?: number;
}) {
    return (
        <div
            className={cn(
                'am-shelf grid auto-cols-[var(--am-tile)] grid-flow-col gap-x-[var(--am-gap)] gap-y-2 overflow-x-auto px-[var(--am-gutter)] pb-1',
                className,
            )}
            style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
        >
            {children}
        </div>
    );
}

/** Плитка: обкладинка, назва й підпис (альбом, плейлист, виконавець — круглий). */
export function Tile({
    href,
    onClick,
    art,
    title,
    subtitle,
    className,
}: {
    href?: string;
    onClick?: () => void;
    art: ReactNode;
    title: string;
    subtitle?: string | null;
    className?: string;
}) {
    const body = (
        <>
            <div className="transition group-active:scale-[0.97]">{art}</div>
            <p className="am-footnote mt-1.5 truncate font-medium">{title}</p>
            {subtitle && (
                <p className="am-footnote break-words text-[var(--am-label2)]">
                    {subtitle}
                </p>
            )}
        </>
    );

    return href ? (
        <Link href={href} className={cn('group block min-w-0', className)}>
            {body}
        </Link>
    ) : (
        <button
            type="button"
            onClick={onClick}
            className={cn('group block min-w-0 text-left', className)}
        >
            {body}
        </button>
    );
}

/**
 * Обкладинка міксу чи станції як в Apple Music: обкладинки на весь квадрат (одна або мозаїка 2×2),
 * поверх — кольорова вуаль із градієнта, значок і великий підпис. Без обкладинок — чистий градієнт.
 */
export function MixArt({
    colors,
    covers,
    label,
    className,
    icon,
}: {
    colors: [string, string] | string[];
    covers?: string[];
    label: string;
    className?: string;
    icon?: ReactNode;
}) {
    const art = (covers ?? []).filter(Boolean);
    const grid = art.length >= 4;

    return (
        <div
            className={cn(
                'am-art relative aspect-square w-full overflow-hidden',
                className,
            )}
            style={{
                background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
            }}
        >
            {art.length > 0 && (
                <>
                    <div
                        className={cn(
                            'absolute inset-0',
                            grid && 'grid grid-cols-2 grid-rows-2',
                        )}
                    >
                        {(grid ? art.slice(0, 4) : art.slice(0, 1)).map(
                            (cover) => (
                                <img
                                    key={cover}
                                    src={cover}
                                    alt=""
                                    loading="lazy"
                                    className="size-full object-cover"
                                />
                            ),
                        )}
                    </div>
                    {/* Обкладинки — у справжніх кольорах; лише м'яке затемнення знизу під підпис. */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
                </>
            )}
            {icon && (
                <div className="absolute top-[9%] left-[9%] text-white drop-shadow">
                    {icon}
                </div>
            )}
            <p className="[container-type:inline-size] absolute right-[9%] bottom-[8%] left-[9%] text-[clamp(15px,9cqw,26px)] leading-[1.05] font-bold tracking-tight text-white drop-shadow-[0_1px_8px_rgb(0_0_0/0.35)]">
                {label}
            </p>
        </div>
    );
}

/** Кнопки «Слухати» й «Перемішати» — сірі «пігулки» з червоним текстом (сторінки альбому й плейлиста). */
export function PlayShuffle({
    onPlay,
    onShuffle,
    disabled,
}: {
    onPlay: () => void;
    onShuffle: () => void;
    disabled?: boolean;
}) {
    const button =
        'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--am-fill)] am-headline text-[var(--am-accent)] transition hover:bg-[var(--am-fill2)] active:scale-[0.98] disabled:opacity-40 sm:max-w-56';

    return (
        <div className="flex gap-3">
            <button
                type="button"
                onClick={onPlay}
                disabled={disabled}
                className={button}
            >
                <Play className="size-5 fill-current" />
                {tr('Слухати')}
            </button>
            <button
                type="button"
                onClick={onShuffle}
                disabled={disabled}
                className={button}
            >
                <Shuffle className="size-5" strokeWidth={2.4} />
                {tr('Перемішати')}
            </button>
        </div>
    );
}

/** Значок якості: «Без втрат» чи «Hi-Res без втрат» (хвиля + підпис, як в Apple Music). */
export function QualityBadge({
    quality,
    className,
}: {
    quality: 'lossy' | 'lossless' | 'hires' | null | undefined;
    className?: string;
}) {
    if (quality !== 'lossless' && quality !== 'hires') return null;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md bg-[var(--am-fill)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--am-label2)]',
                className,
            )}
            title={
                quality === 'hires'
                    ? tr('Hi-Res без втрат: понад 48 кГц')
                    : tr('Без втрат: до 48 кГц / 24 біт')
            }
        >
            <svg viewBox="0 0 16 10" className="h-2.5 w-4" aria-hidden>
                <path
                    d="M1 5h2l1-4 2 8 2-6 2 4 1-2h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            {quality === 'hires' ? tr('Hi-Res без втрат') : tr('Без втрат')}
        </span>
    );
}

/** Сегментований перемикач iOS. */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
    className,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex rounded-[9px] bg-[var(--am-fill)] p-0.5',
                className,
            )}
            role="tablist"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={option.value === value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'am-footnote h-8 flex-1 rounded-[7px] font-semibold transition',
                        option.value === value
                            ? 'bg-[var(--am-elevated)] shadow-[0_3px_8px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)]'
                            : 'text-[var(--am-label)]',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/** Рядок-посилання медіатеки: червона іконка, назва, шеврон. */
export function NavRow({
    href,
    icon,
    label,
    count,
}: {
    href: string;
    icon: ReactNode;
    label: string;
    count?: number;
}) {
    return (
        <Link
            href={href}
            className="flex min-h-12 items-center gap-4 border-b border-[var(--am-sep)] pr-1 transition active:bg-[var(--am-fill)]"
        >
            <span className="flex w-7 justify-center text-[var(--am-accent)]">
                {icon}
            </span>
            <span className="am-body flex-1">{label}</span>
            {count !== undefined && (
                <span className="am-body text-[var(--am-label2)] tabular-nums">
                    {count}
                </span>
            )}
            <ChevronRight
                className="size-5 text-[var(--am-label3)]"
                strokeWidth={2.4}
            />
        </Link>
    );
}

export function EmptyNote({
    icon,
    title,
    text,
    action,
}: {
    icon?: ReactNode;
    title: string;
    text?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center px-8 py-16 text-center">
            <span className="text-[var(--am-label3)]">
                {icon ?? <Music2 className="size-12" />}
            </span>
            <p className="am-title2 mt-3">{title}</p>
            {text && (
                <p className="am-subhead mt-1 max-w-sm text-[var(--am-label2)]">
                    {text}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

/** Червона кнопка-«пігулка» (дії на кшталт «Завантажити музику»). */
export function AccentButton({
    children,
    onClick,
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'am-headline inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--am-accent)] px-5 text-white transition hover:brightness-110 active:scale-[0.98]',
                className,
            )}
        >
            {children}
        </button>
    );
}

/** Кругла кнопка в шапці (⋯, + тощо). */
export function CircleButton({
    children,
    onClick,
    label,
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    label: string;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cn(
                'flex size-9 items-center justify-center rounded-full bg-[var(--am-fill)] text-[var(--am-accent)] transition hover:bg-[var(--am-fill2)]',
                className,
            )}
        >
            {children}
        </button>
    );
}
