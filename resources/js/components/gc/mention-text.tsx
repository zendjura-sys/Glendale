import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

/** Робить @ім’я посиланням на сторінку людини. */
export function MentionText({ text }: { text: string }) {
    const parts = text.split(/(@[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9])/g);

    return parts.map((part, index) =>
        part.startsWith('@') ? (
            <Link
                key={`${part}-${index}`}
                href={`/${part.slice(1)}`}
                className="font-medium text-gc-lilac-300 hover:text-white"
            >
                {part}
            </Link>
        ) : (
            <span key={`${index}-${part.slice(0, 8)}`}>{part}</span>
        ),
    ) as unknown as ReactNode;
}
