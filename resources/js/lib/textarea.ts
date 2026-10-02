/**
 * Підганяє висоту textarea під текст, не зсуваючи саме поле.
 * Пряме `height: auto` на сфокусованому полі рухає його під час утримання
 * пробілу — Android сприймає це як жест і ховає клавіатуру замість меню мови.
 */
export function fitTextarea(el: HTMLTextAreaElement, max: number): void {
    if (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')) {
        if (el.style.height) el.style.height = '';

        return;
    }

    const probe = document.createElement('textarea');
    const style = getComputedStyle(el);
    probe.value = el.value;
    probe.rows = 1;
    probe.setAttribute('aria-hidden', 'true');
    probe.tabIndex = -1;
    probe.style.cssText = [
        'position:fixed',
        'left:-9999px',
        'top:0',
        'height:0',
        'min-height:0',
        'max-height:none',
        `width:${el.clientWidth}px`,
        `padding:${style.padding}`,
        `border-width:${style.borderTopWidth} ${style.borderRightWidth} ${style.borderBottomWidth} ${style.borderLeftWidth}`,
        `border-style:${style.borderStyle}`,
        `font:${style.font}`,
        `line-height:${style.lineHeight}`,
        `letter-spacing:${style.letterSpacing}`,
        `box-sizing:${style.boxSizing}`,
        'white-space:pre-wrap',
        'overflow:hidden',
    ].join(';');
    document.body.appendChild(probe);
    const next = `${Math.min(Math.max(probe.scrollHeight, 0), max)}px`;
    probe.remove();

    if (el.style.height !== next) el.style.height = next;
}
