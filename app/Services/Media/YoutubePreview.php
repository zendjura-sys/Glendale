<?php

namespace App\Services\Media;

use Illuminate\Support\Facades\Http;

/**
 * Картка YouTube за посиланням у тексті. Дані бере oEmbed, Firebase-вхід не змінюється.
 */
class YoutubePreview
{
    /**
     * @return array{url: string, title: string, thumbnail: string|null, author: string|null, site: string}|null
     */
    public function fromText(?string $text): ?array
    {
        if ($text === null || preg_match('~(?:youtube\.com/(?:watch\?v=|shorts/)|youtu\.be/)([\w-]{6,})~', $text, $match) !== 1) {
            return null;
        }
        $url = 'https://www.youtube.com/watch?v='.$match[1];
        try {
            $data = Http::timeout(4)->acceptJson()->get('https://www.youtube.com/oembed', [
                'url' => $url,
                'format' => 'json',
            ])->json();
        } catch (\Throwable) {
            $data = null;
        }
        if (! is_array($data)) {
            return ['url' => $url, 'title' => 'YouTube', 'thumbnail' => null, 'author' => null, 'site' => 'YouTube'];
        }

        return [
            'url' => $url,
            'title' => (string) ($data['title'] ?? 'YouTube'),
            'thumbnail' => isset($data['thumbnail_url']) ? (string) $data['thumbnail_url'] : null,
            'author' => isset($data['author_name']) ? (string) $data['author_name'] : null,
            'site' => 'YouTube',
        ];
    }
}
