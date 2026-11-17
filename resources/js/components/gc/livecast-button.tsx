import { Link } from "@inertiajs/react";
import { ChevronRight } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { usePlugin } from "@/lib/plugins";
import { cn } from "@/lib/utils";

type Pulse = { live: number; viewers: number };

/** Спільний пульс стрімів: один запит на всі кнопки, оновлення раз на 30 с. */
let cached: Pulse | null = null;
let loading: Promise<Pulse> | null = null;
let loadedAt = 0;

function usePulse(on: boolean): Pulse | null {
    const [pulse, setPulse] = useState<Pulse | null>(cached);

    useEffect(() => {
        if (!on) return;
        let alive = true;
        const load = () => {
            if (document.hidden) return;
            if (!loading || Date.now() - loadedAt > 25_000) {
                loadedAt = Date.now();
                loading = api<Pulse>("GET", "/livecast/pulse").then((p) => {
                    cached = p;

                    return p;
                });
            }
            loading.then((p) => alive && setPulse(p)).catch(() => undefined);
        };
        load();
        const timer = window.setInterval(load, 30_000);

        return () => {
            alive = false;
            window.clearInterval(timer);
        };
    }, [on]);

    return pulse;
}

/** Кадри «сигналу ефіру» — як у GameCast, але з іншим ритмом під відео. */
const BARS = [
    [0.4, 0.85, 0.55, 0.95, 0.4],
    [0.7, 0.35, 0.9, 0.5, 0.7],
    [0.5, 1, 0.45, 0.8, 0.5],
    [0.9, 0.45, 0.75, 0.35, 0.9],
    [0.35, 0.7, 0.55, 1, 0.35],
];

/** Еквалайзер стріму: «говорить», коли хтось в ефірі; ледь дихає, коли тихо. */
function StreamBars({
    live,
    count,
    className,
}: {
    live: boolean;
    count: number;
    className?: string;
}) {
    const reduce = useReducedMotion();

    return (
        <span
            aria-hidden
            className={cn("flex items-center gap-[3px]", className)}
        >
            {BARS.slice(0, count).map((frames, i) => (
                <m.span
                    key={i}
                    className="h-full w-[3px] origin-center rounded-full bg-current"
                    initial={{ scaleY: frames[0] }}
                    animate={
                        reduce
                            ? { scaleY: frames[2] }
                            : {
                                  scaleY: live
                                      ? frames
                                      : frames.map((f) => 0.25 + f * 0.2),
                              }
                    }
                    transition={
                        reduce
                            ? { duration: 0 }
                            : {
                                  duration: live ? 0.9 + i * 0.1 : 2.6,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                              }
                    }
                />
            ))}
        </span>
    );
}

/** Точка «в ефірі»: хвиля розходиться, коли йде стрім. */
function OnAir({ live }: { live: boolean }) {
    const reduce = useReducedMotion();

    return (
        <span className="relative grid size-2.5 place-items-center">
            {live && !reduce && (
                <m.span
                    className="absolute inset-0 rounded-full bg-rose-500"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeOut",
                    }}
                />
            )}
            <span
                className={cn(
                    "relative size-2.5 rounded-full",
                    live ? "bg-rose-500" : "bg-white/30",
                )}
            />
        </span>
    );
}

function summary(pulse: Pulse | null): string {
    if (!pulse) return tr("Стріми камерою чи екраном");
    if (pulse.live === 0) return tr("Ніхто не стрімить — будьте першими");

    if (pulse.viewers === 0)
        return tr("{streams} наживо — зайдіть першими", {
            streams: pulse.live,
        });

    return tr("{streams} наживо · {people} дивляться", {
        streams: pulse.live,
        people: pulse.viewers,
    });
}

/**
 * Жива кнопка LiveCast у меню: як GameCast — еквалайзер, точка ефіру й підпис
 * зі скількома стрімами/глядачами зараз.
 */
export function LiveCastTile({ className }: { className?: string }) {
    const on = usePlugin("livecast");
    const pulse = usePulse(on);
    const reduce = useReducedMotion();
    const live = (pulse?.live ?? 0) > 0;
    if (!on) return null;

    return (
        <Link
            href="/livecast"
            className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-[1.35rem] bg-[#141a33] p-3.5 text-left transition active:scale-[0.99]",
                className,
            )}
        >
            {live && !reduce && (
                <m.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-y-6 w-40 rounded-full bg-rose-500/20 blur-2xl"
                    initial={{ x: "-40%" }}
                    animate={{ x: ["-40%", "260%", "-40%"] }}
                    transition={{
                        duration: 9,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            )}
            <span
                className={cn(
                    "relative grid size-12 shrink-0 place-items-center rounded-2xl",
                    live
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-white/[0.06] text-rose-300/80",
                )}
            >
                <StreamBars live={live} count={5} className="h-6" />
            </span>
            <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-bold tracking-tight text-white">
                        LiveCast
                    </span>
                    <OnAir live={live} />
                    {live && (
                        <span className="text-[10px] font-bold text-rose-300">
                            {tr("НАЖИВО")}
                        </span>
                    )}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-white/60">
                    {summary(pulse)}
                </span>
            </span>
            <ChevronRight className="relative size-4 shrink-0 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
    );
}
