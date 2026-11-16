/**
 * Брейкпоінти колонок оболонки GameCon (CSS px, весь сайт):
 * mobile <768 — 1 колонка;
 * HD 768–1919 — 2 (меню+віджети | контент);
 * FHD 1920+ — 3; 2K 2560+ — 3 широкі; 4K+ 3000+ — 4.
 */
export const GC_HD_MIN = 768;
export const GC_FHD_MIN = 1920;
export const GC_2K_MIN = 2560;
export const GC_4K_MIN = 3000;

export const GC_FHD = `(min-width: ${GC_FHD_MIN}px)`;
export const GC_2K = `(min-width: ${GC_2K_MIN}px)`;
export const GC_4K = `(min-width: ${GC_4K_MIN}px)`;
/** HD: меню з віджетами під ним, без третьої колонки. */
export const GC_HD_DOCK = `(min-width: ${GC_HD_MIN}px) and (max-width: ${GC_FHD_MIN - 1}px)`;
