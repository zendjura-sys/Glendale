import { useCallback } from 'react';
import { Character } from '@/components/character/character';
import { UserAvatar } from '@/components/gc/user-avatar';
import { normalizeCharacter } from '@/lib/character';
import { useVoice, voiceLevel } from '@/lib/voice';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

/**
 * Людина в шоу: персонаж, що говорить її голосом (рот за гучністю й тембром), або фото.
 * Коли говорить — навколо неонове кільце.
 */
export function ShowPerson({
    person,
    size = 'lg',
    className,
}: {
    person: UserCard;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const voice = useVoice();
    const identity = `u${person.id}`;
    const speaking = voice.speaking.includes(identity);
    const meter = useCallback(() => voiceLevel(identity), [identity]);
    const box =
        size === 'lg'
            ? 'size-28 sm:size-32'
            : size === 'md'
              ? 'size-20'
              : 'size-12';

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0 rounded-full p-1 transition-shadow duration-200',
                speaking
                    ? 'shadow-[0_0_0_3px_var(--color-primary),0_0_22px_2px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]'
                    : 'shadow-[0_0_0_2px_rgb(255_255_255/0.08)]',
                className,
            )}
        >
            {person.character ? (
                <span className={cn('overflow-hidden rounded-full', box)}>
                    <Character
                        config={normalizeCharacter(person.character)}
                        meter={meter}
                        title={person.name}
                        className="size-full"
                    />
                </span>
            ) : (
                <span
                    className={cn(
                        'grid place-items-center overflow-hidden rounded-full',
                        box,
                    )}
                >
                    <UserAvatar
                        user={person}
                        size={
                            size === 'lg' ? 'hero' : size === 'md' ? 'xl' : 'md'
                        }
                        showOnline={false}
                        className="!size-full"
                    />
                </span>
            )}
        </span>
    );
}
