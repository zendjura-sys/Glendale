import { Link } from '@inertiajs/react';
import {
    Headphones,
    HeadphoneOff,
    Loader2,
    Mic,
    MicOff,
    PhoneOff,
    Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { leaveVoice, toggleDeafen, toggleMic, useVoice } from '@/lib/voice';
import { tr } from '@/lib/i18n';

const iconBtn =
    'inline-flex size-9 items-center justify-center rounded-xl transition';

/** Панель поточної розмови під шапкою: видно на всіх сторінках, поки ви в голосовій кімнаті. */
function useElapsed(since: number | null) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (since === null) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(timer);
    }, [since]);
    if (since === null) return '';
    const seconds = Math.max(0, Math.floor((now - since) / 1000));
    const m = Math.floor(seconds / 60);

    return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VoiceBar() {
    const voice = useVoice();
    const elapsed = useElapsed(voice.connectedAt);
    if (voice.status === 'idle') return null;

    return (
        <div className="fixed top-[72px] right-4 left-4 z-40 sm:left-auto sm:w-[380px]">
            <div className="glass flex items-center gap-2 rounded-2xl p-2 pl-3 shadow-lg">
                {voice.status === 'connecting' ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-white/60" />
                ) : (
                    <Volume2 className="size-4 shrink-0 text-emerald-300" />
                )}
                <Link href={voice.href} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                        {voice.roomName}
                    </span>
                    <span className="block truncate text-xs text-white/45">
                        {voice.status === 'connecting'
                            ? tr('Підключення…')
                            : voice.kind === 'call'
                              ? `${voice.label} · ${elapsed}`
                              : voice.label}
                    </span>
                </Link>
                <button
                    type="button"
                    onClick={toggleMic}
                    disabled={voice.status !== 'connected'}
                    aria-label={
                        voice.micOn
                            ? tr('Вимкнути мікрофон')
                            : tr('Увімкнути мікрофон')
                    }
                    className={cn(
                        iconBtn,
                        voice.micOn
                            ? 'bg-white/[0.06] text-white hover:bg-white/10'
                            : 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25',
                    )}
                >
                    {voice.micOn ? (
                        <Mic className="size-4" />
                    ) : (
                        <MicOff className="size-4" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={toggleDeafen}
                    aria-label={
                        voice.deafened
                            ? tr('Увімкнути звук')
                            : tr('Вимкнути звук')
                    }
                    className={cn(
                        iconBtn,
                        voice.deafened
                            ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                            : 'bg-white/[0.06] text-white hover:bg-white/10',
                    )}
                >
                    {voice.deafened ? (
                        <HeadphoneOff className="size-4" />
                    ) : (
                        <Headphones className="size-4" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => void leaveVoice()}
                    aria-label={
                        voice.kind === 'call'
                            ? tr('Покласти слухавку')
                            : tr('Вийти з кімнати')
                    }
                    className={cn(
                        iconBtn,
                        'bg-rose-500 text-white hover:bg-rose-500/85',
                    )}
                >
                    <PhoneOff className="size-4" />
                </button>
            </div>
        </div>
    );
}
