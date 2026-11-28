/** Кольори рівнів тір-листа (ключі з сервера → класи). */
export const TIER_COLORS: Record<string, string> = {
    rose: 'bg-rose-500/80',
    amber: 'bg-amber-400/85',
    lime: 'bg-lime-400/80',
    sky: 'bg-sky-400/80',
    violet: 'bg-violet-400/80',
    slate: 'bg-slate-400/70',
};

export type Tier = { label: string; color: string; items: string[] };

export const DEFAULT_TIERS: Tier[] = [
    { label: 'S', color: 'rose', items: [] },
    { label: 'A', color: 'amber', items: [] },
    { label: 'B', color: 'lime', items: [] },
    { label: 'C', color: 'sky', items: [] },
    { label: 'D', color: 'violet', items: [] },
];
