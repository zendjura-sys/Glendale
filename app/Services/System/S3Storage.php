<?php

namespace App\Services\System;

use App\Support\Settings\SiteSettings;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Мінімальний S3-клієнт (підпис AWS SigV4) для хмарних копій бази (№268): завантажити файл,
 * перелічити й видалити. Працює з будь-яким S3-сумісним сховищем — Cloudflare R2, Backblaze B2,
 * AWS S3, Wasabi, MinIO. Без aws-sdk: нам потрібні лише три запити.
 */
class S3Storage
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->endpoint() !== null && $this->bucket() !== null
            && $this->setting('backup_s3_key') !== null && $this->settings->secret('backup_s3_secret') !== null;
    }

    /** Покласти локальний файл у сховище (потоком, без читання в пам’ять). */
    public function put(string $key, string $path): void
    {
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new RuntimeException('Не вдалося відкрити файл копії.');
        }
        try {
            $response = $this->request('PUT', $key, [], $stream, (int) filesize($path));
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
        $this->ensure($response, 'завантажити копію');
    }

    /**
     * Ключі об’єктів із префіксом (до 1000 — нам вистачає з запасом).
     *
     * @return list<array{key: string, size: int, modified: string}>
     */
    public function list(string $prefix): array
    {
        $response = $this->request('GET', '', ['list-type' => '2', 'prefix' => $prefix]);
        $this->ensure($response, 'перелічити копії');
        $xml = simplexml_load_string($response->body());
        if ($xml === false) {
            return [];
        }
        $out = [];
        foreach ($xml->Contents as $item) {
            $out[] = ['key' => (string) $item->Key, 'size' => (int) $item->Size, 'modified' => (string) $item->LastModified];
        }

        return $out;
    }

    public function delete(string $key): void
    {
        $this->ensure($this->request('DELETE', $key), 'видалити стару копію');
    }

    /** Для «Перевірити» в адмінці: сховище відповідає й ключі приймає. */
    public function test(): bool
    {
        if (! $this->configured()) {
            return false;
        }
        try {
            $this->list($this->prefix());

            return true;
        } catch (RuntimeException|ConnectionException) {
            return false;
        }
    }

    /** Тека копій у сховищі («gamecon/»). */
    public function prefix(): string
    {
        $prefix = trim((string) $this->setting('backup_s3_prefix'), '/');

        return $prefix === '' ? '' : $prefix.'/';
    }

    /**
     * @param  array<string, string>  $query
     * @param  resource|null  $body
     */
    private function request(string $method, string $key, array $query = [], $body = null, int $length = 0): Response
    {
        $endpoint = (string) $this->endpoint();
        $bucket = (string) $this->bucket();
        $host = (string) parse_url($endpoint, PHP_URL_HOST);
        $port = parse_url($endpoint, PHP_URL_PORT);
        $hostHeader = $port ? "{$host}:{$port}" : $host;
        // Адреса «шляхом» (endpoint/bucket/key) — її розуміють усі S3-сумісні сховища.
        $path = '/'.rawurlencode($bucket).($key !== '' ? '/'.implode('/', array_map('rawurlencode', explode('/', $key))) : '/');
        ksort($query);
        $canonicalQuery = implode('&', array_map(fn ($k, $v) => rawurlencode($k).'='.rawurlencode($v), array_keys($query), $query));

        $now = gmdate('Ymd\THis\Z');
        $date = substr($now, 0, 8);
        $region = $this->setting('backup_s3_region') ?? 'auto';
        $scope = "{$date}/{$region}/s3/aws4_request";
        $payloadHash = $body === null ? hash('sha256', '') : 'UNSIGNED-PAYLOAD';
        $headers = ['host' => $hostHeader, 'x-amz-content-sha256' => $payloadHash, 'x-amz-date' => $now];
        $signedHeaders = implode(';', array_keys($headers));
        $canonical = implode("\n", [
            $method, $path, $canonicalQuery,
            implode('', array_map(fn ($k, $v) => "{$k}:{$v}\n", array_keys($headers), $headers)),
            $signedHeaders, $payloadHash,
        ]);
        $toSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonical)]);
        $signingKey = hash_hmac('sha256', 'aws4_request', hash_hmac('sha256', 's3', hash_hmac('sha256', $region, hash_hmac('sha256', $date, 'AWS4'.$this->settings->secret('backup_s3_secret'), true), true), true), true);
        $authorization = sprintf('AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s',
            $this->setting('backup_s3_key'), $scope, $signedHeaders, hash_hmac('sha256', $toSign, $signingKey));

        $request = Http::timeout($body === null ? 20 : 1800)->connectTimeout(10)->withHeaders([
            'x-amz-content-sha256' => $payloadHash,
            'x-amz-date' => $now,
            'Authorization' => $authorization,
        ]);
        $url = rtrim($endpoint, '/').$path.($canonicalQuery !== '' ? '?'.$canonicalQuery : '');
        if ($body !== null) {
            $request = $request->withBody(Utils::streamFor($body), 'application/octet-stream')->withHeaders(['Content-Length' => (string) $length]);
        }

        return $request->send($method, $url);
    }

    private function ensure(Response $response, string $what): void
    {
        if (! $response->successful()) {
            $code = $response->status();
            throw new RuntimeException(match (true) {
                in_array($code, [401, 403], true) => "Сховище не прийняло ключі — не вдалося {$what}.",
                $code === 404 => "Кошик не знайдено — не вдалося {$what}.",
                default => "Сховище відповіло {$code} — не вдалося {$what}.",
            });
        }
    }

    private function endpoint(): ?string
    {
        $value = $this->setting('backup_s3_endpoint');

        return $value !== null && preg_match('#\Ahttps?://#i', $value) === 1 ? rtrim($value, '/') : null;
    }

    private function bucket(): ?string
    {
        return $this->setting('backup_s3_bucket');
    }

    private function setting(string $key): ?string
    {
        $value = $this->settings->get($key);

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
