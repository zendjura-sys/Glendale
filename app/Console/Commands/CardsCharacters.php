<?php

namespace App\Console\Commands;

use App\Models\CardCharacter;
use App\Models\Movie;
use App\Services\Cinema\Metadata\ShikimoriProvider;
use App\Services\Cinema\Metadata\TmdbProvider;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Персонажі для колекційних карток: аніме — з Shikimori, фільми й серіали — з TMDB (ключ з адмінки).
 * Лише додає й оновлює: картки, які вже є в людей, не зникають.
 */
class CardsCharacters extends Command
{
    protected $signature = 'cards:characters {--limit=40 : Скільки тайтлів обробити за запуск}';

    protected $description = 'Підтягнути персонажів аніме, фільмів і серіалів для колекційних карток';

    public function handle(ShikimoriProvider $shikimori, TmdbProvider $tmdb): int
    {
        $added = 0;
        $movies = Movie::query()->where('is_published', true)
            ->whereNotIn('id', CardCharacter::query()->select('movie_id'))
            ->orderByDesc('watchers_count')->orderByDesc('id')
            ->limit((int) $this->option('limit'))->get();
        foreach ($movies as $movie) {
            $rows = $movie->type === 'anime' ? $shikimori->characters($movie) : $tmdb->characters($movie);
            $source = $movie->type === 'anime' ? 'shikimori' : 'tmdb';
            foreach ($rows as $row) {
                CardCharacter::query()->updateOrCreate(
                    ['movie_id' => $movie->id, 'source' => $source, 'source_id' => $row['source_id']],
                    ['name' => $row['name'], 'image_url' => $row['image_url'], 'role' => $row['role'], 'popularity' => $row['popularity']],
                );
                $added++;
            }
        }
        Cache::forget('cards.catalog');
        $this->info("Персонажів додано або оновлено: {$added}");

        return self::SUCCESS;
    }
}
