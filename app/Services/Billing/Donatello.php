<?php

namespace App\Services\Billing;

use App\Support\Settings\SiteSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Donatello (donatello.to): список донатів через API.
 *
 * Токен — у кабінеті Donatello на сторінці API (потрібно ввімкнути API), передається в заголовку X-Token.
 * GET /donates?page=0&size=… → content[]: pubId, clientName, message, amount, currency, createdAt («Y-m-d H:i:s»).
 */
class Donatello
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->token() !== null;
    }

    /**
     * Останні донати (нові спершу).
     *
     * @return list<array{id: string, name: string|null, message: string|null, amount: int, currency: string, created_at: Carbon|null}>
     */
    public function donations(int $size = 50): array
    {
        $json = $this->get('donates', ['page' => 0, 'size' => $size]);
        $out = [];
        foreach ((array) ($json['content'] ?? []) as $row) {
            if (! is_array($row) || ! isset($row['pubId'])) {
                continue;
            }
            $out[] = [
                'id' => (string) $row['pubId'],
                'name' => isset($row['clientName']) ? mb_substr((string) $row['clientName'], 0, 120) : null,
                'message' => isset($row['message']) ? mb_substr((string) $row['message'], 0, 1000) : null,
                'amount' => (int) round((float) ($row['amount'] ?? 0)),
                'currency' => strtoupper((string) ($row['currency'] ?? 'UAH')),
                'created_at' => $this->date($row['createdAt'] ?? null),
            ];
        }

        return $out;
    }

    public function test(): bool
    {
        return $this->get('me') !== null;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function get(string $path, array $query = []): ?array
    {
        $token = $this->token();
        if ($token === null) {
            return null;
        }
        try {
            $response = Http::timeout(10)->acceptJson()->withHeaders(['X-Token' => $token])
                ->get(rtrim((string) config('services.donatello.url'), '/').'/'.$path, $query);
        } catch (Throwable) {
            return null;
        }

        return $response->successful() && is_array($response->json()) ? $response->json() : null;
    }

    private function token(): ?string
    {
        return $this->settings->secret('donatello_token') ?? (filled(config('services.donatello.token')) ? (string) config('services.donatello.token') : null);
    }

    private function date(mixed $value): ?Carbon
    {
        try {
            return is_string($value) && $value !== '' ? Carbon::parse($value, 'Europe/Kyiv') : null;
        } catch (Throwable) {
            return null;
        }
    }
}
