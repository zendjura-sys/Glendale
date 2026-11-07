<?php

namespace App\Services\Music;

/**
 * Посилання «поділитися» з хмарних сховищ → пряма адреса файлу (офіційні публічні способи самих
 * сервісів): Google Диск, Dropbox, OneDrive/SharePoint. Сторінки сервісів потокового відтворення
 * не завантажуємо — лише файли, які людина сама виклала й відкрила «усім, хто має посилання».
 */
class ShareLinks
{
    public const PRIVATE = 'Файл закритий — відкрийте доступ «усім, хто має посилання».';

    public const NO_DIRECT = 'TeraBox і MEGA не віддають файли за прямим посиланням — завантажте файл на Google Диск, Dropbox чи OneDrive або вставте пряме посилання на .mp3.';

    public const STREAMING = 'З цього сервісу завантажити не можна — потрібне пряме посилання на аудіофайл.';

    public const FOLDER = 'Це посилання на папку — потрібне посилання на окремий файл.';

    /** Сховища, що віддають файл лише через свій застосунок чи шифрований вебклієнт. */
    private const NO_DIRECT_HOSTS = ['terabox.com', 'teraboxapp.com', 'terabox.app', '1024terabox.com', '1024tera.com', 'freeterabox.com',
        'teraboxlink.com', 'terasharelink.com', '4funbox.com', 'mirrobox.com', 'nephobox.com', 'momerybox.com', 'tibibox.com',
        'mega.nz', 'mega.io', 'mega.co.nz'];

    /** Сервіси потокового відтворення: їхні сторінки — не файли. */
    private const STREAMING_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'open.spotify.com', 'spotify.link', 'soundcloud.com',
        'snd.sc', 'music.apple.com', 'deezer.com', 'deezer.page.link', 'tiktok.com', 'instagram.com'];

    /** Сторінки входу: переадресація сюди означає закритий файл. */
    private const LOGIN_HOSTS = ['accounts.google.com', 'login.live.com', 'login.microsoftonline.com'];

    /** Хости, де HTML замість файлу означає закритий доступ (або вимогу увійти). */
    private const CLOUD_HOSTS = ['google.com', 'googleusercontent.com', 'dropbox.com', 'dropboxusercontent.com', '1drv.ms', 'onedrive.live.com',
        'onedrive.com', '1drv.com', 'sharepoint.com', 'live.com'];

    /** Відмова ще до завантаження (повідомлення) або null. */
    public function rejection(string $url): ?string
    {
        $host = self::host($url);
        if (self::matches($host, self::NO_DIRECT_HOSTS)) {
            return self::NO_DIRECT;
        }
        if (self::matches($host, self::STREAMING_HOSTS)) {
            return self::STREAMING;
        }
        if ((self::matches($host, ['drive.google.com', 'docs.google.com']) && str_contains((string) parse_url($url, PHP_URL_PATH), '/folders/'))
            || (self::matches($host, ['dropbox.com']) && str_starts_with((string) parse_url($url, PHP_URL_PATH), '/scl/fo/'))) {
            return self::FOLDER;
        }

        return null;
    }

    /** Пряма адреса файлу для посилання «поділитися»; інші посилання — без змін. */
    public function resolve(string $url): string
    {
        $host = self::host($url);

        if (self::matches($host, ['drive.google.com', 'docs.google.com']) && ($id = $this->driveId($url)) !== null) {
            return 'https://drive.usercontent.google.com/download?'.http_build_query(['id' => $id, 'export' => 'download']);
        }
        if (self::matches($host, ['dropbox.com'])) {
            return $this->withQuery($url, ['dl' => '1']);
        }
        if (in_array($host, ['1drv.ms', 'onedrive.live.com'], true)) {
            return 'https://api.onedrive.com/v1.0/shares/u!'.rtrim(strtr(base64_encode($url), '+/', '-_'), '=').'/root/content';
        }
        if (self::matches($host, ['sharepoint.com'])) {
            return $this->withQuery($url, ['download' => '1']);
        }

        return $url;
    }

    /**
     * Сторінка Google Диска «Не вдалося перевірити файл на віруси» (великі файли): адреса з полями її
     * форми (id, export, confirm, uuid) — так само, як натискання «Усе одно завантажити». Інакше null.
     */
    public function driveConfirmUrl(string $html, string $url): ?string
    {
        if (! self::matches(self::host($url), ['google.com']) || ! preg_match('/<form[^>]*id="download-form"[^>]*>(.*?)<\/form>/is', $html, $form)) {
            return null;
        }
        $action = preg_match('/action="([^"]+)"/i', $form[0], $m) ? html_entity_decode($m[1]) : 'https://drive.usercontent.google.com/download';
        if (! str_starts_with($action, 'https://') || ! self::matches(self::host($action), ['google.com'])) {
            return null;
        }

        $fields = [];
        preg_match_all('/<input[^>]+>/i', $form[1], $inputs);
        foreach ($inputs[0] as $input) {
            if (preg_match('/name="([^"]+)"/i', $input, $name) && preg_match('/value="([^"]*)"/i', $input, $value)
                && in_array($name[1], ['id', 'export', 'confirm', 'uuid', 'at', 'authuser', 'resourcekey'], true)) {
                $fields[$name[1]] = html_entity_decode($value[1]);
            }
        }

        return isset($fields['id']) ? $action.'?'.http_build_query($fields) : null;
    }

    /** Сторінка входу (закритий файл). */
    public function isLogin(string $url): bool
    {
        return in_array(self::host($url), self::LOGIN_HOSTS, true);
    }

    /** Хмарне сховище: HTML замість файлу там означає закритий доступ. */
    public function isCloud(string $url): bool
    {
        return self::matches(self::host($url), self::CLOUD_HOSTS);
    }

    /** Google Диск тимчасово обмежив завантаження (забагато переглядів). */
    public function isDriveQuota(string $html): bool
    {
        return (bool) preg_match('/quota|too many users/i', $html);
    }

    /** Хост без «www.» — для картки й перевірок. */
    public static function host(string $url): string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return str_starts_with($host, 'www.') ? substr($host, 4) : $host;
    }

    /**
     * @param  list<string>  $domains
     */
    private static function matches(string $host, array $domains): bool
    {
        foreach ($domains as $domain) {
            if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                return true;
            }
        }

        return false;
    }

    private function driveId(string $url): ?string
    {
        $path = (string) parse_url($url, PHP_URL_PATH);
        if (preg_match('#/file/d/([A-Za-z0-9_-]{10,})#', $path, $m)) {
            return $m[1];
        }
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $id = $query['id'] ?? null;

        return is_string($id) && preg_match('/^[A-Za-z0-9_-]{10,}$/', $id) ? $id : null;
    }

    /**
     * @param  array<string, string>  $set
     */
    private function withQuery(string $url, array $set): string
    {
        $parts = parse_url($url);
        parse_str($parts['query'] ?? '', $query);
        $query = [...$query, ...$set];

        return ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '').(isset($parts['port']) ? ':'.$parts['port'] : '')
            .($parts['path'] ?? '/').'?'.http_build_query($query);
    }
}
