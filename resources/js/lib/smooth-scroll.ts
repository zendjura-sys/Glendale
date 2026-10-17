/**
 * Плавна прокрутка сторінки (Lenis) — лише для миші й тачпада на ПК.
 * На телефонах лишається рідна прокрутка (вона й так плавна, а підміна заважає жестам),
 * за «зменшити рух» — теж. Бібліотека вантажиться окремим файлом, коли браузер вільний,
 * тож перший кадр не чекає на неї.
 */
let started = false;

export function startSmoothScroll(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduce.matches) return;

    const idle =
        window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
    idle(() => {
        void Promise.all([
            import('lenis'),
            import('lenis/dist/lenis.css'),
        ]).then(([{ default: Lenis }]) => {
            const lenis = new Lenis({
                autoRaf: true,
                lerp: 0.12,
                smoothWheel: true,
                // Списки, чати, меню й діалоги з власною прокруткою гортаються самі.
                allowNestedScroll: true,
                prevent: (node) =>
                    node.closest(
                        '[data-lenis-prevent],[role="dialog"],[role="menu"],[role="listbox"]',
                    ) !== null,
            });
            // Користувач увімкнув «зменшити рух» на ходу — повертаємо рідну прокрутку.
            reduce.addEventListener('change', (event) => {
                if (event.matches) lenis.destroy();
            });
        });
    });
}
