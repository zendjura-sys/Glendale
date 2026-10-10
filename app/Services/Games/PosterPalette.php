<?php

namespace App\Services\Games;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Кольори сторінки гри з її постера: темна основа для фону й яскравий акцент для кнопок і посилань.
 * Ключ — адреса постера: новий постер одразу дає нову палітру; той самий файл перераховується раз на тиждень.
 * Якщо палітри ще немає, сторінка приходить без неї, а кольори довантажуються відкладеним пропом.
 */
class PosterPalette
{
    public const SIZE = 64;

    /** Цілі Palette API: [мін, ціль, макс] для насиченості та яскравості. */
    private const TARGETS = [
        'vibrant' => ['s' => [0.35, 1.0, 1.0], 'l' => [0.3, 0.5, 0.7]],
        'dark_vibrant' => ['s' => [0.35, 1.0, 1.0], 'l' => [0.0, 0.26, 0.45]],
        'light_vibrant' => ['s' => [0.35, 1.0, 1.0], 'l' => [0.55, 0.74, 1.0]],
        'muted' => ['s' => [0.0, 0.3, 0.4], 'l' => [0.3, 0.5, 0.7]],
        'dark_muted' => ['s' => [0.0, 0.3, 0.4], 'l' => [0.0, 0.26, 0.45]],
        'light_muted' => ['s' => [0.0, 0.3, 0.4], 'l' => [0.55, 0.74, 1.0]],
    ];

    /**
     * Готова палітра з кешу; false — постер уже пробували й не вийшло, null — ще не рахували.
     *
     * @return array{base: string, accent: string, soft: string, swatches: array<string, string>}|false|null
     */
    public function cached(?string $url): array|false|null
    {
        if ($url === null || $url === '') {
            return false;
        }
        $cached = Cache::get(self::key($url));
        if (is_array($cached)) {
            /** @var array{base: string, accent: string, soft: string, swatches: array<string, string>} $cached */
            return $cached;
        }

        return $cached === false ? false : null;
    }

    /**
     * Рахує й запам’ятовує (для відкладеного пропа сторінки — сторінка вже показана).
     *
     * @return array{base: string, accent: string, soft: string, swatches: array<string, string>}|null
     */
    public function resolve(string $url): ?array
    {
        $cached = $this->cached($url);
        if ($cached !== null) {
            return $cached ?: null;
        }
        $palette = $this->compute(self::small($url));
        Cache::put(self::key($url), $palette ?? false, $palette ? now()->addDays(7) : now()->addHours(6));

        return $palette;
    }

    /** Ключ — адреса постера: інший постер — інша палітра. */
    private static function key(string $url): string
    {
        return 'poster.palette.'.md5($url);
    }

    /** Для кольорів вистачає маленької копії: IGDB віддає її за іншим розміром у шляху. */
    public static function small(string $url): string
    {
        return (string) preg_replace('#/t_(1080p|720p|screenshot_huge|cover_big)/#', '/t_screenshot_med/', $url);
    }

