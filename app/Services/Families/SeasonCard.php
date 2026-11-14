<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilySeason;
use GdImage;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Картинка «Підсумки сезону» для Discord і Telegram (1200×675, GD): тег і назва сім’ї, номер і дати сезону,
 * п’єдестал трійки лідерів і решта десятки. Малюється раз і лежить на диску public (families/seasons/…).
 */
class SeasonCard
{
    public const WIDTH = 1200;

    public const HEIGHT = 675;

    /** Шлях до PNG на диску public (малює, якщо ще немає або змінилась назва сім’ї). */
    public function path(Family $family, FamilySeason $season): string
    {
        $version = substr(md5($family->tag.'|'.$family->name.'|'.json_encode($season->top)), 0, 8);
        $path = "families/seasons/{$family->id}-{$season->number}-{$version}.png";
        $disk = Storage::disk('public');
        if (! $disk->exists($path)) {
            $disk->put($path, $this->render($family, $season));
        }

        return $disk->path($path);
    }

    /**
     * Надіслати картинку в Discord/Telegram сім’ї.
     *
     * @return array<string, bool>
     */
    public function share(Family $family, FamilySeason $season): array
    {
        $podium = implode("\n", array_map(
            fn (array $r) => ['🥇', '🥈', '🥉'][$r['place'] - 1].' '.$r['name'].' — '.$r['points'].' б.',
            array_slice(array_values($season->top), 0, 3),
        ));

        return app(FamilyBot::class)->sendImage(
            $family,
            $this->png($family, $season),
            "season-{$season->number}.png",
            $podium !== '' ? $podium : 'Цього сезону ніхто не набрав балів.',
            "🏆 Підсумки сезону {$season->number}",
        );
    }

    public function png(Family $family, FamilySeason $season): string
    {
        return (string) file_get_contents($this->path($family, $season));
    }

