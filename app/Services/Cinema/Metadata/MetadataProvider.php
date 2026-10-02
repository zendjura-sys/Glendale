<?php

namespace App\Services\Cinema\Metadata;

use App\Models\Movie;
use App\Services\Cinema\CinemaException;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Джерело метаданних фільму. lookup() повертає підмножину атрибутів Movie (null — нічого не знайдено).
 */
abstract class MetadataProvider
{
    public function __construct(protected readonly SiteSettings $settings) {}

    abstract public function key(): string;

    abstract public function label(): string;

    abstract public function configured(): bool;

    /**
     * @return array<string, mixed>|null
     */
    abstract public function lookup(Movie $movie): ?array;

    abstract public function test(): bool;

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null null, якщо 404
     */
    protected function fetch(PendingRequest $http, string $url, array $query = []): ?array
    {
        try {
            $response = $http->acceptJson()->timeout(15)->get($url, $query);
        } catch (ConnectionException) {
            throw new CinemaException($this->label().' не відповідає.');
        }

        if ($response->status() === 404) {
            return null;
        }
        if (in_array($response->status(), [401, 403], true)) {
            throw new CinemaException($this->label().' відхилив ключ. Перевірте його в інтеграціях.', 401);
        }
        if ($response->status() === 429) {
            throw new CinemaException($this->label().': перевищено ліміт запитів, спробуйте пізніше.', 429);
        }
        $json = $response->json();
        if (! $response->successful() || ! is_array($json)) {
            throw new CinemaException($this->label().' тимчасово недоступний.');
        }

        return $json;
    }

    protected function http(): PendingRequest
    {
        return Http::withUserAgent('GameCon/1.0 (+'.config('app.url').')');
    }

    protected static function str(mixed $value, int $limit = 0): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);
        if ($value === '' || in_array(strtoupper($value), ['N/A', 'NULL'], true)) {
            return null;
        }

        return $limit > 0 ? Str::limit($value, $limit, '') : $value;
    }

    protected static function rating(mixed $value): ?float
    {
        return is_numeric($value) && (float) $value > 0 ? round((float) $value, 1) : null;
    }

    protected static function year(mixed $value): ?int
    {
        return is_scalar($value) && preg_match('/(\d{4})/', (string) $value, $m) ? (int) $m[1] : null;
    }

    protected static function hasCyrillic(?string $value): bool
    {
        return $value !== null && preg_match('/\p{Cyrillic}/u', $value) === 1;
    }
}
