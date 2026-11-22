<?php

namespace App\Services\LiveCast;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * REST API Donatik (api.donatik.ua). Публічної документації мало — Bearer-токен і /donations.
 */
class DonatikClient
{
    private readonly string $baseUrl;

    public function __construct(
        private readonly string $token,
        ?string $baseUrl = null,
    ) {
        $this->baseUrl = $baseUrl ?: (string) config('services.donatik.url', 'https://api.donatik.ua');
    }

    /**
     * Перевірка токена: успішна відповідь на /donations (не 401).
     *
     * @return array<string, mixed>
     */
    public function ping(): array
    {
        $res = $this->http()->get($this->baseUrl.'/donations');
        if ($res->status() === 401) {
            return ['ok' => false, 'message' => 'Невірний токен Donatik'];
        }
        // 200 / порожній список / 500 на поганому форматі — токен прийнято сервером інакше, ніж 401.
        if ($res->successful()) {
            return ['ok' => true, 'raw' => $res->json() ?? []];
        }

        return [
            'ok' => true,
            'message' => (string) ($res->json('message') ?? 'Donatik не відповів'),
            'status' => $res->status(),
            'raw' => $res->json() ?? [],
        ];
    }

    /**
     * @return list<array{external_id: string, donor: string, message: string, amount: float, currency: string, created_at: string|null}>
     */
    public function donations(): array
    {
        $res = $this->http()->get($this->baseUrl.'/donations');
        if (! $res->successful()) {
            return [];
        }
        $json = $res->json();
        $rows = [];
        if (is_array($json)) {
            $rows = $json['data'] ?? $json['donations'] ?? $json['items'] ?? $json['content'] ?? (array_is_list($json) ? $json : []);
        }
        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $norm = DonationInbox::normalize([
                'external_id' => (string) ($row['id'] ?? $row['pubId'] ?? $row['_id'] ?? ''),
                'donor' => (string) ($row['name'] ?? $row['clientName'] ?? $row['nickname'] ?? $row['from'] ?? 'Анонім'),
                'message' => (string) ($row['message'] ?? $row['comment'] ?? $row['text'] ?? ''),
                'amount' => $row['amount'] ?? $row['sum'] ?? $row['value'] ?? 0,
                'currency' => (string) ($row['currency'] ?? $row['curr'] ?? 'UAH'),
                'created_at' => isset($row['createdAt']) ? (string) $row['createdAt'] : (isset($row['created_at']) ? (string) $row['created_at'] : null),
            ], 'donatik');
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
            ->withToken($this->token);
    }
}
