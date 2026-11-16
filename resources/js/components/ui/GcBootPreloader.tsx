import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { playBootChime } from '@/lib/sound-fx';
import { tr } from '@/lib/i18n';
import { warmBootRoutes } from '@/lib/boot-orchestrator';

const COLD_MS = 1000;
const FAST_MS = 450;
const SEEN_KEY = 'gc_splash_seen';
const STATUSES = [
    'Ініціалізація GameCon OS...',
    'Предзавантаження інтерфейсу...',
    'Синхронізація профілю та серверів...',
] as const;

type Props = {
    /** Холодний старт вкладки vs F5 (прискорений). */
    mode?: 'cold' | 'fast';
    onDone?: () => void;
};

/**
 * Багатофазний прелоадер iOS 27+: матове скло, контур «G», % і prefetch маршрутів.
 * Монтується з app.tsx або підміняє #gc-splash-loader після гідратації.
 */
export function GcBootPreloader({ mode, onDone }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const barRef = useRef<HTMLSpanElement>(null);
    const [pct, setPct] = useState(0);
    const [status, setStatus] = useState(0);
    const [gone, setGone] = useState(false);

    useEffect(() => {
        let seen = false;
        try {
            seen = sessionStorage.getItem(SEEN_KEY) === '1';
        } catch {
            //
        }
        const fast = mode === 'fast' || seen;
        const duration = (fast ? FAST_MS : COLD_MS) / 1000;
        const reduce = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;

        warmBootRoutes();

        const path = pathRef.current;
        const bar = barRef.current;
        const root = rootRef.current;
        if (!root) return;

        const tl = gsap.timeline({
            defaults: { ease: 'power2.out' },
            onComplete: () => {
                playBootChime();
                gsap.to(root.querySelector('.gc-boot-sq'), {
                    scale: 1.12,
                    opacity: 0,
                    duration: reduce ? 0.12 : 0.32,
                    ease: 'back.out(1.6)',
                });
                root.classList.add('gc-boot-exit');
                window.setTimeout(() => {
                    try {
                        sessionStorage.setItem(SEEN_KEY, '1');
                    } catch {
                        //
                    }
                    setGone(true);
                    onDone?.();
                    (
                        window as unknown as { gcHideSplash?: () => void }
                    ).gcHideSplash?.();
                }, reduce ? 120 : 420);
            },
        });

        if (path && !reduce) {
            const len = path.getTotalLength();
            gsap.set(path, {
                strokeDasharray: len,
                strokeDashoffset: len,
            });
            tl.to(path, { strokeDashoffset: 0, duration: duration * 0.55 }, 0);
        }

        const counter = { v: 0 };
        tl.to(
            counter,
            {
                v: 100,
                duration,
                ease: 'power1.inOut',
                onUpdate: () => setPct(Math.round(counter.v)),
            },
            0,
        );

        if (bar) {
            gsap.set(bar, { xPercent: -100 });
            tl.to(
                bar,
                {
                    xPercent: 100,
                    duration: duration * 0.9,
                    ease: 'none',
                    repeat: 0,
                },
                0,
            );
        }

        const statusTimer = window.setInterval(() => {
            setStatus((s) => (s + 1) % STATUSES.length);
        }, Math.max(280, (duration * 1000) / STATUSES.length));

        return () => {
            tl.kill();
            window.clearInterval(statusTimer);
        };
    }, [mode, onDone]);

    if (gone) return null;

    return (
        <div
            ref={rootRef}
            id="gc-boot-root"
            role="status"
            aria-live="polite"
            aria-label={tr('Завантаження GameCon')}
        >
            <div className="gc-boot-sq relative mb-7 flex size-24 items-center justify-center overflow-hidden rounded-[28px] border border-white/16 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                <span
                    aria-hidden
                    className="gc-boot-shimmer pointer-events-none absolute inset-0 opacity-40"
                    style={{
                        background:
                            'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)',
                        backgroundSize: '200% 100%',
                        animation: 'gcBootShimmer 1.4s ease-in-out infinite',
                    }}
                />
                <svg
                    width="52"
                    height="52"
                    viewBox="0 0 52 52"
                    aria-hidden
                    className="relative"
                >
                    <path
                        ref={pathRef}
                        d="M40 14a17 17 0 1 0 2 20H27"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
            <div className="font-display text-sm font-bold tracking-wide tabular-nums">
                {String(pct).padStart(2, '0')}%
            </div>
            <div className="relative mt-3 h-[3px] w-[148px] overflow-hidden rounded-full bg-white/10">
                <span
                    ref={barRef}
                    className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-white/80 to-transparent"
                />
            </div>
            <p
                key={status}
                className="gc-boot-status mt-4 min-h-5 text-center text-[13px] font-medium text-current/70"
                style={{
                    animation: 'gcBootStatus 0.35s cubic-bezier(0.22,1,0.36,1)',
                }}
            >
                {tr(STATUSES[status])}
            </p>
            <style>{`
                @keyframes gcBootShimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                @keyframes gcBootStatus {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .gc-boot-shimmer, .gc-boot-status { animation: none !important; }
                }
            `}</style>
        </div>
    );
}
