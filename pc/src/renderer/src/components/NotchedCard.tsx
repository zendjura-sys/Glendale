import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

/**
 * Фірмова картка GameCon для ПК: скруглені кути й вирізка в правому верхньому куті, де сидить
 * незалежний бейдж (лічильник, статус, перемикач).
 *
 * Геометрія — точним SVG-контуром за розміром картки (ResizeObserver): той самий path дає і
 * clip-path для скляного тла (blur), і обвідку 1px, тож рамка безперервно огинає вирізку без
 * рваних країв. Проміжок між вирізкою й бейджем однаковий по всій дузі (`gap`).
 */
export function NotchedCard({
    title,
    subtitle,
    badge,
    badgeWidth = 64,
    badgeHeight = 30,
    gap = 6,
    radius = 18,
    glow = 'cyan',
    header,
    dragHeader = false,
    children,
    className = '',
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    badge?: ReactNode;
    badgeWidth?: number;
    badgeHeight?: number;
    gap?: number;
    radius?: number;
    glow?: 'cyan' | 'violet' | 'blue';
    /** Додаткові елементи шапки ліворуч від вирізки (кнопки, меню). */
    header?: ReactNode;
    /** Шапка — зона перетягування вікна (micro-header віджета). */
    dragHeader?: boolean;
    children: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Вирізка: ширина й висота бейджа + однаковий проміжок; внутрішнє скруглення = радіус бейджа + проміжок.
    const nw = badge ? badgeWidth + gap : 0;
    const nh = badge ? badgeHeight + gap : 0;
    const inner = Math.min(badgeHeight / 2 + gap, nh);
    const path = notchPath(size.w, size.h, radius, nw, nh, inner);
    const stroke = glow === 'violet' ? '#a855f7' : glow === 'blue' ? '#6b8afd' : '#22d3ee';

    return (
        <div ref={ref} className={`relative h-full min-h-0 ${className}`}>
            {size.w > 0 && (
                <>
                    {/* Скло: обсидіан із розмиттям тла, обрізаний тим самим контуром. */}
                    <div className="absolute inset-0 bg-obsidian backdrop-blur-[20px]" style={{ clipPath: `path('${path}')` }} />
                    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h} aria-hidden>
                        <defs>
                            <linearGradient id={`edge-${glow}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stopColor={stroke} stopOpacity="0.55" />
                                <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.08" />
                                <stop offset="1" stopColor={stroke} stopOpacity="0.35" />
                            </linearGradient>
                        </defs>
                        <path d={path} fill="none" stroke={`url(#edge-${glow})`} strokeWidth="1" transform="translate(0.5 0.5)" vectorEffect="non-scaling-stroke" />
                    </svg>
                </>
            )}
            {badge && (
                <div className="absolute top-0 right-0 z-10 grid place-items-center" style={{ width: badgeWidth, height: badgeHeight }}>
                    {badge}
                </div>
            )}
            <div className="relative flex h-full min-h-0 flex-col">
                <div className={`flex shrink-0 items-start gap-2 px-4 pt-3.5 pb-2 ${dragHeader ? 'drag' : ''}`} style={{ paddingRight: nw + 12 }}>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-white">{title}</div>
                        {subtitle && <div className="truncate text-xs text-white/45">{subtitle}</div>}
                    </div>
                    {header}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
            </div>
        </div>
    );
}

/** Контур картки з вирізкою в правому верхньому куті (усі кути — дуги, без різких зламів). */
function notchPath(w: number, h: number, r: number, nw: number, nh: number, ir: number): string {
    if (w <= 0 || h <= 0) return '';
    w -= 1;
    h -= 1;
    if (!nw) {
        return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }
    const x = w - nw; // ліва межа вирізки
    const c = Math.min(ir, nh / 2); // скруглення вирізки
    return [
        `M ${r} 0`,
        `H ${x - c}`,
        `A ${c} ${c} 0 0 1 ${x} ${c}`,
        `V ${nh - c}`,
        `A ${c} ${c} 0 0 0 ${x + c} ${nh}`,
        `H ${w - r}`,
        `A ${r} ${r} 0 0 1 ${w} ${nh + r}`,
        `V ${h - r}`,
        `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
        `H ${r}`,
        `A ${r} ${r} 0 0 1 0 ${h - r}`,
        `V ${r}`,
        `A ${r} ${r} 0 0 1 ${r} 0`,
        'Z',
    ].join(' ');
}

/** Бейдж у вирізці: таблетка з числом / підписом. */
export function NotchBadge({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'violet' | 'muted' }) {
    const tones = { cyan: 'bg-neon-cyan/15 text-neon-cyan ring-neon-cyan/40', violet: 'bg-neon-violet/15 text-neon-violet ring-neon-violet/40', muted: 'bg-white/5 text-white/60 ring-white/15' };
    return <span className={`grid h-full w-full place-items-center rounded-full text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

/** Перемикач у вирізці (як «Mode-switch» у макеті). */
export function NotchToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => onChange(!on)}
            className={`no-drag relative h-full w-full rounded-full ring-1 transition ${on ? 'bg-neon-cyan/25 ring-neon-cyan/60' : 'bg-white/5 ring-white/15'}`}
        >
            <span className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full transition-all ${on ? 'left-[calc(100%-22px)] bg-neon-cyan shadow-[0_0_10px_#22d3ee]' : 'left-1 bg-white/60'}`} />
        </button>
    );
}
