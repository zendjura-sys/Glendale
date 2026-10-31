<?php

namespace App\Services\Antispam;

use App\Models\Community;
use App\Models\IpBan;
use App\Models\Message;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\IpUtils;

/**
 * Бани за IP: адреса чи підмережа (CIDR) на весь сайт, а гостей — за відбитком IP
 * (сам IP гостя ми не зберігаємо). Забанений не може нічого надсилати, але читати сайт може.
 */
class IpBans
{
    private const CACHE = 'antispam.ip-bans';

    /** Відбиток IP — той самий, що в повідомленнях гостей. */
    public static function hash(string $ip): string
    {
        return hash('sha256', $ip.'|'.config('app.key'));
    }

    /**
     * Активні бани простими масивами (кеш не зберігає моделі).
     *
     * @return list<array{id: int, ip: string|null, ip_hash: string|null, community_id: int|null, expires_at: int|null}>
     */
    public function active(): array
    {
        return Cache::remember(self::CACHE, 300, fn () => array_values(IpBan::query()->active()->get()
            ->map(fn (IpBan $ban) => [
                'id' => $ban->id,
                'ip' => $ban->ip,
                'ip_hash' => $ban->ip_hash,
                'community_id' => $ban->community_id,
                'expires_at' => $ban->expires_at?->getTimestamp(),
            ])->all()));
    }

    /**
     * Чи забанено цей IP на сайті (або в гостьовому чаті спільноти, якщо вказано).
     *
     * @return array{id: int, ip: string|null, ip_hash: string|null, community_id: int|null, expires_at: int|null}|null
     */
    public function banned(?string $ip, ?int $communityId = null): ?array
    {
        if ($ip === null || $ip === '') {
            return null;
        }
        $hash = self::hash($ip);
        foreach ($this->active() as $ban) {
            if ($ban['community_id'] !== null && $ban['community_id'] !== $communityId) {
                continue;
            }
            if ($ban['expires_at'] !== null && $ban['expires_at'] <= time()) {
                continue;
            }
            if (($ban['ip_hash'] !== null && hash_equals($ban['ip_hash'], $hash))
                || ($ban['ip'] !== null && IpUtils::checkIp($ip, $ban['ip']))) {
                return $ban;
            }
        }

        return null;
    }

    /**
     * Бан адреси чи підмережі на весь сайт (адмінка).
     */
    public function banIp(User $by, string $ip, ?string $reason, ?int $days): IpBan
    {
        $ip = trim($ip);
        if (! self::validIp($ip)) {
            throw ValidationException::withMessages(['ip' => 'Вкажіть IP-адресу (1.2.3.4) або підмережу (1.2.3.0/24).']);
        }
        $ban = IpBan::query()->create([
            'ip' => $ip,
            'reason' => $reason,
            'expires_at' => $days ? CarbonImmutable::now()->addDays($days) : null,
            'created_by' => $by->id,
        ]);
        $this->flush();
        Log::info('admin: ip ban', ['ip' => $ip, 'days' => $days, 'by' => $by->id]);

        return $ban;
    }

    /**
     * Бан гостя за повідомленням: у гостьовому чаті спільноти або (адмін сайту) всюди.
     */
    public function banGuest(User $by, Message $message, ?Community $community, ?string $reason, ?int $days): IpBan
    {
        $hash = $message->meta['guest']['ip'] ?? null;
        if (! is_string($hash) || $hash === '') {
            throw ValidationException::withMessages(['message' => 'Це не повідомлення гостя.']);
        }
        $ban = IpBan::query()->create([
            'ip_hash' => $hash,
            'community_id' => $community?->id,
            'label' => mb_substr((string) ($message->meta['guest']['name'] ?? 'Гість'), 0, 80),
            'reason' => $reason,
            'expires_at' => $days ? CarbonImmutable::now()->addDays($days) : null,
            'created_by' => $by->id,
        ]);
        $this->flush();
        Log::info('moderation: guest ban', ['message' => $message->id, 'community' => $community?->id, 'days' => $days, 'by' => $by->id]);

        return $ban;
    }

    public function lift(IpBan $ban, User $by): void
    {
        $ban->delete();
        $this->flush();
        Log::info('admin: ip ban lifted', ['ban' => $ban->id, 'ip' => $ban->ip, 'by' => $by->id]);
    }

    public static function validIp(string $ip): bool
    {
        [$address, $mask] = array_pad(explode('/', $ip, 2), 2, null);
        if (filter_var($address, FILTER_VALIDATE_IP) === false) {
            return false;
        }
        if ($mask === null) {
            return true;
        }
        $max = str_contains((string) $address, ':') ? 128 : 32;

        // Надто широкі підмережі (/0…/7) забанять пів інтернету — не дозволяємо.
        return ctype_digit($mask) && (int) $mask >= 8 && (int) $mask <= $max;
    }

    private function flush(): void
    {
        Cache::forget(self::CACHE);
    }
}
