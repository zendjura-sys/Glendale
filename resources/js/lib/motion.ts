import type { Transition } from 'motion/react';

/**
 * Єдина мова руху сайту (бібліотека motion). Еталон — налаштування й вхід:
 *  - SNAP: індикатор вибраного «перетікає» між варіантами (layoutId) — вкладки, меню, перемикачі;
 *  - POP: позначка вибору «вистрибує» (галочка, бейдж);
 *  - SWAP: великі блоки міняються місцями (layout) — половини картки входу, колонки;
 *  - BLUR_IN / BLUR_OUT: вміст зникає з розмиттям і проявляється знову (зміна екрана всередині картки);
 *  - RISE: поява панелей знизу (панель змін, тости, шторки).
 * Завжди перевіряйте useReducedMotion(): тоді — без руху (instant), лише зміна стану.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const SNAP: Transition = { type: 'spring', stiffness: 420, damping: 36 };
export const POP: Transition = { type: 'spring', stiffness: 500, damping: 22 };
export const SWAP: Transition = {
    type: 'spring',
    stiffness: 140,
    damping: 22,
    mass: 0.9,
};
export const RISE: Transition = { type: 'spring', stiffness: 380, damping: 32 };
export const INSTANT: Transition = { duration: 0 };

/** Перехід з урахуванням «зменшити рух» у системі. */
export function motionOr(
    reduce: boolean | null,
    transition: Transition,
): Transition {
    return reduce ? INSTANT : transition;
}

/** Зникнення й поява зі зсувом (для AnimatePresence mode="wait"). Без filter: blur — анімоване
 * розмиття тексту на планшетах змушувало браузер перемальовувати шар, і текст блимав. */
export function blurSwap(reduce: boolean | null) {
    return reduce
        ? {
              initial: false as const,
              animate: { opacity: 1 },
              exit: { opacity: 1 },
          }
        : {
              initial: { opacity: 0, y: 8 },
              animate: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: EASE_OUT, delay: 0.12 },
              },
              exit: {
                  opacity: 0,
                  y: -6,
                  transition: { duration: 0.22, ease: EASE_OUT },
              },
          };
}
