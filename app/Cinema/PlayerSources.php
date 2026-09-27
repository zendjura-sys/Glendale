<?php

namespace App\Cinema;

use Illuminate\Support\Collection;

/**
 * Об'єднує обидва балансери плеєра (Kodik і FlixCDN) в один список
 * джерел на сторінці фільму: Kodik дає окреме посилання на кожну
 * озвучку, FlixCDN — один плеєр, що сам перемикає озвучки всередині.
 * Kodik-озвучки йдуть першими (звична поведінка), FlixCDN — останнім
 * пунктом. Індекс у списку — той самий, що приходить у query
 * ?translation=N від фронтенду.
 */
final class PlayerSources
{
    /** @return list<array{index:int, title:string, quality:?string, source:string}> */
    public static function list(Title $title): array
    {
        $kodik = collect($title->kodik_translations ?? []);
        $items = $kodik->values()->map(fn ($t, $i) => [
            'index' => $i,
            'title' => $t['title'] ?? 'Озвучка',
            'quality' => $t['quality'] ?? null,
            'source' => 'kodik',
        ]);

        if ($title->flixcdn_link) {
            $names = collect($title->flixcdn_translations ?? [])->pluck('title')->filter()->implode(', ');
            $items->push([
                'index' => $kodik->count(),
                'title' => $names !== '' ? "FlixCDN ({$names})" : 'FlixCDN',
                'quality' => null,
                'source' => 'flixcdn',
            ]);
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
        $kodik = collect($title->kodik_translations ?? []);
        if ($index >= 0 && $index < $kodik->count()) {
            return $kodik->values()->get($index)['link'] ?? $title->kodik_link;
        }
        if ($title->flixcdn_link) {
            return $title->flixcdn_link;
        }

        return $title->kodik_link;
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
     */
    public static function autoAttach(Title $title): void
    {
        if (! $title->kodik_link && Kodik::configured() && (! $title->kodik_checked_at || $title->kodik_checked_at->lt(now()->subDay()))) {
            Kodik::attach($title);
        }
        if (! $title->flixcdn_link && FlixCdn::configured() && (! $title->flixcdn_checked_at || $title->flixcdn_checked_at->lt(now()->subDay()))) {
            FlixCdn::attach($title);
        }
    }
}
