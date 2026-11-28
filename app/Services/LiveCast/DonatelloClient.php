<?php

namespace App\Services\LiveCast;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * REST API Donatello: https://donatello.to/api/v1 — заголовок X-Token.
 *
 * @see https://donatello.to/panel/doc-api
 */
class DonatelloClient
{
    private readonly string $baseUrl;

    public function __construct(
        private readonly string $token,
        ?string $baseUrl = null,
    ) {
        $this->baseUrl = $baseUrl ?: (string) config('services.donatello.url', 'https://donatello.to/api/v1');
    }

    /** @return array{ok: bool, nickname?: string, page?: string, message?: string, raw?: array<string, mixed>} */
    public function me(): array
    {
        $res = $this->http()->get($this->baseUrl.'/me');
        $json = $res->json() ?? [];
        if (! $res->successful() || ! ($json['success'] ?? false)) {
            return ['ok' => false, 'message' => (string) ($json['message'] ?? 'Помилка Donatello'), 'raw' => $json];
        }

        return [
            'ok' => true,
            'nickname' => (string) ($json['nickName'] ?? $json['nickname'] ?? ''),
            'page' => (string) ($json['page'] ?? ''),
            'raw' => $json,
        ];
    }

    /**
     * @return list<array{external_id: string, donor: string, message: string, amount: float, currency: string, created_at: string|null}>
     */
    public function donates(int $page = 0, int $size = 20): array
    {
        $res = $this->http()->get($this->baseUrl.'/donates', ['page' => $page, 'size' => $size]);
        $json = $res->json() ?? [];
        if (! $res->successful() || ! ($json['success'] ?? false)) {
            return [];
        }
        $out = [];
        foreach ($json['content'] ?? [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            $norm = DonationInbox::normalize([
                'external_id' => (string) ($row['pubId'] ?? ''),
                'donor' => (string) ($row['clientName'] ?? 'Анонім'),
                'message' => (string) ($row['message'] ?? ''),
                'amount' => $row['amount'] ?? 0,
                'currency' => (string) ($row['currency'] ?? 'UAH'),
                'created_at' => isset($row['createdAt']) ? (string) $row['createdAt'] : null,
            ], 'donatello');
            if ($norm !== null) {
                $out[] = $norm;
            }
        }

        return $out;
    }

    private function http(): PendingRequest
    {
        return Http::acceptJson()
            ->timeout(12)
            ->withHeaders(['X-Token' => $this->token]);
    }
}
