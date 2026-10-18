import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';

const cache = new Map<string, RegExp | null>();

function compile(source: string): RegExp | null {
    if (!cache.has(source)) {
        try {
            cache.set(source, new RegExp(source, 'giu'));
        } catch {
            cache.set(source, null);
        }
    }

    return cache.get(source) ?? null;
}

/** Ховає мат зірочками, якщо людина ввімкнула це в налаштуваннях акаунта. */
export function maskProfanity(text: string, source: string | null | undefined) {
    const pattern = source ? compile(source) : null;
    if (!pattern || !text) return text;

    return text.replace(
        pattern,
        (word) => word.slice(0, 1) + '*'.repeat(Math.max(1, word.length - 1)),
    );
}

export function useProfanityMask(): (text: string) => string {
    const source = usePage().props.auth?.user?.profanity_mask ?? null;

    return useMemo(
        () => (text: string) => maskProfanity(text, source),
        [source],
    );
}
