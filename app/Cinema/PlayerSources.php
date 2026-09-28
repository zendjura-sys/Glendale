<?php

namespace App\Cinema;

use Illuminate\Support\Collection;

/**
 * Об'єднує обидва балансери плеєра (Kodik і FlixCDN) в один список
 * джерел на сторінці фільму: по одній кнопці на джерело, підписаній
 * лише його назвою — перемикання озвучок усередині джерела (якщо їх
 * декілька) робить сам вбудований плеєр, а не наші таби. Kodik іде
 * першим (звична поведінка), FlixCDN — другим. Індекс у списку —
 * той самий, що приходить у query ?translation=N від фронтенду.
 */
final class PlayerSources
{
    /** @return list<array{index:int, title:string, quality:?string, source:string}> */
    public static function list(Title $title): array
    {
        $items = collect();

        if ($title->kodik_link) {
            $items->push(['index' => $items->count(), 'title' => 'Kodik', 'quality' => null, 'source' => 'kodik']);
        }

        if ($title->flixcdn_link) {
            $items->push(['index' => $items->count(), 'title' => 'FlixCDN', 'quality' => null, 'source' => 'flixcdn']);
        }

        return $items->values()->all();
    }

    public static function hasAny(Title $title): bool
    {
        return $title->kodik_link !== null || $title->flixcdn_link !== null;
    }

    /** Посилання для конкретного індексу зі списку list(). */
    public static function linkFor(Title $title, int $index): ?string
    {
        $links = collect([$title->kodik_link, $title->flixcdn_link])->filter()->values();

        return $links->get($index) ?? $links->first();
    }

    /** Посилання «за замовчуванням» — перше в списку (для картки/бейджа). */
    public static function primaryLink(Title $title): ?string
    {
        return $title->kodik_link ?: $title->flixcdn_link;
    }

    /**
     * Автоматично шукає плеєр там, де його ще нема, не частіше ніж
     * раз на добу на джерело — щоб не бити по обох API щоразу, коли
     * хтось відкриває фільм без плеєра.
     *
     * Для аніме й дорам пріоритет — Kodik (там найкраще покриття для
     * цих категорій): якщо він уже знайшов озвучку, FlixCDN того дня
     * взагалі не чіпаємо — не витрачаємо його ліміт на дублювання.
     */
    public static function autoAttach(Title $title): void
    {
        $kodikDue = ! $title->kodik_link && Kodik::configured()
            && (! $title->kodik_checked_at || $title->kodik_checked_at->lt(now()->subDay()));
        $flixCdnDue = ! $title->flixcdn_link && FlixCdn::configured()
            && (! $title->flixcdn_checked_at || $title->flixcdn_checked_at->lt(now()->subDay()));

        $kodikFound = false;
        if ($kodikDue) {
            $kodikFound = Kodik::attach($title);
        }

        if ($kodikFound && in_array($title->category, ['anime', 'dorama'], true)) {
            return;
        }

        if ($flixCdnDue) {
            FlixCdn::attach($title);
        }
    }
}
