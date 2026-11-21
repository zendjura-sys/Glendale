<?php

namespace App\Support\Net;

use Closure;

/**
 * Захист від SSRF: сервер ходить лише на публічні адреси в інтернеті — не на localhost, не у внутрішню
 * мережу й не на службові адреси хмари. Хост перевіряється за DNS (усі його IP мають бути публічними);
 * знайдені IP можна передати curl (`curlResolve`), щоб з’єднання пішло саме на перевірену адресу.
 */
class PublicUrl
{
    public const WEB = ['http', 'https'];

    /** Причини відмови. */
    public const SCHEME = 'scheme';

    public const CREDENTIALS = 'credentials';

    public const PRIVATE = 'private';

    public const UNRESOLVED = 'unresolved';

    /** @var Closure(string): list<string> */
    private readonly Closure $resolver;

    /**
     * @param  (Closure(string): list<string>)|null  $resolver  DNS-пошук хоста (у тестах — підміна)
     */
    public function __construct(?Closure $resolver = null)
    {
        $this->resolver = $resolver ?? self::dns(...);
    }

    /**
     * @param  list<string>  $schemes
     */
    public function allowed(string $url, array $schemes = self::WEB): bool
    {
        return $this->inspect($url, $schemes)['reason'] === null;
    }

    /**
     * Перевірка адреси: причина відмови (null — можна) і перевірені IP хоста.
     *
     * @param  list<string>  $schemes
     * @return array{reason: string|null, host: string, port: int, ips: list<string>}
     */
    public function inspect(string $url, array $schemes = self::WEB): array
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));
        $port = (int) ($parts['port'] ?? ($scheme === 'http' ? 80 : 443));

        if ($parts === false || ! in_array($scheme, $schemes, true) || $host === '') {
            return self::result($host, $port, self::SCHEME);
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            return self::result($host, $port, self::CREDENTIALS);
        }
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            return self::result($host, $port, self::PRIVATE);
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) !== false ? [$host] : ($this->resolver)($host);
        if ($ips === []) {
            return self::result($host, $port, self::UNRESOLVED);
        }
        foreach ($ips as $ip) {
            if (! self::publicIp($ip)) {
                return self::result($host, $port, self::PRIVATE);
            }
        }

        return self::result($host, $port, null, $ips);
    }

    /**
     * @param  list<string>  $ips
     * @return array{reason: string|null, host: string, port: int, ips: list<string>}
     */
    private static function result(string $host, int $port, ?string $reason, array $ips = []): array
    {
        return ['reason' => $reason, 'host' => $host, 'port' => $port, 'ips' => $ips];
    }

    /** Публічна IP-адреса: не приватна, не зарезервована, не link-local, не multicast. */
    public static function publicIp(string $ip): bool
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE | FILTER_FLAG_GLOBAL_RANGE) === false) {
            return false;
        }
        // Multicast (224.0.0.0/4, ff00::/8) PHP вважає «глобальними».
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return ((int) explode('.', $ip)[0]) < 224;
        }

        return ! str_starts_with(strtolower($ip), 'ff');
    }

    /**
     * Прив’язка з’єднання curl до перевірених IP (щоб DNS не підмінили між перевіркою і запитом).
     *
     * @param  array{host: string, port: int, ips: list<string>}  $inspected
     * @return list<string>
     */
    public static function curlResolve(array $inspected): array
    {
        if ($inspected['ips'] === [] || filter_var($inspected['host'], FILTER_VALIDATE_IP) !== false) {
            return [];
        }
        $ips = array_map(fn (string $ip) => str_contains($ip, ':') ? '['.$ip.']' : $ip, $inspected['ips']);

        return [$inspected['host'].':'.$inspected['port'].':'.implode(',', $ips)];
    }

    /**
     * @return list<string>
     */
    private static function dns(string $host): array
    {
        $ips = gethostbynamel($host) ?: [];
        $records = @dns_get_record($host, DNS_AAAA) ?: [];
        foreach ($records as $record) {
            if (isset($record['ipv6']) && is_string($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }

        return array_values(array_unique($ips));
    }
}
