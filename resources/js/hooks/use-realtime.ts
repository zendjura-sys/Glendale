import { useChannel } from '@laravel/echo-react';
import { useEffect, useEffectEvent } from 'react';

type Handler = (payload: never) => void;

type WhisperChannel = {
    listen: (event: string, callback: (payload: unknown) => void) => unknown;
    stopListening: (
        event: string,
        callback?: (payload: unknown) => void,
    ) => unknown;
    whisper?: (event: string, data: unknown) => unknown;
};

/**
 * Підписка на приватний канал з набором обробників подій.
 * Ключі — назви подій із `broadcastAs()` (без крапки) або `client-*` для whisper.
 * Повертає функцію whisper для клієнтських подій (набір тексту тощо).
 */
export function useRealtime(
    channelName: string,
    handlers: Record<string, Handler>,
) {
    const { channel } = useChannel(channelName, 'private');
    const events = Object.keys(handlers).sort().join('|');

    const dispatch = useEffectEvent((event: string, payload: unknown) => {
        (handlers[event] as ((payload: unknown) => void) | undefined)?.(
            payload,
        );
    });

    useEffect(() => {
        const ch = channel() as WhisperChannel | null;

        if (!ch || !events) {
            return;
        }

        const bound = events.split('|').map((event) => {
            const name = `.${event}`;
            const callback = (payload: unknown) => dispatch(event, payload);
            ch.listen(name, callback);

            return [name, callback] as const;
        });

        return () =>
            bound.forEach(([name, callback]) =>
                ch.stopListening(name, callback),
            );
    }, [channel, events]);

    return (event: string, data: unknown) => {
        const ch = channel() as WhisperChannel | null;
        ch?.whisper?.(event, data);
    };
}
