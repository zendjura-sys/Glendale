import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import SHOTS from './help-shots';

/**
 * Скриншот у тексті статті довідки: справжній кадр сайту з номерами на кнопках
 * і підписами під ним «що це й куди натиснути». Кадри й координати зон знімає
 * scripts/help-shots.cjs (help-shots.ts), тексти міток — у HelpCatalog.
 */
type Region = { x: number; y: number; w: number; h: number };
export type HelpShotMeta = {
    src: string;
    w: number;
    h: number;
    phone: boolean;
    regions: Record<string, Region>;
};

export type HelpShotPin = { at: string; text: string };

export function HelpShot({
    shot,
    alt,
    pins,
    renderText,
}: {
    shot: string;
    alt: string;
    pins: HelpShotPin[];
    renderText: (text: string) => React.ReactNode;
}) {
    const reduce = useReducedMotion();
    const [active, setActive] = useState<number | null>(null);
    const meta = SHOTS[shot];
    if (!meta) return null;
    const marks = pins
        .map((pin, i) => ({ ...pin, n: i + 1, box: meta.regions[pin.at] }))
        .filter((pin) => pin.box);

    return (
        <figure className="not-prose space-y-3">
            <div
                className={cn(
                    'relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10',
                    meta.phone && 'mx-auto max-w-[300px] rounded-[28px]',
                )}
            >
                <img
                    src={meta.src}
                    width={meta.w}
                    height={meta.h}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className="block h-auto w-full"
                />
                {marks.map((pin) => {
                    const dim = active !== null && active !== pin.n;

                    return (
                        <div
                            key={pin.n}
                            aria-hidden
                            className={cn(
                                'pointer-events-none absolute rounded-md ring-2 ring-primary transition-opacity duration-200',
                                active === pin.n
                                    ? 'bg-primary/20'
                                    : 'bg-primary/[0.08]',
                                dim && 'opacity-25',
                            )}
                            style={{
                                left: `${pin.box.x}%`,
                                top: `${pin.box.y}%`,
                                width: `${pin.box.w}%`,
                                height: `${pin.box.h}%`,
                            }}
                        >
                            <m.span
                                initial={
                                    reduce ? false : { scale: 0.4, opacity: 0 }
                                }
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{
                                    delay: reduce ? 0 : pin.n * 0.08,
                                    type: 'spring',
                                    stiffness: 380,
                                    damping: 22,
                                }}
                                className={cn(
                                    'absolute grid size-6 place-items-center rounded-full bg-primary text-[12px] font-bold text-white shadow-lg ring-2 ring-black/40',
                                    pin.box.x < 3 ? 'left-1' : '-left-3',
                                    pin.box.y < 4 ? 'top-1' : '-top-3',
                                )}
                            >
                                {pin.n}
                            </m.span>
                        </div>
                    );
                })}
            </div>
            <figcaption>
                <span className="sr-only">{tr('Що на скриншоті')}: </span>
                <ol className="space-y-2">
                    {marks.map((pin) => (
                        <li
                            key={pin.n}
                            onMouseEnter={() => setActive(pin.n)}
                            onMouseLeave={() => setActive(null)}
                            className="flex gap-3 text-[14px] text-white/80"
                        >
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-bold text-white">
                                {pin.n}
                            </span>
                            <span className="min-w-0 pt-0.5">
                                {renderText(pin.text)}
                            </span>
                        </li>
                    ))}
                </ol>
            </figcaption>
        </figure>
    );
}
