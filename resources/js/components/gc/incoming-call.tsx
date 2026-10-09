import { Phone, PhoneOff, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { useRealtime } from '@/hooks/use-realtime';
import { answerCall, declineCall, voiceState } from '@/lib/voice';
import type { CallState } from '@/lib/voice';
import { tr } from '@/lib/i18n';

type Ringing = CallState & { group?: boolean; title?: string | null };

/**
 * Мелодія вхідного дзвінка без файлів: два короткі тони кожні дві секунди (Web Audio).
 * Браузер може не дати грати звук до першого кліку на сторінці — тоді лишається лише вікно.
 */
function useRingtone(on: boolean) {
    useEffect(() => {
        if (!on) return;
        let ctx: AudioContext | null = null;
        try {
            ctx = new AudioContext();
        } catch {
            return;
        }
        const beep = () => {
            if (!ctx) return;
            const now = ctx.currentTime;
            [0, 0.35].forEach((offset) => {
                const osc = ctx!.createOscillator();
                const gain = ctx!.createGain();
                osc.type = 'sine';
                osc.frequency.value = 740;
                gain.gain.setValueAtTime(0.0001, now + offset);
                gain.gain.exponentialRampToValueAtTime(
                    0.18,
                    now + offset + 0.03,
                );
                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    now + offset + 0.28,
                );
                osc.connect(gain).connect(ctx!.destination);
                osc.start(now + offset);
                osc.stop(now + offset + 0.3);
            });
        };
        beep();
        const timer = window.setInterval(beep, 2000);

        return () => {
            window.clearInterval(timer);
            void ctx?.close();
        };
    }, [on]);
}

/** Вікно вхідного дзвінка на будь-якій сторінці сайту. */
export function IncomingCall({ userId }: { userId: number }) {
    const [ringing, setRinging] = useState<Ringing | null>(null);
    useRingtone(ringing !== null);

    useRealtime(`App.Models.User.${userId}`, {
        'call.updated': (event: {
            conversation_id: number;
            call: Ringing | null;
        }) => {
            const call = event.call;
            const forMe =
                call !== null &&
                call.status === 'ringing' &&
                call.invited.includes(userId) &&
                call.started_by !== userId &&
                voiceState().callId !== call.id;

            setRinging((current) => {
                if (forMe) return call;
                // Цей дзвінок прийняли, відхилили чи завершили — перестаємо дзвонити.
                return current &&
                    current.conversation_id === event.conversation_id
                    ? null
                    : current;
            });
        },
    });

    if (!ringing) return null;

    const title = ringing.group
        ? (ringing.title ?? tr('Бесіда'))
        : (ringing.caller?.name ?? tr('Дзвінок'));

    return (
        <div className="fixed inset-x-4 top-[72px] z-50 sm:left-auto sm:w-[380px]">
            <div className="glass-strong flex items-center gap-3 rounded-2xl border border-white/10 p-3 shadow-[0_24px_60px_-24px_rgb(52_211_153/0.6)]">
                <span className="relative">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/25 motion-reduce:animate-none" />
                    {ringing.caller ? (
                        <UserAvatar
                            user={ringing.caller}
                            size="md"
                            showOnline={false}
                        />
                    ) : (
                        <span className="flex size-11 items-center justify-center rounded-full bg-white/10">
                            <Users className="size-5 text-white/70" />
                        </span>
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                        {title}
                    </span>
                    <span className="block truncate text-xs text-white/55">
                        {ringing.group
                            ? tr('{v} розпочинає груповий дзвінок', {
                                  v: ringing.caller?.name ?? tr('Хтось'),
                              })
                            : tr('Вхідний дзвінок')}
                    </span>
                </span>
                <button
                    type="button"
                    onClick={() => {
                        declineCall(ringing);
                        setRinging(null);
                    }}
                    aria-label={tr('Відхилити')}
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-rose-500 text-white transition hover:bg-rose-500/85"
                >
                    <PhoneOff className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const call = ringing;
                        setRinging(null);
                        void answerCall(call, title);
                    }}
                    aria-label={tr('Відповісти')}
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-500/85"
                >
                    <Phone className="size-4" />
                </button>
            </div>
        </div>
    );
}
