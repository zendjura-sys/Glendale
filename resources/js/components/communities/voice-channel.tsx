import { router } from '@inertiajs/react';
import { Loader2, LogOut, Mic, MicOff, Volume2 } from 'lucide-react';
import { useEffect } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { useRealtime } from '@/hooks/use-realtime';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { joinVoice, leaveVoice, useVoice } from '@/lib/voice';
import type { UserCard } from '@/types';
import type { ChannelCard } from './channel-dialog';

/**
 * Голосовий канал: хто в ньому зараз і вхід одним кліком (голосова кімната спільноти, LiveKit).
 * Список оновлюється, коли хтось заходить чи виходить.
 */
export function VoiceChannel({
    channel,
    community,
}: {
    channel: ChannelCard;
    community: { id: number; slug: string; name: string };
}) {
    const voice = useVoice();
    const roomId = channel.voice_room_id;
    const here = voice.kind === 'room' && voice.roomId === roomId;
    const reload = () =>
        router.reload({
            only: ['tree', 'channel'],
            preserveScroll: true,
        } as never);

    useRealtime(`community.${community.id}`, { 'voice.changed': reload });
    useEffect(() => {
        if (voice.status !== 'connecting') reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voice.status, voice.roomId]);

    const people: UserCard[] = channel.voice;

    return (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-gc-lilac-300">
                <Volume2 className="size-8" />
            </span>
            <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                    {channel.name}
                </h1>
                <p className="mt-1 text-sm text-white/50">
                    {people.length > 0
                        ? tr('Зараз у каналі: {n}', { n: people.length })
                        : tr('У каналі поки нікого — заходьте першим.')}
                </p>
            </div>

            {people.length > 0 && (
                <ul className="flex max-w-xl flex-wrap justify-center gap-4">
                    {people.map((user) => (
                        <li
                            key={user.id}
                            className="flex w-20 flex-col items-center gap-1.5"
                        >
                            <span
                                className={cn(
                                    'rounded-full ring-2 transition',
                                    voice.speaking.includes(`u${user.id}`)
                                        ? 'ring-emerald-400'
                                        : 'ring-transparent',
                                )}
                            >
                                <UserAvatar user={user} size="lg" />
                            </span>
                            <span className="w-full truncate text-xs text-white/75">
                                {user.first_name}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {roomId !== null &&
                (here ? (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                            {voice.micOn ? (
                                <Mic className="size-3.5" />
                            ) : (
                                <MicOff className="size-3.5" />
                            )}
                            {tr('Ви в каналі')}
                        </span>
                        <button
                            type="button"
                            onClick={() => void leaveVoice()}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
                        >
                            <LogOut className="size-4" />
                            {tr('Вийти')}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={voice.status === 'connecting'}
                        onClick={() =>
                            void joinVoice(
                                { id: roomId, name: channel.name },
                                { type: 'community', id: community.id },
                                community.name,
                                `/c/${community.slug}/channels/${channel.id}`,
                            )
                        }
                        className="btn-glow inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold disabled:opacity-60"
                    >
                        {voice.status === 'connecting' ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Mic className="size-4" />
                        )}
                        {tr('Приєднатися')}
                    </button>
                ))}
        </section>
    );
}
