import {
    Loader2,
    Lock,
    Mic,
    MicOff,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    UserX,
    Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRealtime } from '@/hooks/use-realtime';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { joinVoice, useVoice } from '@/lib/voice';
import type { VoiceOwner } from '@/lib/voice';
import type { UserCard } from '@/types';

type Participant = UserCard & { muted: boolean; joined_at: string };

type VoiceRoom = {
    id: number;
    name: string;
    locked: boolean;
    system: boolean;
    count: number;
    participants: Participant[];
};

type VoiceState = {
    enabled: boolean;
    can_manage: boolean;
    rooms: VoiceRoom[];
};

const failed = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'Не вдалося виконати дію');

/**
 * Голосові кімнати сім’ї чи спільноти: хто де сидить, вхід одним кліком,
 * для керівників — створення, перейменування, вимкнення мікрофона й виключення.
 */
export function VoiceRooms({
    owner,
    label,
    href,
    className,
}: {
    owner: VoiceOwner;
    label: string;
    href: string;
    className?: string;
}) {
    const voice = useVoice();
    const [busy, setBusy] = useState(false);
    const [data, setData] = useState<VoiceState | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        () =>
            api<VoiceState>('GET', `/voice/${owner.type}/${owner.id}`)
                .then((state) => {
                    setData(state);
                    setError(null);
                })
                .catch((e: unknown) =>
                    setError(
                        e instanceof ApiError
                            ? e.message
                            : 'Голосові кімнати зараз недоступні',
                    ),
                ),
        [owner.type, owner.id],
    );

    useEffect(() => {
        void load();
    }, [load]);

    // Хтось зайшов чи вийшов (вебхук LiveKit) або керівник змінив кімнати.
    useRealtime(`${owner.type}.${owner.id}`, {
        'voice.changed': () => void load(),
    });
    // Власний вхід і вихід показуємо одразу, не чекаючи вебхука.
    useEffect(() => {
        if (voice.status !== 'connecting') void load();
    }, [voice.status, voice.roomId, load]);

    if (!data) {
        // Помилку показуємо, а не ховаємо панель, — інакше незрозуміло, куди вона поділась.
        return error ? (
            <section className={cn('glass rounded-3xl p-4', className)}>
                <div className="flex items-center gap-2 text-sm text-white/55">
                    <Volume2 className="size-4 text-white/35" />
                    {error}
                </div>
            </section>
        ) : null;
    }

    const run = async (fn: () => Promise<VoiceState>) => {
        setBusy(true);
        try {
            setData(await fn());
        } catch (e) {
            failed(e);
        } finally {
            setBusy(false);
        }
    };

    const create = () => {
        const name = prompt('Назва нової кімнати')?.trim();
        if (name)
            void run(() =>
                api('POST', `/voice/${owner.type}/${owner.id}`, { name }),
            );
    };
    const rename = (room: VoiceRoom) => {
        const name = prompt('Нова назва кімнати', room.name)?.trim();
        if (name && name !== room.name)
            void run(() => api('PATCH', `/voice/rooms/${room.id}`, { name }));
    };
    const remove = (room: VoiceRoom) => {
        if (confirm(`Видалити кімнату «${room.name}»?`))
            void run(() => api('DELETE', `/voice/rooms/${room.id}`));
    };
    const moderate = (
        room: VoiceRoom,
        user: Participant,
        action: 'mute' | 'unmute' | 'kick',
    ) =>
        void run(() =>
            api('POST', `/voice/rooms/${room.id}/members/${user.id}`, {
                action,
            }),
        );

    return (
        <section className={cn('glass rounded-3xl p-4', className)}>
            <div className="mb-3 flex items-center gap-2">
                <Volume2 className="size-4 text-[#a5b4fc]" />
                <h2 className="flex-1 font-display text-base font-semibold text-white">
                    Голосові кімнати
                </h2>
                {data.can_manage && (
                    <button
                        type="button"
                        onClick={create}
                        disabled={busy}
                        aria-label="Нова кімната"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
                    >
                        <Plus className="size-4" />
                    </button>
                )}
            </div>

            {!data.enabled && (
                <p className="mb-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/45">
                    Голосовий сервер ще не підключено адміністрацією сайту.
                </p>
            )}

            <ul className="space-y-1">
                {data.rooms.map((room) => {
                    const here =
                        voice.kind === 'room' &&
                        voice.roomId === room.id &&
                        voice.status !== 'idle';

                    return (
                        <li key={room.id}>
                            <div
                                className={cn(
                                    'group flex items-center gap-2 rounded-xl px-2.5 py-2 transition',
                                    here
                                        ? 'bg-[var(--accent)]/15'
                                        : 'hover:bg-white/[0.05]',
                                )}
                            >
                                <button
                                    type="button"
                                    disabled={
                                        room.locked || !data.enabled || here
                                    }
                                    onClick={() =>
                                        void joinVoice(room, owner, label, href)
                                    }
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-white/80 disabled:cursor-default"
                                    title={
                                        room.locked
                                            ? 'Закрито для вашого рангу'
                                            : here
                                              ? 'Ви тут'
                                              : 'Зайти'
                                    }
                                >
                                    {room.locked ? (
                                        <Lock className="size-4 shrink-0 text-white/35" />
                                    ) : here &&
                                      voice.status === 'connecting' ? (
                                        <Loader2 className="size-4 shrink-0 animate-spin text-white/60" />
                                    ) : (
                                        <Volume2 className="size-4 shrink-0 text-white/45" />
                                    )}
                                    <span
                                        className={cn(
                                            'truncate',
                                            here && 'font-semibold text-white',
                                            room.locked && 'text-white/45',
                                        )}
                                    >
                                        {room.name}
                                    </span>
                                    {room.count > 0 && (
                                        <span className="ml-auto text-xs text-white/40">
                                            {room.count}
                                        </span>
                                    )}
                                </button>
                                {data.can_manage && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            aria-label="Дії з кімнатою"
                                            className="inline-flex size-7 items-center justify-center rounded-lg text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100"
                                        >
                                            <MoreHorizontal className="size-4" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => rename(room)}
                                            >
                                                <Pencil /> Перейменувати
                                            </DropdownMenuItem>
                                            {!room.system && (
                                                <DropdownMenuItem
                                                    onClick={() => remove(room)}
                                                    className="text-rose-300"
                                                >
                                                    <Trash2 /> Видалити
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>

                            {room.participants.length > 0 && (
                                <ul className="mt-0.5 mb-1 space-y-0.5 pl-8">
                                    {room.participants.map((p) => {
                                        const speaking =
                                            voice.speaking.includes(`u${p.id}`);

                                        return (
                                            <li
                                                key={p.id}
                                                className="group/p flex items-center gap-2 rounded-lg px-1.5 py-1"
                                            >
                                                <span
                                                    className={cn(
                                                        'rounded-full ring-2 transition',
                                                        speaking
                                                            ? 'ring-emerald-400'
                                                            : 'ring-transparent',
                                                    )}
                                                >
                                                    <UserAvatar
                                                        user={p}
                                                        size="xs"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                                                    {p.name}
                                                </span>
                                                {p.muted && (
                                                    <MicOff
                                                        className="size-3.5 text-rose-300"
                                                        aria-label="Мікрофон вимкнено модератором"
                                                    />
                                                )}
                                                {data.can_manage && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            aria-label="Модерація"
                                                            className="inline-flex size-6 items-center justify-center rounded-md text-white/40 opacity-0 transition group-hover/p:opacity-100 hover:bg-white/10 focus-visible:opacity-100"
                                                        >
                                                            <MoreHorizontal className="size-3.5" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    moderate(
                                                                        room,
                                                                        p,
                                                                        p.muted
                                                                            ? 'unmute'
                                                                            : 'mute',
                                                                    )
                                                                }
                                                            >
                                                                {p.muted ? (
                                                                    <>
                                                                        <Mic />{' '}
                                                                        Дозволити
                                                                        мікрофон
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <MicOff />{' '}
                                                                        Вимкнути
                                                                        мікрофон
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    moderate(
                                                                        room,
                                                                        p,
                                                                        'kick',
                                                                    )
                                                                }
                                                                className="text-rose-300"
                                                            >
                                                                <UserX />{' '}
                                                                Виключити
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
