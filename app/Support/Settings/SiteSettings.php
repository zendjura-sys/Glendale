<?php

namespace App\Support\Settings;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SiteSettings
{
    private const CACHE_KEY = 'site.settings';

    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'site_name' => 'GameCon',
        'tagline' => 'Соціальна мережа нового покоління',
        'registration_open' => true,
        'email_verification' => false,
        'max_post_length' => 5000,
        'max_attachments' => 10,
        'max_upload_mb' => 20,
        'max_message_file_mb' => 50,
        'maintenance_message' => null,
    ];

    /** @var array<string, mixed>|null */
    private ?array $values = null;

    public function get(string $key, mixed $default = null): mixed
    {
        $values = $this->all();

        return array_key_exists($key, $values) ? $values[$key] : $default;
    }

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return $this->values ??= array_replace(self::DEFAULTS, Cache::rememberForever(
            self::CACHE_KEY,
            fn () => DB::table('site_settings')->pluck('value', 'key')
                ->map(fn ($value) => json_decode((string) $value, true))
                ->all(),
        ));
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function put(array $values): void
    {
        $now = now();

        foreach ($values as $key => $value) {
            DB::table('site_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => json_encode($value), 'updated_at' => $now, 'created_at' => $now],
            );
        }

        $this->values = null;
        Cache::forget(self::CACHE_KEY);
    }
}
