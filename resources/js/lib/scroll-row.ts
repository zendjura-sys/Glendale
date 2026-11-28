/**
 * Поставити елемент по центру горизонтального ряду (вкладки, сегменти), не чіпаючи прокрутку сторінки.
 * scrollIntoView({ block: 'nearest' }) гортає й вікно, коли ряд частково під плаваючою шапкою, —
 * і сторінка «з’їжджає» вниз сама.
 */
export function centerInRow(
    row: HTMLElement | null | undefined,
    item: HTMLElement | null | undefined,
    smooth = false,
): void {
    if (!row || !item) return;
    const left =
        row.scrollLeft +
        (item.getBoundingClientRect().left - row.getBoundingClientRect().left) -
        (row.clientWidth - item.offsetWidth) / 2;
    row.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
}
