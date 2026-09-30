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
 *
 * Кнопка Kodik — завжди в списку (index 0), навіть коли плеєра ще не
 * знайдено: людина бачить, що джерело є, просто зараз неактивне
 * (available: false), а не що його взагалі нема на цьому тайтлі.
 * FlixCDN — лише коли й справді знайдений (другого «завжди видимого»
 * джерела без вбудованого плеєра тут не показуємо).
 */
final class PlayerSources
{
    /** @return list<array{index:int, title:string, quality:?string, source:string, available:bool}> */
    public static function list(Title $title): array
    {
        $items = collect([
            ['index' => 0, 'title' => 'Kodik', 'quality' => null, 'source' => 'kodik', 'available' => (bool) $title->kodik_link],
        ]);

        if ($title->flixcdn_link) {
            $items->push(['index' => $items->count(), 'title' => 'FlixCDN', 'quality' => null, 'source' => 'flixcdn', 'available' => true]);
        }

        return $items->values()->all();
    }

    public static function hasAny(Title $title): bool
    {
        return $title->kodik_link !== null || $title->flixcdn_link !== null;
    }

    /** Посилання для конкретного індексу зі списку list(): 0 — Kodik (може бути null), 1 — FlixCDN. */
    public static function linkFor(Title $title, int $index): ?string
    {
        $links = [$title->kodik_link, $title->flixcdn_link];

        return $links[$index] ?? null;
    }

    /** Посилання «за замовчуванням» — перше в списку (для картки/бейджа). */
    public static function primaryLink(Title $title): ?string
    {
        return $title->kodik_link ?: $title->flixcdn_link;
    }

    /** Resolve a playable variant while retaining the requested episode when supported. */
    public static function kodikSelection(Title $title, ?int $season, ?int $episode): array
    {
        $sources = $title->kodikSources()->where('is_available', true)->get()
            ->sortBy(fn ($source) => $source->link === $title->kodik_link ? 0 : 1);
        $candidates = [];
        $unknown = null;
        foreach ($sources as $source) {
            $seasons = $source->availability['seasons'] ?? null;
            if (! is_array($seasons) || $seasons === []) {
                $unknown ??= $source->link;
                continue;
            }
            foreach ($seasons as $number => $data) {
                $episodes = is_array($data) ? ($data['episodes'] ?? []) : [];
                if (! is_numeric($number) || ! is_array($episodes)) {
                    continue;
                }
                foreach ($episodes as $ep => $value) {
                    if (! is_numeric($ep) || (int) $ep < 1) {
                        continue;
                    }
                    $candidate = ['link' => $source->link, 'season' => (int) $number, 'episode' => (int) $ep];
                    if ((int) $number === $season && (int) $ep === $episode) {
                        return $candidate;
                    }
                    $candidates[] = $candidate;
                }
            }
        }
        if ($unknown !== null || $candidates === []) {
            return ['link' => $unknown ?? $title->kodik_link, 'season' => $season, 'episode' => $episode];
        }
        usort($candidates, fn ($a, $b) =>
            [abs($a['season'] - ($season ?? 1)), abs($a['episode'] - ($episode ?? 1)), $a['season'], $a['episode']]
            <=> [abs($b['season'] - ($season ?? 1)), abs($b['episode'] - ($episode ?? 1)), $b['season'], $b['episode']]);

        return $candidates[0];
    }

    /** Перебудувати сумісні поля тайтла з нормалізованих варіантів Kodik. */
    public static function refreshKodikAggregate(Title $title): void
    {
        $sources = $title->kodikSources()->where('is_available', true)->get()->sort(function ($left, $right): int {
            $leftUk = preg_match('/укр|ukr|україн/iu', (string) $left->translation_title) ? 0 : 1;
            $rightUk = preg_match('/укр|ukr|україн/iu', (string) $right->translation_title) ? 0 : 1;

            return [$leftUk, -(int) $left->last_season, -(int) $left->last_episode, -($left->source_updated_at?->timestamp ?? 0), $left->id]
                <=> [$rightUk, -(int) $right->last_season, -(int) $right->last_episode, -($right->source_updated_at?->timestamp ?? 0), $right->id];
        })->values();

        $translations = $sources->map(fn ($source) => [
            'id' => $source->translation_id,
            'title' => $source->translation_title ?: 'Озвучка',
            'type' => $source->translation_type,
            'quality' => $source->quality,
            'link' => $source->link,
            'lastSeason' => $source->last_season,
            'lastEpisode' => $source->last_episode,
        ])->all();

        $title->forceFill([
            'kodik_link' => $sources->first()?->link,
            'kodik_translations' => $translations ?: null,
        ])->save();
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

