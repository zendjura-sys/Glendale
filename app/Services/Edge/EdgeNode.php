<?php

namespace App\Services\Edge;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;

/**
 * Edge-вузол (deploy/edge): окремий сервер з LiveKit і CDN-кешем, напр. Oracle Cloud.
 * В адмінці (Інтеграції → Edge-вузол) обирають, який сервер обслуговує голос і файли: основний чи вузол.
 * Якщо вузол не відповідає, сайт сам повертається на основний сервер, доки вузол не оживе.
 */
class EdgeNode
{
    public const MAIN = 'main';

    public const EDGE = 'edge';

    /** Позначка «вузол лежить» (ставить перевірка щохвилини). */
    private const DOWN = 'edge.down';

    public function __construct(private readonly SiteSettings $settings) {}

    /** https://адреса-вузла без кінцевого слеша або null. */
    public function host(): ?string
    {
        $value = trim((string) $this->settings->get('edge_host'));
        if ($value === '') {
            return null;
        }
        if (! str_contains($value, '://')) {
            $value = 'https://'.$value;
        }

        return preg_match('#\Ahttps://[^\s/]+\z#i', rtrim($value, '/')) === 1 ? rtrim($value, '/') : null;
    }

    public function healthy(): bool
    {
        return ! Cache::has(self::DOWN);
    }

    /** Голос іде через вузол (обрано в адмінці, адреса є й вузол живий). */
    public function voice(): bool
    {
        return $this->settings->get('edge_voice') === self::EDGE && $this->host() !== null && $this->healthy();
    }

    /** Файли (збірка й /storage) ідуть з кешу вузла. */
    public function cdn(): bool
    {
        return $this->settings->get('edge_cdn') === self::EDGE && $this->host() !== null && $this->healthy();
    }

    /** wss://адреса для LiveKit на вузлі. */
    public function voiceUrl(): ?string
    {
        $host = $this->host();

        return $host === null ? null : 'wss://'.substr($host, strlen('https://'));
    }

    /** Застосувати CDN до адрес сайту на цей запит: збірка Vite й публічний диск. */
    public function apply(): void
    {
        if (! $this->cdn()) {
            return;
        }
        $host = (string) $this->host();
        URL::useAssetOrigin($host);
        config(['filesystems.disks.public.url' => $host.'/storage']);
    }

    /** Чи відповідає вузол (/edge-health). */
    public function ping(): bool
    {
        $host = $this->host();
        if ($host === null) {
            return false;
        }
        try {
            return Http::timeout(5)->connectTimeout(3)->get($host.'/edge-health')->successful();
        } catch (ConnectionException|RequestException) {
            return false;
        }
    }

    /**
     * Щохвилинна перевірка: дві невдачі поспіль — вузол позначено «лежить», сайт віддає все сам.
     * Повертає стан для журналу.
     */
    public function probe(): string
    {
        if ($this->host() === null || ($this->settings->get('edge_voice') !== self::EDGE && $this->settings->get('edge_cdn') !== self::EDGE)) {
            Cache::forget(self::DOWN);

            return 'off';
        }
        if ($this->ping()) {
            Cache::forget(self::DOWN);
            Cache::forget('edge.fails');

            return 'ok';
        }
        $fails = (int) Cache::increment('edge.fails');
        if ($fails >= 2) {
            Cache::put(self::DOWN, now()->toIso8601String(), now()->addMinutes(10));
        }

        return 'fail';
    }

    /** Для адмінки: перевірити вузол зараз. */
    public function test(): bool
    {
        return $this->ping();
    }
}