    private function render(Family $family, FamilySeason $season): string
    {
        $w = self::WIDTH;
        $h = self::HEIGHT;
        $img = imagecreatetruecolor($w, $h) ?: throw new RuntimeException('GD недоступний');
        imagealphablending($img, true);

        // Тло як у темній темі сайту: глибокий синій і м’яке золоте сяйво над п’єдесталом.
        for ($y = 0; $y < $h; $y++) {
            $t = $y / $h;
            imageline($img, 0, $y, $w, $y, $this->color($img, (int) (6 + 6 * $t), (int) (11 + 9 * $t), (int) (24 + 16 * $t)));
        }
        $this->glow($img, 330, 360, 360, [255, 196, 64]);
        $this->glow($img, 1080, 40, 420, [14, 165, 233]);

        $bold = resource_path('fonts/Montserrat-Bold.ttf');
        $medium = resource_path('fonts/Montserrat-Medium.ttf');
        $white = $this->color($img, 245, 248, 255);
        $soft = $this->color($img, 160, 176, 204);
        $sky = $this->color($img, 56, 189, 248);
        $gold = $this->color($img, 251, 191, 36);

        // Шапка: [TAG] Назва · Підсумки сезону N · дати.
        $tag = '['.$family->tag.']';
        imagettftext($img, 30, 0, 64, 92, $gold, $bold, $tag);
        $tagBox = imagettfbbox(30, 0, $bold, $tag) ?: [0, 0, 0, 0, 0, 0, 0, 0];
        imagettftext($img, 30, 0, 64 + ($tagBox[2] - $tagBox[0]) + 16, 92, $white, $bold, $this->clip($bold, 30, $family->name, 760));
        imagettftext($img, 20, 0, 64, 136, $sky, $medium, 'Підсумки сезону '.$season->number);
        $dates = ($season->started_at ? $season->started_at->timezone('Europe/Kyiv')->format('d.m.Y').' – ' : '').$season->ended_at->timezone('Europe/Kyiv')->format('d.m.Y');
        imagettftext($img, 16, 0, 64, 166, $soft, $medium, $dates);

        $top = array_values($season->top);
        if ($top === []) {
            imagettftext($img, 26, 0, 64, 360, $soft, $medium, 'Цього сезону ніхто не набрав балів.');
        }

        // П’єдестал: 2 — 1 — 3.
        $podium = [
            1 => ['x' => 250, 'h' => 200, 'rgb' => [251, 191, 36]],
            0 => ['x' => 64, 'h' => 150, 'rgb' => [203, 213, 225]],
            2 => ['x' => 436, 'h' => 116, 'rgb' => [217, 119, 6]],
        ];
        $order = [1 => 0, 0 => 1, 2 => 2]; // позиція колонки → індекс у топі
        foreach ($podium as $col => $p) {
            $row = $top[$order[$col]] ?? null;
            if ($row === null) {
                continue;
            }
            $base = $h - 112;
            $y0 = $base - $p['h'];
            $c = $this->color($img, $p['rgb'][0], $p['rgb'][1], $p['rgb'][2], 0.22);
            imagefilledrectangle($img, $p['x'], $y0, $p['x'] + 170, $base, $c);
            imagefilledrectangle($img, $p['x'], $y0, $p['x'] + 170, $y0 + 6, $this->color($img, $p['rgb'][0], $p['rgb'][1], $p['rgb'][2]));
            $place = (string) $row['place'];
            $this->center($img, 54, $bold, $place, $p['x'] + 85, $y0 + 74, $this->color($img, $p['rgb'][0], $p['rgb'][1], $p['rgb'][2]));
            $this->center($img, 18, $bold, $row['points'].' б.', $p['x'] + 85, $y0 + 112, $white);
            // Нік під блоком; статик-ID — окремим рядком, щоб не різати ім’я.
            [$nick, $static] = array_pad(preg_split('/\s+(?=\[)/u', (string) $row['name'], 2) ?: [], 2, '');
            $this->center($img, 15, $bold, $this->clip($bold, 15, $nick, 176), $p['x'] + 85, $base + 30, $white);
            if ($static !== '') {
                $this->center($img, 13, $medium, $static, $p['x'] + 85, $base + 52, $soft);
            }
        }

        // Решта десятки — праворуч.
        $x = 700;
        $y = 236;
        if (count($top) > 3) {
            imagettftext($img, 16, 0, $x, $y - 30, $soft, $medium, 'Решта десятки');
        }
        foreach (array_slice($top, 3, 7) as $row) {
            imagefilledrectangle($img, $x, $y - 4, $w - 64, $y + 44, $this->color($img, 255, 255, 255, 0.05));
            imagettftext($img, 17, 0, $x + 16, $y + 28, $soft, $bold, (string) $row['place']);
            imagettftext($img, 17, 0, $x + 60, $y + 28, $white, $medium, $this->clip($medium, 17, (string) $row['name'], 300));
            $pts = $row['points'].' б.';
            $box = imagettfbbox(17, 0, $bold, $pts) ?: [0, 0, 0, 0, 0, 0, 0, 0];
            imagettftext($img, 17, 0, $w - 80 - ($box[2] - $box[0]), $y + 28, $gold, $bold, $pts);
            $y += 56;
        }

        // Підпис.
        $brand = 'gamecon.online';
        $box = imagettfbbox(15, 0, $medium, $brand) ?: [0, 0, 0, 0, 0, 0, 0, 0];
        imagettftext($img, 15, 0, $w - 64 - ($box[2] - $box[0]), $h - 34, $soft, $medium, $brand);

        ob_start();
        imagepng($img, null, 6);

        return (string) ob_get_clean();
    }

    private function center(GdImage $img, int $size, string $font, string $text, int $cx, int $baseline, int $color): void
    {
        $box = imagettfbbox($size, 0, $font, $text) ?: [0, 0, 0, 0, 0, 0, 0, 0];
        imagettftext($img, $size, 0, $cx - intdiv($box[2] - $box[0], 2) - $box[0], $baseline, $color, $font, $text);
    }

    /** Обрізати текст під ширину з «…». */
    private function clip(string $font, int $size, string $text, int $width): string
    {
        $measure = function (string $s) use ($font, $size): int {
            $box = imagettfbbox($size, 0, $font, $s) ?: [0, 0, 0, 0, 0, 0, 0, 0];

            return $box[2] - $box[0];
        };
        if ($measure($text) <= $width) {
            return $text;
        }
        while (mb_strlen($text) > 1 && $measure($text.'…') > $width) {
            $text = mb_substr($text, 0, -1);
        }

        return rtrim($text).'…';
    }

    /** @param  array{int, int, int}  $rgb */
    private function glow(GdImage $img, int $cx, int $cy, int $radius, array $rgb): void
    {
        for ($i = 24; $i >= 1; $i--) {
            $r = (int) ($radius * $i / 24);
            imagefilledellipse($img, $cx, $cy, $r * 2, $r * 2, $this->color($img, $rgb[0], $rgb[1], $rgb[2], 0.016));
        }
    }

    private function color(GdImage $img, int $r, int $g, int $b, float $opacity = 1.0): int
    {
        $alpha = max(0, min(127, (int) round(127 * (1 - $opacity))));

        return (int) imagecolorallocatealpha($img, max(0, min(255, $r)), max(0, min(255, $g)), max(0, min(255, $b)), $alpha);
    }
}
