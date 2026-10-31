<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Шпалери гри: арти й скриншоти IGDB у 1080p. Завантаження — через сайт, щоб браузер зберіг файл
 * (з чужого домену атрибут download не працює). Віддаємо лише картинки з каталогу цієї гри.
 */
class GameWallpaperController extends Controller
{
    public const MAX_BYTES = 15 * 1024 * 1024;

    /**
     * Шпалери гри в 1080p: спершу арти, далі скриншоти.
     *
     * @return list<string>
     */
    public static function list(Game $game): array
    {
        $details = $game->details ?? [];
        $urls = [];
        foreach (['artworks', 'screenshots'] as $key) {
            foreach ((array) ($details[$key] ?? []) as $url) {
                if (is_string($url) && str_starts_with($url, 'https://images.igdb.com/')) {
                    $urls[] = (string) preg_replace('#/t_[a-z0-9_]+/#', '/t_1080p/', $url);
                }
            }
        }

        return array_values(array_unique($urls));
    }

    public function download(Game $game, int $index): Response
    {
        app(Plugins::class)->ensure('game_wallpapers');
        $url = self::list($game)[$index] ?? null;
        abort_if($url === null, 404);
        try {
            $response = Http::timeout(20)->connectTimeout(5)->get($url);
        } catch (ConnectionException|RequestException) {
            abort(502, 'Не вдалося завантажити зображення.');
        }
        $type = (string) $response->header('Content-Type');
        abort_unless($response->successful() && str_starts_with($type, 'image/') && strlen($response->body()) <= self::MAX_BYTES, 502, 'Не вдалося завантажити зображення.');
        $extension = str_contains($type, 'png') ? 'png' : 'jpg';

        return response($response->body(), 200, [
            'Content-Type' => $type,
            'Content-Disposition' => 'attachment; filename="'.Str::slug($game->name).'-'.($index + 1).'.'.$extension.'"',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
