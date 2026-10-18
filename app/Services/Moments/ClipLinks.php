<?php

namespace App\Services\Moments;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Розпізнає посилання на кліп і бере назву й обкладинку. Звертаємося лише до
 * самих YouTube, Twitch і Medal — довільних адрес сайт не відкриває.
 */
class ClipLinks
{
    /**
     * @return array{provider: string, external_id: string, url: string, embed: string|null, title: string|null, thumbnail: string|null}|null
     */
    public function parse(string $url): ?array
    {
        $url = trim($url);
        if (preg_match('~^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/)|youtu\.be/)([\w-]{11})~i', $url, $m) === 1) {
            $id = $m[1];

            return [
                'provider' => 'youtube',
                'external_id' => $id,
                'url' => 'https://www.youtube.com/watch?v='.$id,
                'embed' => 'https://www.youtube-nocookie.com/embed/'.$id.'?autoplay=1&rel=0',
                ...$this->youtubeMeta($id),
            ];
        }
        if (preg_match('~^https?://(?:clips\.twitch\.tv/|(?:www\.|m\.)?twitch\.tv/[\w]+/clip/)([\w-]{6,100})~i', $url, $m) === 1) {
            $slug = $m[1];
            $page = 'https://clips.twitch.tv/'.$slug;

            $meta = $this->pageMeta($page);

            return ['provider' => 'twitch', 'external_id' => 'clip:'.$slug, 'url' => $page, 'embed' => 'twitch-clip:'.$slug, 'title' => $meta['title'], 'thumbnail' => $meta['thumbnail']];
        }
        if (preg_match('~^https?://(?:www\.|m\.)?twitch\.tv/videos/(\d{5,20})~i', $url, $m) === 1) {
            $page = 'https://www.twitch.tv/videos/'.$m[1];

            $meta = $this->pageMeta($page);

            return ['provider' => 'twitch', 'external_id' => 'video:'.$m[1], 'url' => $page, 'embed' => 'twitch-video:'.$m[1], 'title' => $meta['title'], 'thumbnail' => $meta['thumbnail']];
        }
        if (preg_match('~^https?://(?:www\.)?medal\.tv/(?:games/[\w-]+/)?clips?/([\w-]{4,60})~i', $url, $m) === 1) {
            $page = strtok($url, '?#') ?: $url;
            $meta = $this->pageMeta($page);
            $embed = $meta['player'] !== null && str_starts_with($meta['player'], 'https://medal.tv/') ? $meta['player'] : null;

            return ['provider' => 'medal', 'external_id' => $m[1], 'url' => $page, 'embed' => $embed, 'title' => $meta['title'], 'thumbnail' => $meta['thumbnail']];
        }

        return null;
    }

    /**
     * Адреса вбудованого плеєра. Twitch вимагає домен сайту в parent — підставляємо під час показу.
     */
    public static function player(?string $embed, string $host): ?string
    {
        if ($embed === null) {
            return null;
        }
        if (str_starts_with($embed, 'twitch-clip:')) {
            return 'https://clips.twitch.tv/embed?'.http_build_query(['clip' => substr($embed, 12), 'parent' => $host, 'autoplay' => 'true']);
        }
        if (str_starts_with($embed, 'twitch-video:')) {
            return 'https://player.twitch.tv/?'.http_build_query(['video' => substr($embed, 13), 'parent' => $host, 'autoplay' => 'true']);
        }

        return $embed;
    }

    /**
     * @return array{title: string|null, thumbnail: string}
     */
    private function youtubeMeta(string $id): array
    {
        $title = null;
        try {
            $data = Http::timeout(5)->acceptJson()->get('https://www.youtube.com/oembed', ['url' => 'https://www.youtube.com/watch?v='.$id, 'format' => 'json'])->json();
            $title = is_array($data) && is_string($data['title'] ?? null) ? $data['title'] : null;
        } catch (Throwable) {
            // Без назви — людина впише свою.
        }

        return ['title' => $title, 'thumbnail' => 'https://i.ytimg.com/vi/'.$id.'/hqdefault.jpg'];
    }

    /**
     * og:title, og:image і twitter:player сторінки кліпу.
     *
     * @return array{title: string|null, thumbnail: string|null, player: string|null}
     */
    private function pageMeta(string $url): array
    {
        $meta = ['title' => null, 'thumbnail' => null, 'player' => null];
        try {
            $html = Http::timeout(6)->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; GameConBot/1.0)'])->get($url)->body();
        } catch (Throwable) {
            return $meta;
        }
        $html = Str::limit($html, 300000, '');
        foreach (['title' => ['og:title', 'twitter:title'], 'thumbnail' => ['og:image', 'twitter:image'], 'player' => ['twitter:player', 'og:video:secure_url']] as $key => $names) {
            foreach ($names as $name) {
                $pattern = '~<meta[^>]+(?:property|name)=["\']'.preg_quote($name, '~').'["\'][^>]*content=["\']([^"\']+)["\']~i';
                $reverse = '~<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']'.preg_quote($name, '~').'["\']~i';
                if (preg_match($pattern, $html, $m) === 1 || preg_match($reverse, $html, $m) === 1) {
                    $meta[$key] = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
                    break;
                }
            }
        }
        if ($meta['thumbnail'] !== null && ! str_starts_with($meta['thumbnail'], 'https://')) {
            $meta['thumbnail'] = null;
        }

        return $meta;
    }
}
