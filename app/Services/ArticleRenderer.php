<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Markdown статті → безпечний HTML: сирий HTML вимкнено, небезпечні посилання прибрано,
 * картинки — лише завантажені на GameCon; заголовкам H2/H3 — якорі для змісту.
 */
class ArticleRenderer
{
    /**
     * @return array{html: string, toc: list<array{level: int, text: string, id: string}>}
     */
    public function render(string $markdown): array
    {
        $html = Str::markdown($markdown, [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 20,
        ]);

        // Картинки — лише з нашого сховища (без стеження й підміни з чужих сайтів).
        $storage = rtrim(Storage::disk('public')->url(''), '/');
        $html = (string) preg_replace_callback('#<img\s[^>]*src="([^"]*)"[^>]*>#i', function (array $m) use ($storage) {
            if (! str_starts_with($m[1], $storage.'/') && ! str_starts_with($m[1], '/storage/')) {
                return '';
            }

            return str_replace('<img ', '<img loading="lazy" decoding="async" ', $m[0]);
        }, $html);

        // Зовнішні посилання — у новій вкладці й без передачі ваги.
        $html = (string) preg_replace('#<a href="(https?://[^"]+)"#i', '<a href="$1" target="_blank" rel="noopener noreferrer nofollow"', $html);

        $toc = [];
        $used = [];
        $html = (string) preg_replace_callback('#<h([23])>(.*?)</h\1>#s', function (array $m) use (&$toc, &$used) {
            $text = trim(html_entity_decode(strip_tags($m[2]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $base = Str::slug($text) ?: 'section';
            $id = $base;
            for ($i = 2; isset($used[$id]); $i++) {
                $id = $base.'-'.$i;
            }
            $used[$id] = true;
            $toc[] = ['level' => (int) $m[1], 'text' => $text, 'id' => $id];

            return '<h'.$m[1].' id="'.$id.'">'.$m[2].'</h'.$m[1].'>';
        }, $html);

        return ['html' => $html, 'toc' => $toc];
    }

    /** Хвилин читання: ~200 слів за хвилину. */
    public static function minutes(string $markdown): int
    {
        $words = str_word_count(strip_tags($markdown), 0, 'АаБбВвГгҐґДдЕеЄєЖжЗзИиІіЇїЙйКкЛлМмНнОоПпРрСсТтУуФфХхЦцЧчШшЩщЬьЮюЯя\'’');

        return max(1, (int) round($words / 200));
    }
}
