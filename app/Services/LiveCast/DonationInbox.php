<?php

namespace App\Services\LiveCast;

use App\Models\Livecast;
use App\Models\LivecastIntegration;
use App\Models\LivecastMessage;
use App\Models\User;
use App\Support\LiveCast\DonationPresets;
use Illuminate\Support\Facades\Cache;

/**
 * Нормалізація донатів Donatik/Donatello і публікація в чат живого стріму.
 */
class DonationInbox
{
    /**
     * @param  array<string, mixed>  $raw
     * @return array{external_id: string, donor: string, message: string, amount: float, currency: string, created_at: string|null, provider: string}|null
     */
    public static function normalize(array $raw, string $provider): ?array
    {
        $amount = (float) ($raw['amount'] ?? 0);
        $donor = trim((string) ($raw['donor'] ?? 'Анонім'));
        $external = trim((string) ($raw['external_id'] ?? ''));
        if ($amount <= 0 && $external === '' && $donor === '') {
            return null;
        }
        if ($external === '') {
            $external = sha1($provider.'|'.$donor.'|'.$amount.'|'.($raw['message'] ?? '').'|'.($raw['created_at'] ?? ''));
        }

        return [
            'provider' => $provider,
            'external_id' => mb_substr($external, 0, 80),
            'donor' => mb_substr($donor !== '' ? $donor : 'Анонім', 0, 80),
            'message' => mb_substr(trim((string) ($raw['message'] ?? '')), 0, 280),
            'amount' => round($amount, 2),
            'currency' => strtoupper(mb_substr((string) ($raw['currency'] ?? 'UAH'), 0, 8)) ?: 'UAH',
            'created_at' => isset($raw['created_at']) ? (string) $raw['created_at'] : null,
        ];
    }

    /**
     * Розібрати тіло колбеку Donatello / Donatik у єдиний формат.
     *
     * @param  array<string, mixed>  $body
     * @return array{external_id: string, donor: string, message: string, amount: float, currency: string, created_at: string|null, provider: string}|null
     */
    public static function fromWebhook(string $provider, array $body): ?array
    {
        return self::normalize([
            'external_id' => (string) ($body['pubId'] ?? $body['id'] ?? $body['donation_id'] ?? $body['_id'] ?? ''),
            'donor' => (string) ($body['clientName'] ?? $body['name'] ?? $body['nickname'] ?? $body['from'] ?? $body['username'] ?? 'Анонім'),
            'message' => (string) ($body['message'] ?? $body['comment'] ?? $body['text'] ?? ''),
            'amount' => $body['amount'] ?? $body['sum'] ?? $body['value'] ?? 0,
            'currency' => (string) ($body['currency'] ?? $body['curr'] ?? 'UAH'),
            'created_at' => isset($body['createdAt']) ? (string) $body['createdAt'] : (isset($body['created_at']) ? (string) $body['created_at'] : null),
        ], $provider);
    }

    /**
     * @param  array{external_id: string, donor: string, message: string, amount: float, currency: string, created_at: string|null, provider: string}  $donation
     */
    public function publish(User $host, array $donation): ?LivecastMessage
    {
        $stream = Livecast::query()
            ->where('host_id', $host->id)
            ->where('status', Livecast::LIVE)
            ->latest('started_at')
            ->first();
        if ($stream === null) {
            return null;
        }

        $dedupe = 'livecast:donation:'.$donation['provider'].':'.$donation['external_id'];
        if (! Cache::add($dedupe, 1, now()->addDays(7))) {
            return null;
        }

        $exists = LivecastMessage::query()
            ->where('livecast_id', $stream->id)
            ->where('kind', LivecastMessage::DONATION)
            ->where('meta->external_id', $donation['external_id'])
            ->where('meta->provider', $donation['provider'])
            ->exists();
        if ($exists) {
            return null;
        }

        $preset = DonationPresets::find($donation['provider']);
        $label = $preset['name'] ?? $donation['provider'];
        $amount = rtrim(rtrim(number_format($donation['amount'], 2, '.', ''), '0'), '.');
        $body = '💰 '.$donation['donor'].' · '.$amount.' '.$donation['currency'].' ('.$label.')';
        if ($donation['message'] !== '') {
            $body .= ' — '.$donation['message'];
        }

        return LivecastMessage::query()->create([
            'livecast_id' => $stream->id,
            'user_id' => $host->id,
            'kind' => LivecastMessage::DONATION,
            'gift_key' => null,
            'meta' => $donation,
            'body' => mb_substr($body, 0, 280),
        ]);
    }

    public function verifyKey(LivecastIntegration $integration, ?string $headerKey, ?string $bearer, ?string $queryKey): bool
    {
        $expected = (string) $integration->webhook_key;
        if ($expected === '') {
            return false;
        }
        foreach ([$headerKey, $bearer, $queryKey] as $got) {
            if (is_string($got) && $got !== '' && hash_equals($expected, $got)) {
                return true;
            }
        }

        return false;
    }
}
