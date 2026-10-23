import { usePage } from '@inertiajs/react';
import { Laptop, Monitor, MonitorSmartphone, Smartphone } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useRealtime } from '@/hooks/use-realtime';
import {
    applySnapshot,
    deviceId,
    deviceName,
    receiveCommand,
    startConnect,
    transferTo,
    useConnect,
    useOtherDevices,
} from '@/lib/connect';
import type {
    ConnectCommand,
    ConnectDevice,
    ConnectSnapshot,
} from '@/lib/connect';
import { tr } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';

/**
 * GameCon Connect у вкладці: heartbeat, події особистого каналу (`connect.updated`, `connect.command`).
 * Монтується поруч із плеєром у макетах сайту.
 */
export function ConnectListener() {
    const { auth } = usePage().props;

    useEffect(() => startConnect(), []);

    useRealtime(`App.Models.User.${auth.user.id}`, {
        'connect.updated': (event: ConnectSnapshot) => applySnapshot(event),
        'connect.command': (event: {
            target_device_id: string;
            command: ConnectCommand;
        }) => receiveCommand(event),
    });

    return null;
}

function DeviceIcon({
    kind,
    className,
}: {
    kind: ConnectDevice['kind'];
    className?: string;
}) {
    const Icon = kind === 'app' ? Smartphone : Laptop;

    return <Icon className={cn('size-5 shrink-0', className)} />;
}

const accent = 'text-[var(--am-accent,var(--primary))]';

/**
 * Пристрої GameCon Connect для аркуша «Вивід звуку»: цей пристрій першим, далі інші — що на них грає;
 * дотик перекидає відтворення («Грати тут» / «Грати там»). Без інших пристроїв нічого не показує.
 */
export function DeviceList({ onDone }: { onDone?: () => void }) {
    const { devices, activeId } = useConnect();
    const others = devices.filter((d) => d.id !== deviceId);
    const local = usePlayer();
    if (others.length === 0) return null;

    const active = devices.find((d) => d.id === activeId) ?? null;
    const somethingPlays = !!local.current || !!active?.state?.track;
    const hereActive = !active || active.id === deviceId;
    const row =
        'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-[15px] transition active:bg-white/10 disabled:opacity-50';
    const go = (id: string) => {
        void transferTo(id);
        onDone?.();
    };

    return (
        <div className="border-b border-white/10 pb-1">
            <p className="px-4 pt-3 pb-1 text-[13px] font-semibold text-white/60">
                {tr('Пристрої')}
            </p>
            <button
                type="button"
                className={row}
                onClick={() => go(deviceId)}
                disabled={hereActive}
            >
                <Monitor
                    className={cn('size-5 shrink-0', hereActive && accent)}
                />
                <span className="min-w-0 flex-1">
                    <span
                        className={cn('block truncate', hereActive && accent)}
                    >
                        {tr('Цей пристрій')}
                    </span>
                    <span className="block truncate text-[12px] text-white/50">
                        {deviceName()}
                    </span>
                </span>
                {!hereActive && (
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium">
                        {tr('Грати тут')}
                    </span>
                )}
            </button>
            {others.map((d) => {
                const on = d.id === activeId;
                const track = d.state?.track;

                return (
                    <button
                        key={d.id}
                        type="button"
                        className={row}
                        disabled={on || !somethingPlays}
                        onClick={() => go(d.id)}
                    >
                        <DeviceIcon
                            kind={d.kind}
                            className={cn(on && accent)}
                        />
                        <span className="min-w-0 flex-1">
                            <span
                                className={cn('block truncate', on && accent)}
                            >
                                {d.name}
                            </span>
                            <span className="block truncate text-[12px] text-white/50">
                                {track
                                    ? `${d.state?.playing ? '' : `${tr('Пауза')} · `}${track.title} — ${track.artist}`
                                    : tr('Нічого не грає')}
                            </span>
                        </span>
                        {!on && somethingPlays && (
                            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium">
                                {tr('Грати там')}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** «Грає на: Pixel 8» під назвою треку у віддаленому режимі; кнопка «Грати тут» перекидає сюди. */
export function RemoteLine({
    device,
    className,
    withButton,
}: {
    device: ConnectDevice;
    className?: string;
    withButton?: boolean;
}) {
    const Icon = device.kind === 'app' ? Smartphone : Monitor;

    return (
        <span
            className={cn(
                'flex min-w-0 items-center gap-1.5 text-xs',
                accent,
                className,
            )}
        >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">
                {tr('Грає на: {device}', { device: device.name })}
            </span>
            {withButton && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        void transferTo(deviceId);
                    }}
                    className="ml-1 shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 font-medium text-white transition hover:bg-white/25"
                >
                    {tr('Грати тут')}
                </button>
            )}
        </span>
    );
}

/**
 * Кнопка «Пристрої» (капсула ПК, нижній ряд «Зараз грає»): аркуш зі списком пристроїв.
 * З’являється, лише коли відкрито GameCon ще деінде.
 */
export function DevicesButton({
    className,
    wrapperClassName,
    sheetClassName,
    iconClassName,
}: {
    className: string;
    /** `static` — аркуш позиціюється від рядка кнопок, а не від самої кнопки. */
    wrapperClassName?: string;
    sheetClassName?: string;
    iconClassName?: string;
}) {
    const others = useOtherDevices();
    const { activeId } = useConnect();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();

    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) =>
            e.key === 'Escape' && setOpen(false);
        window.addEventListener('pointerdown', onDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (others.length === 0) return null;
    const remote = !!activeId && activeId !== deviceId;

    return (
        <div ref={ref} className={cn('relative', wrapperClassName)}>
            <AnimatePresence>
                {open && (
                    <m.div
                        initial={
                            reduce ? false : { opacity: 0, y: 12, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                            reduce
                                ? { opacity: 0 }
                                : { opacity: 0, y: 12, scale: 0.98 }
                        }
                        transition={{ duration: 0.18, ease: EASE_OUT }}
                        role="dialog"
                        aria-label={tr('Пристрої')}
                        className={cn(
                            'absolute bottom-full z-10 mb-2 w-80 overflow-hidden rounded-2xl bg-[rgb(28_28_30/0.94)] text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl [&>div]:border-b-0',
                            sheetClassName,
                        )}
                    >
                        <DeviceList onDone={() => setOpen(false)} />
                    </m.div>
                )}
            </AnimatePresence>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label={tr('Пристрої')}
                title={tr('Пристрої')}
                aria-expanded={open}
                className={cn(className, remote && accent)}
            >
                <MonitorSmartphone className={iconClassName ?? 'size-[18px]'} />
            </button>
        </div>
    );
}
