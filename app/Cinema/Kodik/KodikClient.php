<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use JsonException;

final class KodikClient
{
    public const API = 'https://kodikapi.com';

    private const MAX_ATTEMPTS = 3;

    public function __construct(private readonly ?string $token = null) {}

    public function search(array $query): KodikPage
    {
        return $this->request('search', $query);
    }

    public function list(array $query): KodikPage
    {
        return $this->request('list', $query);
    }

    private function request(string $endpoint, array $query): KodikPage
    {
        $token = $this->token ?? CinemaSettings::kodikToken();
        if ($token === null || trim($token) === '') {
            throw $this->failure('auth', $endpoint, null, 0);
        }

        for ($attempt = 1; $attempt <= self::MAX_ATTEMPTS; $attempt++) {
            try {
                $response = Http::timeout(15)
                    ->connectTimeout(8)
                    ->acceptJson()
                    ->get(self::API.'/'.$endpoint, array_merge($query, ['token' => $token]));
            } catch (ConnectionException $exception) {
                if ($attempt < self::MAX_ATTEMPTS) {
                    continue;
                }

                throw $this->failure('transport', $endpoint, null, $attempt, $exception);
            }

            if (in_array($response->status(), [401, 403], true)) {
                throw $this->failure('auth', $endpoint, $response, $attempt);
            }

            if ($response->status() === 429) {
                if ($attempt < self::MAX_ATTEMPTS) {
                    continue;
                }

                throw $this->failure('rate_limit', $endpoint, $response, $attempt);
            }

            if ($response->serverError()) {
                if ($attempt < self::MAX_ATTEMPTS) {
                    continue;
                }

                throw $this->failure('server', $endpoint, $response, $attempt);
            }

            if (! $response->successful()) {
                throw $this->failure('contract', $endpoint, $response, $attempt);
            }

            return $this->page($response, $endpoint, $attempt);
        }

        throw $this->failure('transport', $endpoint, null, self::MAX_ATTEMPTS);
    }

    private function page(Response $response, string $endpoint, int $attempt): KodikPage
    {
        try {
            $payload = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw $this->failure('contract', $endpoint, $response, $attempt, $exception);
        }

        if (! is_array($payload) || ! array_key_exists('results', $payload) || ! is_array($payload['results'])) {
            throw $this->failure('contract', $endpoint, $response, $attempt);
        }

        $nextPage = $payload['next_page'] ?? $payload['next'] ?? null;
        if ($nextPage !== null && ! is_string($nextPage)) {
            throw $this->failure('contract', $endpoint, $response, $attempt);
        }

        $total = $payload['total'] ?? count($payload['results']);
        if (! is_numeric($total)) {
            throw $this->failure('contract', $endpoint, $response, $attempt);
        }

        return new KodikPage(array_values($payload['results']), $nextPage, (int) $total);
    }

    private function failure(
        string $kind,
        string $endpoint,
        ?Response $response,
        int $attempts,
        ?\Throwable $previous = null,
    ): KodikApiException {
        return new KodikApiException(
            $kind,
            "Kodik API {$kind} failure.",
            [
                'endpoint' => $endpoint,
                'status' => $response?->status(),
                'attempts' => $attempts,
            ],
            $previous,
        );
    }
}
