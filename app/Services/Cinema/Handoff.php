<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * «Продовжити на іншому пристрої» для кіно: де й на якому пристрої людина зупинилась.
 * Інший пристрій (сайт на ПК/телефоні чи застосунок) пропонує продовжити з того самого місця.
 * Музику покриває GameCon Connect («Грати тут»).
 */
class Handoff
{
    /** Скільки годин пропозиція актуальна. */
    public const HOURS = 6;

    public const DEVICES = ['app' => 'у застосунку', 'phone' => 'на телефоні', 'computer' => 'на комп’ютері'];

    public function device(Request $request): string
    {
        if ($request->bearerToken() !== null || $request->is('api/*')) {
            return 'app';
        }

        return preg_match('/Mobi|Android|iPhone|iPad/i', (string) $request->userAgent()) ? 'phone' : 'computer';
    }

    public function record(User $user, Movie $movie, ?int $season, int $episode, ?int $position, Request $request): void
    {
        Cache::put($this->key($user), [
            'movie_id' => $movie->id,
            'season' => $season,
            'episode' => $episode,
            'position' => $position,
            'device' => $this->device($request),
            'at' => now()->getTimestamp(),
        ], now()->addHours(self::HOURS));
    }

    /**
     * Пропозиція для поточного пристрою: лише якщо дивились на іншому.
     *
     * @return array<string, mixed>|null
     */
    public function offer(User $user, Request $request): ?array
    {
        $state = Cache::get($this->key($user));
        if (! is_array($state) || ($state['device'] ?? null) === $this->device($request)) {
            return null;
        }
        $movie = Movie::query()->published()->find($state['movie_id'] ?? 0);
        if ($movie === null) {
            return null;
        }
        $position = is_int($state['position'] ?? null) ? $state['position'] : null;
        $season = $state['season'] ?? null;
        $episode = (int) ($state['episode'] ?? 1);

        return [
            // Ключ, щоб клієнт не показував ту саму пропозицію двічі.
            'key' => $movie->id.':'.$season.':'.$episode.':'.($state['at'] ?? 0),
            'movie' => $movie->toCard(),
            'season' => $season,
            'episode' => $episode,
            'position' => $position,
            'time' => $position !== null ? sprintf($position >= 3600 ? '%d:%02d:%02d' : '%2$d:%3$02d', intdiv($position, 3600), intdiv($position % 3600, 60), $position % 60) : null,
            'device' => $state['device'],
            'device_label' => self::DEVICES[$state['device']] ?? '',
            'at' => date(DATE_ATOM, (int) ($state['at'] ?? time())),
        ];
    }

    public function clear(User $user): void
    {
        Cache::forget($this->key($user));
    }

    private function key(User $user): string
    {
        return 'cinema_handoff:'.$user->id;
    }
}
