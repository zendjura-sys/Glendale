<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSettings;

final class SyncLogRedactor
{
    public static function clean(mixed $value): mixed
    {
        if (is_array($value)) {
            $result = [];
            foreach ($value as $key => $item) {
                $result[$key] = preg_match('/token|secret|password|authorization|api.?key/i', (string) $key)
                    ? '[REDACTED]' : self::clean($item);
            }

            return $result;
        }
        if (! is_string($value)) {
            return $value;
        }

        $token = CinemaSettings::kodikToken();
        if ($token) {
            $value = str_replace([$token, rawurlencode($token)], '[REDACTED]', $value);
        }

        return preg_replace_callback('~https?://[^\s<>"\']+~i', function (array $match): string {
            $parts = parse_url($match[0]);
            if (! is_array($parts) || ! isset($parts['host'])) {
                return '[REDACTED URL]';
            }

            return ($parts['scheme'] ?? 'https').'://'.$parts['host']
                .(isset($parts['port']) ? ':'.$parts['port'] : '').($parts['path'] ?? '');
        }, $value);
    }
}
