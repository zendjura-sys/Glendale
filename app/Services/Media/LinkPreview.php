<?php

namespace App\Services\Media;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Картка звичайного посилання: заголовок і адреса картинки.
 * Файл за посиланням не зберігається.
 */
class LinkPreview
{
    /**
     * @return array{url: string, title: string, thumbnail: string|null, author: null, site: string}|null
     */
    public function fromText(?string $text): ?array
    {
        if ($text === null || preg_match('~https?://[^\s<>"\']+~i', $text, $match) !== 1) {
            return null;
        }

        $url = rtrim($match[0], '.,);]');
        $host = $this->host($url);
        if ($host === null || $this->isVideoHost($host) || ! $this->allowed($url)) {
            return null;
        }

        try {
            $response = $this->fetch($url);
        } catch (\Throwable) {
            $response = null;
        }
        if (! $response instanceof Response) {
            return null;
        }

        $site = $this->site($host);
        $type = strtolower($response->header('Content-Type') ?? '');
        if (! str_contains($type, 'html') && ! str_contains($type, 'xml')) {
            return ['url' => $url, 'title' => $site, 'thumbnail' => null, 'author' => null, 'site' => $site];
        }

        $html = substr($response->body(), 0, 120000);
        $title = $this->meta($html, 'og:title') ?? $this->titleTag($html) ?? $site;
        $image = $this->meta($html, 'og:image');
        $thumbnail = $image ? $this->absolute($url, html_entity_decode($image, ENT_QUOTES | ENT_HTML5)) : null;
        if ($thumbnail !== null && ! $this->allowed($thumbnail)) {
            $thumbnail = null;
        }

        return [
            'url' => $url,
            'title' => mb_substr(trim(html_entity_decode($title, ENT_QUOTES | ENT_HTML5)), 0, 200),
            'thumbnail' => $thumbnail,
            'author' => null,
            'site' => $site,
        ];
    }

    private function fetch(string $url): ?Response
    {
        $current = $url;
        for ($hop = 0; $hop < 3; $hop++) {
            if (! $this->allowed($current)) {
                return null;
            }
            $response = Http::timeout(4)
                ->withOptions(['allow_redirects' => false])
                ->withHeaders([
                    'User-Agent' => 'GameConLinkPreview/1.0',
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->get($current);

            if (! $response->redirect()) {
                return $response;
            }
            $location = $response->header('Location');
            if (! is_string($location) || $location === '') {
                return null;
            }
            $next = $this->absolute($current, $location);
            if ($next === null) {
                return null;
            }
            $current = $next;
        }

        return null;
    }

    private function allowed(string $url): bool
    {
        $parts = parse_url($url);
        $scheme = $parts['scheme'] ?? '';
        $host = $parts['host'] ?? '';
        if (! in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user'])) {
            return false;
        }
        $host = strtolower($host);
        if ($host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            return false;
        }
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return $this->publicIp($host);
        }
        $ips = gethostbynamel($host) ?: [];
        if ($ips === []) {
            return false;
        }
        foreach ($ips as $ip) {
            if (! $this->publicIp($ip)) {
                return false;
            }
        }

        return true;
    }

    private function publicIp(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    private function host(string $url): ?string
    {
        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) && $host !== '' ? strtolower($host) : null;
    }

    private function site(string $host): string
    {
        return str_starts_with($host, 'www.') ? substr($host, 4) : $host;
    }

    private function isVideoHost(string $host): bool
    {
        return $host === 'youtu.be' || str_ends_with($host, 'youtube.com') || str_ends_with($host, 'youtube-nocookie.com');
    }

    private function meta(string $html, string $name): ?string
    {
        if (preg_match_all('~<meta\b[^>]*>~i', $html, $tags) < 1) {
            return null;
        }
        foreach ($tags[0] as $tag) {
            if (! preg_match('~(?:property|name)=["\']'.preg_quote($name, '~').'["\']~i', $tag)) {
                continue;
            }
            if (preg_match('~content=["\']([^"\']*)["\']~i', $tag, $content) === 1 && $content[1] !== '') {
                return html_entity_decode($content[1], ENT_QUOTES | ENT_HTML5);
            }
        }

        return null;
    }

    private function titleTag(string $html): ?string
    {
        if (preg_match('~<title[^>]*>([^<]+)</title>~i', $html, $match) !== 1) {
            return null;
        }
        $title = trim(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5));

        return $title === '' ? null : $title;
    }

    private function absolute(string $base, string $ref): ?string
    {
        $ref = trim($ref);
        if (str_starts_with($ref, 'https://') || str_starts_with($ref, 'http://')) {
            return $ref;
        }
        $parts = parse_url($base);
        $origin = ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '');
        if (str_starts_with($ref, '//')) {
            return ($parts['scheme'] ?? 'https').':'.$ref;
        }
        if (str_starts_with($ref, '/')) {
            return $origin.$ref;
        }

        return null;
    }
}
