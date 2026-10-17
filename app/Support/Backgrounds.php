<?php

namespace App\Support;

use App\Models\User;

/**
 * Фон сайту (Налаштування → Вигляд): жива сцена за інтерфейсом, вимикач руху й — для GameCon+ —
 * власне відео з YouTube. Зберігаємо лише ID відео, не посилання.
 */
class Backgrounds
{
    public const DEFAULT = 'dune';

    /** Сцени в порядку показу в налаштуваннях; `none` — однотонне тло без сцени. */
    public const PRESETS = ['dune', 'aurora', 'night', 'ocean', 'mesh', 'none'];

    /**
     * ID відео з посилання YouTube (watch, youtu.be, shorts, embed, live) або null.
     */
    public static function youtubeId(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }
        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $url) === 1) {
            return $url;
        }
        $parts = parse_url(str_contains($url, '://') ? $url : 'https://'.$url);
        $host = strtolower(preg_replace('/^(www\.|m\.|music\.)/', '', $parts['host'] ?? ''));
        $path = $parts['path'] ?? '';
        $id = null;
        if ($host === 'youtu.be') {
            $id = explode('/', trim($path, '/'))[0];
        } elseif (in_array($host, ['youtube.com', 'youtube-nocookie.com'], true)) {
            parse_str($parts['query'] ?? '', $query);
            $id = is_string($query['v'] ?? null)
                ? $query['v']
                : (preg_match('#^/(?:shorts|embed|live|v)/([^/?]+)#', $path, $m) === 1 ? $m[1] : null);
        }

        return is_string($id) && preg_match('/^[A-Za-z0-9_-]{11}$/', $id) === 1 ? $id : null;
    }

    /**
     * @return array{preset: string, motion: bool, video: string|null}
     */
    public static function for(User $user): array
    {
        $preset = (string) $user->pref('background', self::DEFAULT);

        return [
            'preset' => in_array($preset, self::PRESETS, true) ? $preset : self::DEFAULT,
            'motion' => (bool) $user->pref('background_motion', true),
            // Відео — привілей GameCon+: після закінчення підписки просто не показується (налаштування лишається).
            'video' => $user->isPlus() ? self::youtubeId($user->pref('background_video')) : null,
        ];
    }
}
