import type { ReactNode } from 'react';
import { FamiliesList } from './family/FamiliesList';
import { FamilyPage } from './family/FamilyPage';

/**
 * Сторінки програми за шляхом (як адреси сайту): /families, /families/<slug> … Кожен розділ
 * переноситься сюди повністю, нативно; модулі й посилання відкривають сторінки всередині програми.
 */
export function resolvePage(path: string): ReactNode | null {
    const [p, query = ''] = path.split('?');
    const tab = new URLSearchParams(query).get('tab') ?? undefined;
    let m: RegExpMatchArray | null;
    if (p === '/families') return <FamiliesList />;
    if ((m = p.match(/^\/(?:families|f)\/([^/]+)/))) return <FamilyPage key={path} slug={m[1]} initialTab={tab} />;
    return null;
}

/** Чи є в програмі сторінка для цього шляху (інакше посилання не робимо клікабельним). */
export const hasPage = (path: string | null | undefined): path is string => !!path && resolvePage(path) !== null;
