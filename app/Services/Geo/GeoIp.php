<?php

namespace App\Services\Geo;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use MaxMind\Db\Reader;
use PharData;
use Throwable;

/**
 * Країна за IP: локальна база (DB-IP Lite — без ключа, або MaxMind GeoLite2 — з ліцензійним ключем).
 * База оновлюється щотижня командою geoip:update.
 */
class GeoIp
{
    private ?Reader $reader = null;

    /** @var array<string, string|null> */
    private array $memo = [];

    public function __construct(private readonly SiteSettings $settings) {}

    public function path(): string
    {
        return storage_path('app/geoip/country.mmdb');
    }

    public function available(): bool
    {
        return is_file($this->path());
    }

    /**
     * @return array{available: bool, source: string|null, updated_at: string|null, size: int}
     */
    public function status(): array
    {
        return [
            'available' => $this->available(),
            'source' => is_string($s = $this->settings->get('geo_db_source')) ? $s : null,
            'updated_at' => is_string($u = $this->settings->get('geo_db_updated_at')) ? $u : null,
            'size' => $this->available() ? (int) filesize($this->path()) : 0,
        ];
    }

    /** ISO-код країни («UA», «DE») або null — локальна адреса чи бази немає. */
    public function country(string $ip): ?string
    {
        if (array_key_exists($ip, $this->memo)) {
            return $this->memo[$ip];
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false || ! $this->available()) {
            return $this->memo[$ip] = null;
        }

        return $this->memo[$ip] = Cache::remember('geo.ip.'.sha1($ip), now()->addHours(6), function () use ($ip) {
            try {
                $this->reader ??= new Reader($this->path());
                $row = $this->reader->get($ip);
            } catch (Throwable) {
                return null;
            }
            $code = is_array($row) && is_array($row['country'] ?? null) ? ($row['country']['iso_code'] ?? null) : null;

            return is_string($code) && preg_match('/^[A-Z]{2}$/', $code) === 1 ? $code : null;
        });
    }

    /** Завантажити свіжу базу. З ключем MaxMind — GeoLite2, інакше — DB-IP Lite (CC BY 4.0). */
    public function update(): bool
    {
        $account = $this->settings->get('maxmind_account_id');
        $key = $this->settings->secret('maxmind_license_key');
        $data = is_string($key) && $key !== '' && is_string($account) && $account !== ''
            ? $this->fromMaxMind($account, $key)
            : $this->fromDbIp();
        if ($data === null) {
            return false;
        }
        [$bytes, $source] = $data;

        File::ensureDirectoryExists(dirname($this->path()));
        $tmp = $this->path().'.new';
        file_put_contents($tmp, $bytes);
        try {
            $reader = new Reader($tmp);
            $reader->get('8.8.8.8');
            $reader->close();
        } catch (Throwable) {
            @unlink($tmp);

            return false;
        }
        rename($tmp, $this->path());
        $this->reader = null;
        $this->memo = [];
        $this->settings->put(['geo_db_source' => $source, 'geo_db_updated_at' => now()->toIso8601String()]);

        return true;
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function fromDbIp(): ?array
    {
        // Файл місяця з’являється на початку місяця — пробуємо поточний і попередній.
        foreach ([now(), now()->subMonthNoOverflow()] as $month) {
            $url = str_replace('{month}', $month->format('Y-m'), (string) config('services.geoip.dbip_url', 'https://download.db-ip.com/free/dbip-country-lite-{month}.mmdb.gz'));
            try {
                $response = Http::timeout(120)->get($url);
            } catch (ConnectionException) {
                continue;
            }
            $bytes = $response->successful() ? @gzdecode($response->body()) : false;
            if (is_string($bytes) && $bytes !== '') {
                return [$bytes, 'dbip'];
            }
        }

        return null;
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function fromMaxMind(string $account, string $key): ?array
    {
        try {
            $response = Http::timeout(120)->withBasicAuth($account, $key)
                ->get((string) config('services.geoip.maxmind_url', 'https://download.maxmind.com/geoip/databases/GeoLite2-Country/download?suffix=tar.gz'));
        } catch (ConnectionException) {
            return null;
        }
        if (! $response->successful()) {
            return null;
        }
        $dir = storage_path('app/geoip/tmp-'.bin2hex(random_bytes(4)));
        File::ensureDirectoryExists($dir);
        try {
            file_put_contents($dir.'/db.tar.gz', $response->body());
            (new PharData($dir.'/db.tar.gz'))->extractTo($dir, null, true);
            foreach (File::allFiles($dir) as $file) {
                if (str_ends_with($file->getFilename(), '.mmdb')) {
                    return [(string) file_get_contents($file->getPathname()), 'maxmind'];
                }
            }
        } catch (Throwable) {
            return null;
        } finally {
            File::deleteDirectory($dir);
        }

        return null;
    }
}
