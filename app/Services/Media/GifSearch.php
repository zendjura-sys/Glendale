<?php

namespace App\Services\Media;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Пошук GIF через Giphy (ключ — в Адмінці → Інтеграції). У записах і чатах зберігаємо лише
 * посилання на media.giphy.com — інші адреси не приймаємо.
 */
class GifSearch
{
    private const HOST = '#^https://media[0-9]*\.giphy\.com/media/[A-Za-z0-9]+/[A-Za-z0-9_.-]+\.(gif|webp|mp4)$#';

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->key() !== null;
    }

    /**
     * Пошук (порожній запит — популярне).
     *
     * @return list<array{id: string, title: string, url: string, preview: string, width: int, height: int}>
     */
    public function search(?string $query): array
    {
        $key = $this->key();
        if ($key === null) {
            return [];
        }
        $query = trim((string) $query);

        return Cache::remember('gifs:'.md5($query), now()->addMinutes(30), function () use ($key, $query) {
            try {
                $response = Http::timeout(8)->get('https://api.giphy.com/v1/gifs/'.($query === '' ? 'trending' : 'search'), array_filter([
                    'api_key' => $key,
                    'q' => $query === '' ? null : Str::limit($query, 50, ''),
                    'limit' => 24,
                    'rating' => 'pg-13',
                    'lang' => 'uk',
                ]));
            } catch (ConnectionException) {
                return [];
            }
            $items = [];
            foreach ((array) $response->json('data', []) as $gif) {
                $full = $gif['images']['downsized']['url'] ?? $gif['images']['fixed_width']['url'] ?? null;
                $preview = $gif['images']['fixed_width_small']['url'] ?? $gif['images']['fixed_width']['url'] ?? $full;
                if (! is_string($full) || ! is_string($preview)) {
                    continue;
                }
                $items[] = [
                    'id' => (string) ($gif['id'] ?? ''),
                    'title' => Str::limit((string) ($gif['title'] ?? 'GIF'), 80, ''),
                    'url' => $this->clean($full),
                    'preview' => $this->clean($preview),
                    'width' => (int) ($gif['images']['downsized']['width'] ?? 0),
                    'height' => (int) ($gif['images']['downsized']['height'] ?? 0),
                ];
            }

            return $items;
        });
    }

    /**
     * Картка GIF для запису чи повідомлення (та сама форма, що й інші картки).
     *
     * @param  array<string, mixed>  $gif
     * @return array{kind: string, id: int, title: string, hint: string, href: string, image: string}
     */
    public function card(array $gif): array
    {
        $url = $this->clean((string) ($gif['url'] ?? ''));
        if (! preg_match(self::HOST, $url)) {
            throw ValidationException::withMessages(['gif' => 'Цей GIF не підходить — оберіть із пошуку.']);
        }

        return ['kind' => 'gif', 'id' => 0, 'title' => Str::limit(trim((string) ($gif['title'] ?? 'GIF')) ?: 'GIF', 80, ''), 'hint' => 'GIF', 'href' => $url, 'image' => $url];
    }

    public function test(): string
    {
        abort_unless($this->configured(), 422, 'Спершу вкажіть ключ.');
        Cache::forget('gifs:'.md5(''));

        return $this->search('') !== [] ? 'Giphy відповідає — популярні GIF підтягуються.' : 'Giphy не повернув GIF. Перевірте ключ.';
    }

    /** Без параметрів відстеження — лише сам файл. */
    private function clean(string $url): string
    {
        return strtok($url, '?') ?: $url;
    }

    private function key(): ?string
    {
        $key = $this->settings->secret('giphy_key');

        return is_string($key) && $key !== '' ? $key : null;
    }
}
