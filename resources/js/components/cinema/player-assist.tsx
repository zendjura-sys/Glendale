import { FastForward, MoonStar, SkipForward } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Toggle } from '@/components/gc/admin';
import { episodeList } from '@/components/cinema/episode-picker';
import type { EpisodePick, Season } from '@/components/cinema/episode-picker';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Скільки секунд перемотує «Пропустити заставку» (типова заставка серіалу й аніме — ~1:30). */
const INTRO = 85;
/** Кнопку заставки показуємо лише на початку серії. */
const INTRO_WINDOW: [number, number] = [5, 240];
/** Відлік перед наступною серією. */
const COUNTDOWN = 8;

const read = (key: string, fallback: string) => {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
};
const write = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* приватний режим */
    }
};

/**
 * Помічник під плеєром кіно: таймер сну, «Пропустити заставку» й автоперехід до наступної серії.
 * Події часу й кінця серії приходять з iframe плеєра (Kodik — kodik_player_*, інші — формат Playerjs);
 * якщо плеєр подій не шле, працює лише таймер сну.
 */
export function PlayerAssist({
    frame,
    provider,
    seasons,
    pick,
    onPick,
}: {
    frame: React.RefObject<HTMLIFrameElement | null>;
    provider: string | undefined;
    seasons: Season[] | null | undefined;
    pick: EpisodePick | null;
    onPick: (pick: EpisodePick) => void;
}) {
    const reduce = useReducedMotion();
    const [time, setTime] = useState<number | null>(null);
    const [sleep, setSleep] = useState<number | 'episode' | null>(null);
    const [sleepAt, setSleepAt] = useState<number | null>(null);
    const [autoNext, setAutoNext] = useState(
        () => read('gc.cinema.autonext', '1') === '1',
    );
    const [countdown, setCountdown] = useState<number | null>(null);
    const [, tick] = useState(0);

    const all = seasons?.length ? episodeList(seasons) : [];
    const index = pick
        ? all.findIndex(
              (p) => p.season === pick.season && p.episode === pick.episode,
          )
        : -1;
    const next = index >= 0 ? (all[index + 1] ?? null) : null;

    const command = (method: 'pause' | 'seek', seconds?: number) => {
        const target = frame.current?.contentWindow;
        if (!target) return;
        if (provider === 'kodik') {
            target.postMessage(
                {
                    key: 'kodik_player_api',
                    value: method === 'seek' ? { method, seconds } : { method },
                },
                '*',
            );
        } else {
            target.postMessage(
                method === 'seek'
                    ? { api: 'seek', set: seconds }
                    : { api: method },
                '*',
            );
        }
    };
    const commandRef = useRef(command);
    commandRef.current = command;
    const state = useRef({ sleep, next, autoNext });
    state.current = { sleep, next, autoNext };

    // Нова серія — час і відлік з нуля.
    useEffect(() => {
        setTime(null);
        setCountdown(null);
    }, [pick?.season, pick?.episode]);

    useEffect(() => {
        const listen = (message: MessageEvent) => {
            if (message.source !== frame.current?.contentWindow) return;
            const data = message.data as {
                key?: string;
                event?: string;
                value?: unknown;
                data?: unknown;
            } | null;
            if (!data || typeof data !== 'object') return;
            const name = String(data.key ?? data.event ?? '');
            const raw = data.value ?? data.data;
            if (/time_update|^time$|timeupdate/i.test(name)) {
                const t =
                    typeof raw === 'number'
                        ? raw
                        : Number((raw as { time?: unknown })?.time);
                if (Number.isFinite(t)) setTime(t);
            } else if (/ended|^end$|finish/i.test(name)) {
                const { sleep: s, next: n, autoNext: a } = state.current;
                if (s === 'episode') {
                    setSleep(null);
                    toast(tr('Таймер сну: серія закінчилась — на добраніч'));
                } else if (n && a) {
                    setCountdown(COUNTDOWN);
                }
            }
        };
        window.addEventListener('message', listen);

        return () => window.removeEventListener('message', listen);
    }, [frame]);

    // Таймер сну за хвилинами.
    useEffect(() => {
        if (sleepAt === null) return;
        const timer = window.setInterval(() => {
            tick((n) => n + 1);
            if (Date.now() >= sleepAt) {
                commandRef.current('pause');
                setSleep(null);
                setSleepAt(null);
                toast(tr('Таймер сну: поставили на паузу'));
            }
        }, 1000);

        return () => window.clearInterval(timer);
    }, [sleepAt]);

    // Відлік до наступної серії.
    useEffect(() => {
        if (countdown === null) return;
        if (countdown <= 0) {
            setCountdown(null);
            if (next) onPick(next);

            return;
        }
        const timer = window.setTimeout(
            () => setCountdown((c) => (c === null ? null : c - 1)),
            1000,
        );

        return () => window.clearTimeout(timer);
    }, [countdown, next, onPick]);

    const chooseSleep = (value: string) => {
        if (value === '') {
            setSleep(null);
            setSleepAt(null);

            return;
        }
        if (value === 'episode') {
            setSleep('episode');
            setSleepAt(null);
        } else {
            const minutes = Number(value);
            setSleep(minutes);
            setSleepAt(Date.now() + minutes * 60_000);
        }
    };

    const left =
        sleepAt !== null
            ? Math.max(0, Math.ceil((sleepAt - Date.now()) / 60_000))
            : null;
    const showIntro =
        pick !== null &&
        time !== null &&
        time >= INTRO_WINDOW[0] &&
        time <= INTRO_WINDOW[1];

    return (
        <div className="relative space-y-2 px-3 py-2.5" data-player-assist>
            <AnimatePresence>
                {countdown !== null && next && (
                    <m.div
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: 6 }}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/15 px-3 py-2 ring-1 ring-primary/40"
                        role="status"
                    >
                        <SkipForward className="size-4 text-primary" />
                        <span className="min-w-0 flex-1 text-sm text-white">
                            {tr(
                                'Наступна серія — {s} сезон, {e} серія — через {n} с',
                                {
                                    s: next.season,
                                    e: next.episode,
                                    n: countdown,
                                },
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setCountdown(null);
                                onPick(next);
                            }}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                        >
                            {tr('Дивитися зараз')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setCountdown(null)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.06]"
                        >
                            {tr('Скасувати')}
                        </button>
                    </m.div>
                )}
            </AnimatePresence>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <label className="inline-flex items-center gap-2 text-white/70">
                    <MoonStar
                        className={cn(
                            'size-4',
                            sleep ? 'text-primary' : 'text-white/45',
                        )}
                    />
                    <span>{tr('Таймер сну')}</span>
                    <select
                        value={sleep === null ? '' : String(sleep)}
                        onChange={(e) => chooseSleep(e.target.value)}
                        aria-label={tr('Таймер сну')}
                        className="input-glass h-8 rounded-lg px-2 text-xs text-white"
                    >
                        <option value="">{tr('Вимкнено')}</option>
                        {[15, 30, 45, 60, 90].map((n) => (
                            <option key={n} value={n}>
                                {tr('{n} хв', { n })}
                            </option>
                        ))}
                        {pick && (
                            <option value="episode">
                                {tr('До кінця серії')}
                            </option>
                        )}
                    </select>
                    {left !== null && (
                        <span className="text-xs text-white/45 tabular-nums">
                            {tr('ще {n} хв', { n: left })}
                        </span>
                    )}
                </label>
                {all.length > 1 && (
                    <span className="inline-flex items-center gap-2 text-white/70">
                        <Toggle
                            checked={autoNext}
                            onChange={(v) => {
                                setAutoNext(v);
                                write('gc.cinema.autonext', v ? '1' : '0');
                            }}
                            label={tr('Наступна серія автоматично')}
                        />
                        {tr('Наступна серія автоматично')}
                    </span>
                )}
                <AnimatePresence>
                    {showIntro && (
                        <m.button
                            type="button"
                            initial={
                                reduce ? false : { opacity: 0, scale: 0.95 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            exit={reduce ? undefined : { opacity: 0 }}
                            onClick={() => command('seek', (time ?? 0) + INTRO)}
                            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/[0.12]"
                        >
                            <FastForward className="size-3.5" />
                            {tr('Пропустити заставку')}
                        </m.button>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
