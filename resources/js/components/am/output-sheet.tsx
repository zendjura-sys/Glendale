import { Cast, Headphones, Smartphone, Speaker } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { tr } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { mediaElements, playingElement, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';

// ───────────────────────── Вивід звуку ─────────────────────────

type OutputMedia = HTMLAudioElement & {
    setSinkId?: (id: string) => Promise<void>;
    sinkId?: string;
    remote?: { prompt: () => Promise<void>; state?: string };
    webkitShowPlaybackTargetPicker?: () => void;
};

type OutputDevices = MediaDevices & {
    selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

let currentSink = '';

async function applySink(deviceId: string) {
    await Promise.all(
        mediaElements().map((el) => (el as OutputMedia).setSinkId?.(deviceId)),
    );
    currentSink = deviceId;
}

/**
 * Аркуш «Вивід звуку» як AirPlay в Apple Music: цей пристрій, навушники й колонки (де браузер дозволяє
 * вибір), трансляція на телевізор чи колонку (Chromecast на Android, AirPlay у Safari). Помилки — тостом.
 */
export function OutputSheet({
    onClose,
    className,
}: {
    onClose: () => void;
    /** Де показати аркуш; типово — над кнопкою на всю ширину рядка. */
    className?: string;
}) {
    const player = usePlayer();
    const el = playingElement() as OutputMedia;
    const devices = navigator.mediaDevices as OutputDevices | undefined;
    const canSink = typeof el.setSinkId === 'function';
    const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
    const [sink, setSink] = useState(currentSink);
    const spotify = player.engine === 'sdk' || player.engine === 'embed';
    const reduce = useReducedMotion();

    useEffect(() => {
        if (!canSink || !devices?.enumerateDevices) return;
        void devices
            .enumerateDevices()
            .then((list) =>
                setOutputs(
                    list.filter(
                        (d) =>
                            d.kind === 'audiooutput' &&
                            d.label &&
                            d.deviceId !== 'default' &&
                            d.deviceId !== 'communications',
                    ),
                ),
            )
            .catch(() => {});
    }, [canSink, devices]);

    const pick = async (deviceId: string) => {
        try {
            await applySink(deviceId);
            setSink(deviceId);
        } catch {
            toast.error(tr('Не вдалося перемкнути звук на цей пристрій.'));
        }
    };

    const choose = async () => {
        try {
            const device = await devices!.selectAudioOutput!();
            await pick(device.deviceId);
            setOutputs((list) =>
                list.some((d) => d.deviceId === device.deviceId)
                    ? list
                    : [...list, device],
            );
        } catch {
            // Людина закрила вибір.
        }
    };

    const cast = async () => {
        try {
            if (el.webkitShowPlaybackTargetPicker) {
                el.webkitShowPlaybackTargetPicker();
            } else {
                await el.remote!.prompt();
            }
            onClose();
        } catch (error) {
            const name = error instanceof DOMException ? error.name : '';
            if (name === 'NotFoundError') {
                toast.message(
                    tr(
                        'Поруч немає пристроїв для трансляції. Перевір, що телевізор чи колонка в тій самій мережі Wi-Fi.',
                    ),
                );
            } else if (name !== 'AbortError' && name !== 'NotAllowedError') {
                toast.error(tr('Цей трек не можна транслювати з браузера.'));
            }
        }
    };

    const row =
        'flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] transition active:bg-white/10';
    const check = (on: boolean) =>
        on ? (
            <span className="ml-auto size-2.5 rounded-full bg-[var(--am-accent)]" />
        ) : null;

    return (
        <m.div
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className={cn(
                'absolute inset-x-0 bottom-full z-10 mb-2 overflow-hidden rounded-2xl bg-[rgb(28_28_30/0.94)] text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl',
                className,
            )}
            role="dialog"
            aria-label={tr('Вивід звуку')}
        >
            <p className="px-4 pt-3 pb-1 text-[13px] font-semibold text-white/60">
                {tr('Вивід звуку')}
            </p>
            <button
                type="button"
                className={row}
                onClick={() => void (canSink ? pick('') : onClose())}
            >
                <Smartphone className="size-5 shrink-0" />
                {tr('Цей пристрій')}
                {check(sink === '')}
            </button>
            {outputs.map((d) => (
                <button
                    key={d.deviceId}
                    type="button"
                    className={row}
                    onClick={() => void pick(d.deviceId)}
                >
                    <Headphones className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    {check(sink === d.deviceId)}
                </button>
            ))}
            {canSink && devices?.selectAudioOutput && (
                <button
                    type="button"
                    className={row}
                    onClick={() => void choose()}
                >
                    <Speaker className="size-5 shrink-0" />
                    {tr('Навушники чи колонка…')}
                </button>
            )}
            {(el.remote || el.webkitShowPlaybackTargetPicker) && !spotify && (
                <button
                    type="button"
                    className={row}
                    onClick={() => void cast()}
                >
                    <Cast className="size-5 shrink-0" />
                    {tr('Транслювати на пристрій…')}
                </button>
            )}
            <p className="border-t border-white/10 px-4 py-3 text-[12px] leading-snug text-white/55">
                {spotify
                    ? tr(
                          'Пісні Spotify можна перемкнути на інший пристрій у застосунку Spotify (Spotify Connect).',
                      )
                    : tr(
                          'Bluetooth-навушники й колонки під’єднуються в налаштуваннях телефона — звук перейде на них сам.',
                      )}
            </p>
        </m.div>
    );
}
