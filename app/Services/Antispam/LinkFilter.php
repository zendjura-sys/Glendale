<?php

namespace App\Services\Antispam;

use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;

/**
 * Фільтр доменів у посиланнях: чорний список або режим «лише дозволені домени».
 * Піддомени теж рахуються (blocked.com зупиняє і www.blocked.com). Свій домен пропускаємо завжди.
 */
class LinkFilter
{
    public const MODES = ['blocklist', 'allowlist'];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * @return array{mode: string, blocked: list<string>, allowed: list<string>}
     */
    public function config(): array
    {
        $stored = $this->settings->get('link_filter');
        $stored = is_array($stored) ? $stored : [];

        return [
            'mode' => in_array($stored['mode'] ?? null, self::MODES, true) ? (string) $stored['mode'] : 'blocklist',
            'blocked' => self::domains($stored['blocked'] ?? []),
            'allowed' => self::domains($stored['allowed'] ?? []),
        ];
    }

    /** Перший домен у тексті, який не можна надсилати, або null. */
    public function forbidden(string $text): ?string
    {
        if (! app(Plugins::class)->on('link_filter')) {
            return null;
        }
        $config = $this->config();
        if ($config['mode'] === 'blocklist' && $config['blocked'] === []) {
            return null;
        }
        $own = strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST));
        foreach (self::hosts($text) as $host) {
            if ($own !== '' && self::matches($host, [$own])) {
                continue;
            }
            if (self::matches($host, $config['blocked'])) {
                return $host;
            }
            if ($config['mode'] === 'allowlist' && ! self::matches($host, $config['allowed'])) {
                return $host;
            }
        }

        return null;
    }

    /** «Голі» назви файлів (tactics.txt, demo.cfg) — не посилання. */
    private const FILE_EXTENSIONS = ['txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'mp4', 'pdf', 'zip', 'rar', 'exe', 'js', 'ts', 'php', 'html', 'json', 'cfg', 'ini', 'log', 'doc', 'docx', 'xls', 'xlsx', 'dem', 'csv'];

    /**
     * Домени з тексту: з http(s)://, www. і «голі» на кшталт t.me/… чи example.com.
     *
     * @return list<string>
     */
    public static function hosts(string $text): array
    {
        preg_match_all('~(https?://)?((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+([\p{L}]{2,24}))(?=[/:?#\s]|$|[),.!])~iu', $text, $m, PREG_SET_ORDER);
        $hosts = [];
        foreach ($m as [, $scheme, $host, $tld]) {
            if ($scheme === '' && in_array(mb_strtolower($tld), self::FILE_EXTENSIONS, true)) {
                continue;
            }
            $hosts[] = (string) preg_replace('/^www\./', '', mb_strtolower($host));
        }

        return array_values(array_unique($hosts));
    }

    /**
     * Домени з поля адмінки (рядок або список): лише хост, без протоколу й шляху.
     *
     * @return list<string>
     */
    public static function domains(mixed $value): array
    {
        $items = is_array($value) ? $value : (preg_split('/[\s,]+/', (string) $value) ?: []);
        $clean = [];
        foreach ($items as $item) {
            $host = mb_strtolower(trim((string) $item));
            $host = (string) preg_replace('~^[a-z]+://~', '', $host);
            $host = (string) preg_replace('~^www\.|[/:?#].*$~', '', $host);
            if ($host !== '' && str_contains($host, '.')) {
                $clean[] = $host;
            }
        }

        return array_slice(array_values(array_unique($clean)), 0, 500);
    }

    /** @param  list<string>  $domains */
    private static function matches(string $host, array $domains): bool
    {
        foreach ($domains as $domain) {
            if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                return true;
            }
        }

        return false;
    }
}
