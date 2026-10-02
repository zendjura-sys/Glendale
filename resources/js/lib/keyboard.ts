/**
 * На Android довге натискання пробілу відкриває перемикач мови клавіатури.
 * Chrome в цей момент підскролює фокус на кілька десятків пікселів, поле
 * «з'їжджає», і система ховає клавіатуру. Дрібні скроли без дотику до сторінки
 * повертаємо назад; жест користувача і відкриття клавіатури (великий стрибок)
 * не чіпаємо.
 */
export function installKeyboardGuard(): void {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        return;
    }

    let touchedAt = 0;
    let savedX = window.scrollX;
    let savedY = window.scrollY;
    let locking = false;

    const markTouch = () => {
        touchedAt = performance.now();
    };

    const typing = () => {
        const el = document.activeElement;

        return (
            el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement ||
            (el instanceof HTMLElement && el.isContentEditable)
        );
    };

    const pin = () => {
        if (locking) return;

        const recent = performance.now() - touchedAt < 1200;

        if (!typing() || recent) {
            savedX = window.scrollX;
            savedY = window.scrollY;

            return;
        }

        const dy = Math.abs(window.scrollY - savedY);
        const dx = Math.abs(window.scrollX - savedX);

        if ((dy === 0 && dx === 0) || dy > 96 || dx > 96) {
            savedX = window.scrollX;
            savedY = window.scrollY;

            return;
        }

        locking = true;
        window.scrollTo(savedX, savedY);
        requestAnimationFrame(() => {
            locking = false;
        });
    };

    document.addEventListener('touchstart', markTouch, { passive: true });
    document.addEventListener('touchmove', markTouch, { passive: true });
    window.addEventListener('scroll', pin, { passive: true });
    window.visualViewport?.addEventListener('scroll', pin);
}
