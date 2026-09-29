<?php

namespace App\Cinema;

use App\Cinema\Kodik\KodikApiException;
use App\Cinema\Kodik\KodikAttachResult;
use App\Cinema\Kodik\KodikClient;
use Illuminate\Support\Facades\DB;

/**
 * Плеєр Kodik: за IMDb id (або назвою й роком) знаходить
 * посилання на iframe-плеєр і доступні озвучки. Токен — в адмінці,
 * зашифрований. Сам плеєр шле події postMessage (kodik_player_time_update
 * тощо) — на сторінці фільму з них зберігається прогрес перегляду.
 */
final class Kodik
{
    public const API = 'https://kodik-api.com';

    public static function configured(): bool
    {
        return (bool) CinemaSettings::kodikToken();
    }

    /**
     * Знайти плеєр для тайтлу й зберегти посилання та озвучки.
     *
     * @return bool чи знайдено
     */
    public static function attach(Title $title, bool $force = false): bool
    {
        return self::attachResult($title, $force)->status === 'attached';
    }

    public static function attachResult(Title $title, bool $force = false): KodikAttachResult
    {
        try {
            $results = self::search($title);
        } catch (KodikApiException $exception) {
            $title->forceFill([
                'kodik_sync_status' => 'failed',
                'kodik_last_error' => $exception->kind(),
            ])->save();

            return KodikAttachResult::failed($exception);
        }

        if (! $results) {
            DB::transaction(function () use ($title, $force): void {
                $values = [
                    'kodik_checked_at' => now(),
                    'kodik_sync_status' => 'not_found',
                    'kodik_last_error' => null,
                ];
                if ($force) {
                    $values['kodik_link'] = null;
                    $values['kodik_translations'] = null;
                }
                $title->forceFill($values)->save();
            });

            return KodikAttachResult::notFound();
        }

        $translations = collect($results)->map(fn ($r) => [
            'id' => $r['translation']['id'] ?? null,
            'title' => $r['translation']['title'] ?? 'Озвучка',
            'type' => $r['translation']['type'] ?? null,
            'quality' => $r['quality'] ?? null,
            'link' => self::normalizeLink($r['link'] ?? ''),
            'lastSeason' => $r['last_season'] ?? null,
            'lastEpisode' => $r['last_episode'] ?? null,
        ])->filter(fn ($t) => $t['link'] !== '')->unique('link')->values();

        // Українська озвучка — першою, якщо є.
        $sorted = $translations->sortBy(fn ($t) => preg_match('/укр|ukr|україн/iu', (string) $t['title']) ? 0 : 1)->values();
        DB::transaction(function () use ($title, $sorted): void {
            $title->forceFill([
                'kodik_translations' => $sorted->all(),
                'kodik_link' => $sorted->first()['link'] ?? null,
                'kodik_checked_at' => now(),
                'kodik_sync_status' => 'attached',
                'kodik_last_error' => null,
            ])->save();
        });

        return KodikAttachResult::attached();
    }

    /** @return list<array<string, mixed>> */
    public static function search(Title $title): array
    {
        $client = new KodikClient;
        $queries = [];
        // Shikimori id — найточніший збіг для аніме й дорам (TMDB часто
        // не має точного відповідника чи IMDb id для азійського контенту).
        if ($title->shikimori_id) {
            $queries[] = ['shikimori_id' => $title->shikimori_id];
        }
        if ($title->imdb_id) {
            $queries[] = ['imdb_id' => $title->imdb_id];
        }
        // MyDramaList — для азіатських дорам; WorldArt — рідше, теж для аніме.
        // Обидва — лише вручну в адмінці (немає джерела для автопошуку).
        if ($title->mdl_id) {
            $queries[] = ['mdl_id' => $title->mdl_id];
        }
        if ($title->worldart_link) {
            $queries[] = ['worldart_link' => $title->worldart_link];
        }
        // TMDB може віддати original_name ієрогліфами, тоді як Kodik
        // індексує той самий тайтл англійською чи російською. alt_names
        // вже містить ці варіанти, тож перебираємо їх усі, а не лише
        // оригінальну назву. Кожну спочатку шукаємо з роком, потім без
        // року — для тривалих та відновлених серіалів.
        $names = collect([
            $title->original_name,
            $title->name,
            ...($title->alt_names ?? []),
        ])->filter(fn ($name) => is_string($name) && trim($name) !== '')
            ->map(fn ($name) => trim($name))
            ->unique(fn ($name) => mb_strtolower($name));

        foreach ($names as $name) {
            $queries[] = array_filter(['title' => $name, 'year' => $title->year]);
            if ($title->year) {
                $queries[] = ['title' => $name];
            }
        }

        $wantSerial = $title->isSeries();
        $fallback = [];
        foreach ($queries as $query) {
            $results = $client->search($query + [
                'with_material_data' => 'true',
                'limit' => 50,
            ])->results;
            if (! $results) {
                continue;
            }
            $matched = array_values(array_filter($results, fn ($r) => str_contains((string) ($r['type'] ?? ''), 'serial') === $wantSerial));
            if ($matched) {
                return $matched;
            }
            // Тип не збігся (фільм/серіал плутається на межі — наприклад,
            // повнометражне продовження серіалу) — тримаємо про запас: краще
            // плеєр із сумнівним типом, ніж жодного.
            $fallback = $fallback ?: $results;
        }

        return $fallback;
    }

    public static function normalizeLink(string $link): string
    {
        $link = trim($link);
        if ($link === '') {
            return '';
        }

        return str_starts_with($link, '//') ? 'https:'.$link : $link;
    }
}