    /**
     * @return array{base: string, accent: string, soft: string, swatches: array<string, string>}|null
     */
    public function compute(string $url): ?array
    {
        try {
            $response = Http::timeout(6)->get($url);
            if (! $response->successful()) {
                return null;
            }

            return $this->fromImage($response->body());
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Свотчі за правилами Android Palette API: частота кольорів + цільові яскравість і насиченість.
     *
     * @return array{base: string, accent: string, soft: string, swatches: array<string, string>}|null
     */
    public function fromImage(string $bytes): ?array
    {
        $source = @imagecreatefromstring($bytes);
        if ($source === false) {
            return null;
        }
        $small = imagecreatetruecolor(self::SIZE, self::SIZE);
        imagecopyresampled($small, $source, 0, 0, 0, 0, self::SIZE, self::SIZE, imagesx($source), imagesy($source));

        // Квантування 5 біт на канал, як у Palette: схожі кольори зливаються в один.
        $bins = [];
        for ($x = 0; $x < self::SIZE; $x++) {
            for ($y = 0; $y < self::SIZE; $y++) {
                $rgb = imagecolorat($small, $x, $y);
                $key = ((($rgb >> 19) & 0x1F) << 10) | ((($rgb >> 11) & 0x1F) << 5) | (($rgb >> 3) & 0x1F);
                $bins[$key] = ($bins[$key] ?? 0) + 1;
            }
        }
        $max = max($bins);
        $colors = [];
        foreach ($bins as $key => $count) {
            $r = (($key >> 10) & 0x1F) << 3 | 4;
            $g = (($key >> 5) & 0x1F) << 3 | 4;
            $b = ($key & 0x1F) << 3 | 4;
            [$h, $s, $l] = self::toHsl($r, $g, $b);
            $colors[] = ['h' => $h, 's' => $s, 'l' => $l, 'n' => $count / $max];
        }

        $swatches = [];
        $used = [];
        foreach (self::TARGETS as $name => $target) {
            $best = null;
            $bestScore = -1.0;
            foreach ($colors as $i => $c) {
                if (isset($used[$i]) || $c['s'] < $target['s'][0] || $c['s'] > $target['s'][2] || $c['l'] < $target['l'][0] || $c['l'] > $target['l'][2]) {
                    continue;
                }
                $score = 0.24 * (1 - abs($c['s'] - $target['s'][1]))
                    + 0.52 * (1 - abs($c['l'] - $target['l'][1]))
                    + 0.24 * $c['n'];
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best = $i;
                }
            }
            if ($best !== null) {
                $used[$best] = true;
                $swatches[$name] = $colors[$best];
            }
        }

        $accent = $swatches['vibrant'] ?? $swatches['light_vibrant'] ?? $swatches['dark_vibrant'] ?? $swatches['muted'] ?? null;
        $base = $swatches['dark_muted'] ?? $swatches['dark_vibrant'] ?? $accent;
        if ($accent === null || $base === null) {
            // Чорно-білий постер: спокійний індиго сайту замість сірого.
            $accent = $base = ['h' => 0.65, 's' => 0.45, 'l' => 0.5];
        }

        return [
            'base' => self::hex($base['h'], min(0.6, $base['s']), 0.14),
            'accent' => self::hex($accent['h'], min(0.85, max(0.5, $accent['s'])), 0.6),
            'soft' => self::hex($accent['h'], min(0.9, max(0.5, $accent['s'])), 0.78),
            'swatches' => array_map(fn (array $c) => self::hex($c['h'], $c['s'], $c['l']), $swatches),
        ];
    }

    /**
     * @return array{0: float, 1: float, 2: float}
     */
    private static function toHsl(int $r, int $g, int $b): array
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;
        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;
        if ($max === $min) {
            return [0.0, 0.0, $l];
        }
        $d = $max - $min;
        $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
        $h = match ($max) {
            $r => ($g - $b) / $d + ($g < $b ? 6 : 0),
            $g => ($b - $r) / $d + 2,
            default => ($r - $g) / $d + 4,
        };

        return [$h / 6, $s, $l];
    }

    private static function hex(float $h, float $s, float $l): string
    {
        $channel = function (float $t) use ($h, $s, $l): int {
            $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
            $p = 2 * $l - $q;
            $t = $h + $t;
            $t += $t < 0 ? 1 : 0;
            $t -= $t > 1 ? 1 : 0;
            $v = match (true) {
                $t < 1 / 6 => $p + ($q - $p) * 6 * $t,
                $t < 1 / 2 => $q,
                $t < 2 / 3 => $p + ($q - $p) * (2 / 3 - $t) * 6,
                default => $p,
            };

            return (int) round($v * 255);
        };

        return sprintf('#%02x%02x%02x', $channel(1 / 3), $channel(0.0), $channel(-1 / 3));
    }
}
