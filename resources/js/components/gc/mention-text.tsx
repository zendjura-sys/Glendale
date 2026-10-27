import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useProfanityMask } from '@/lib/profanity';
import type { GameTag } from '@/types';

/** Робить @ім’я посиланням на сторінку людини, а #гру — на сторінку гри. */
export function MentionText({
    text,
    games = [],
}: {
    text: string;
    games?: GameTag[];
}) {
    const mask = useProfanityMask();
    const byTag = new Map(games.map((g) => [g.tag, g]));
    const parts = mask(text).split(
        /(@[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9]|#[\p{L}\p{N}][\p{L}\p{N}_-]{1,39})/gu,
    );

    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            return (
                <Link
                    key={`${part}-${index}`}
                    href={`/${part.slice(1)}`}
                    className="font-medium text-gc-lilac-300 hover:text-white"
                >
                    {part}
                </Link>
            );
        }
        const game = part.startsWith('#')
            ? byTag.get(part.slice(1).replace(/[-_]+$/, ''))
            : undefined;
        if (game) {
            return (
                <Link
                    key={`${part}-${index}`}
                    href={`/games/${game.slug}`}
                    title={game.name}
                    className="font-medium text-gc-sky hover:text-white"
                >
                    {part}
                </Link>
            );
        }

        return <span key={`${index}-${part.slice(0, 8)}`}>{part}</span>;
    }) as unknown as ReactNode;
}
