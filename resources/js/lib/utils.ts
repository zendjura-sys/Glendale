import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

/** Внутрішній відступ, щоб останній елемент ліг над скляним меню й плеєром. */
export function dockedAboveNav(playing: boolean, desktopClass = 'lg:pb-3') {
    return cn(
        playing
            ? 'pb-[calc(10rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(5rem+env(safe-area-inset-bottom))]',
        desktopClass,
    );
}

/** Плаваюча кнопка чи панель над тим самим меню. */
export function floatingAboveNav(playing: boolean) {
    return playing
        ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))] lg:bottom-28'
        : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-4';
}
