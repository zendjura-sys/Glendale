<?php

namespace App\Services\Seo;

use App\Models\Community;
use App\Models\User;
use GdImage;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Картки для прев’ю посилань (Open Graph, 1200×630): аватар, ім’я, підпис і знак GameCon.
 * Малюються через GD один раз і лежать на диску public (og/…); новий аватар чи ім’я — новий файл.
 */
class OgCards
{
    public const WIDTH = 1200;

    public const HEIGHT = 630;

    /** Посилання на картку профілю (версія в імені — щоб месенджери не тримали стару). */
    public function profileUrl(User $user, bool $open): string
    {
        return url('/og/u/'.$user->username.'.png').'?v='.$this->profileVersion($user, $open);
    }

    public function communityUrl(Community $community): string
    {
        return url('/og/c/'.$community->slug.'.png').'?v='.$this->communityVersion($community);
    }

    /** Шлях до готового PNG на диску public (малює, якщо ще немає). */
    public function profile(User $user, bool $open): string
    {
        $about = $open && is_string($user->about) ? trim($user->about) : '';

        return $this->cached('u/'.$user->id.'-'.$this->profileVersion($user, $open), fn () => $this->render(
            $user->name,
            '@'.$user->username,
            $about !== '' ? $about : 'Профіль у GameCon — соцмережі для геймерів',
            $user->avatar_path,
        ));
    }

    public function community(Community $community): string
    {
        $description = is_string($community->description) ? trim($community->description) : '';
        $members = $community->members_count;

        return $this->cached('c/'.$community->id.'-'.$this->communityVersion($community), fn () => $this->render(
            $community->name,
            $members.' '.$this->plural($members, ['учасник', 'учасники', 'учасників']),
            $description !== '' ? $description : 'Спільнота в GameCon — соцмережі для геймерів',
            $community->avatar_path,
        ));
    }

    private function profileVersion(User $user, bool $open): string
    {
        return substr(md5($user->name.'|'.$user->username.'|'.$user->avatar_path.'|'.($open ? $user->about : '')), 0, 10);
    }

    private function communityVersion(Community $community): string
    {
        return substr(md5($community->name.'|'.$community->avatar_path.'|'.$community->description.'|'.intdiv($community->members_count, 50)), 0, 10);
    }

    /**
     * @param  callable(): string  $draw  повертає PNG
     */
    private function cached(string $key, callable $draw): string
    {
        $path = 'og/'.$key.'.png';
        $disk = Storage::disk('public');
        if (! $disk->exists($path)) {
            $disk->put($path, $draw());
        }

        return $disk->path($path);
    }

    private function render(string $title, string $subtitle, string $text, ?string $avatarPath): string
    {
        $w = self::WIDTH;
        $h = self::HEIGHT;
        $img = imagecreatetruecolor($w, $h) ?: throw new RuntimeException('GD недоступний');
        imagealphablending($img, true);

        // Тло: глибокий синій з м’якими сапфіровими й блакитними відсвітами — як у темній темі сайту.
        for ($y = 0; $y < $h; $y++) {
            $t = $y / $h;
            $c = $this->color($img, $this->channel(8 + 6 * $t), $this->channel(14 + 8 * $t), $this->channel(30 + 14 * $t));
            imageline($img, 0, $y, $w, $y, $c);
        }
        $this->glow($img, 1010, 90, 520, [10, 132, 255]);
        $this->glow($img, 160, 640, 460, [0, 210, 255]);

        $bold = resource_path('fonts/Montserrat-Bold.ttf');
        $medium = resource_path('fonts/Montserrat-Medium.ttf');
        $white = $this->color($img, 245, 248, 255);
        $soft = $this->color($img, 186, 200, 225);
        $accent = $this->color($img, 96, 178, 255);

        $x = 112;
        $avatar = $this->avatar($avatarPath, $title, 220);
        imagecopy($img, $avatar, $x, 118, 0, 0, 220, 220);
        $textX = $x + 220 + 56;
        $width = $w - $textX - 112;

        $size = $this->fit($bold, $title, $width, 64, 40);
        $lines = $this->wrap($bold, $size, $title, $width, 2);
        $y = 180;
        foreach ($lines as $line) {
            imagettftext($img, $size, 0, $textX, $y, $white, $bold, $line);
            $y += (int) ($size * 1.3);
        }
        imagettftext($img, 30, 0, $textX, $y + 8, $accent, $medium, Str::limit($subtitle, 40));

        $about = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $y = 420;
        foreach ($this->wrap($medium, 26, $about, $w - 2 * $x, 2) as $line) {
            imagettftext($img, 26, 0, $x, $y, $soft, $medium, $line);
            $y += 40;
        }

        // Знак і адреса внизу.
        $mark = imagecreatefrompng(resource_path('og/mark.png'));
        if ($mark !== false) {
            imagecopyresampled($img, $mark, $x, $h - 56 - 84, 0, 0, 56, 56, imagesx($mark), imagesy($mark));
        }
        imagettftext($img, 26, 0, $x + 72, $h - 56 - 44, $white, $bold, 'GameCon');
        $host = (string) (parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'gamecon.online');
        $box = imagettfbbox(22, 0, $medium, $host) ?: [0, 0, 0, 0, 0, 0, 0, 0];
        imagettftext($img, 22, 0, $w - 112 - ($box[2] - $box[0]), $h - 56 - 46, $soft, $medium, $host);

        ob_start();
        imagepng($img, null, 6);

        return (string) ob_get_clean();
    }

    /**
     * Кругла аватарка; без фото — перша літера на сапфіровому колі.
     *
     * @param  int<1, max>  $size
     */
    private function avatar(?string $path, string $name, int $size): GdImage
    {
        $out = imagecreatetruecolor($size, $size) ?: throw new RuntimeException('GD недоступний');
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, $this->color($out, 0, 0, 0, 0.0));
        imagealphablending($out, true);

        $source = null;
        if ($path !== null && Storage::disk('public')->exists($path)) {
            $source = @imagecreatefromstring((string) Storage::disk('public')->get($path)) ?: null;
        }
        if ($source !== null) {
            $sw = imagesx($source);
            $sh = imagesy($source);
            $side = min($sw, $sh);
            imagecopyresampled($out, $source, 0, 0, intdiv($sw - $side, 2), intdiv($sh - $side, 2), $size, $size, $side, $side);
        } else {
            imagefilledellipse($out, intdiv($size, 2), intdiv($size, 2), $size, $size, $this->color($out, 10, 132, 255));
            $letter = mb_strtoupper(mb_substr(trim($name) ?: 'G', 0, 1));
            $font = resource_path('fonts/Montserrat-Bold.ttf');
            $box = imagettfbbox(96, 0, $font, $letter) ?: [0, 0, 0, 0, 0, 0, 0, 0];
            imagettftext($out, 96, 0, intdiv($size - ($box[2] - $box[0]), 2) - $box[0], intdiv($size - ($box[1] - $box[7]), 2) - $box[7], $this->color($out, 255, 255, 255), $font, $letter);
        }

        // Маска кола зі згладженим краєм.
        imagealphablending($out, false);
        $r = $size / 2;
        for ($py = 0; $py < $size; $py++) {
            for ($px = 0; $px < $size; $px++) {
                $d = sqrt(($px + 0.5 - $r) ** 2 + ($py + 0.5 - $r) ** 2) - ($r - 0.5);
                if ($d <= 0) {
                    continue;
                }
                $rgba = imagecolorat($out, $px, $py);
                $alpha = $d >= 1 ? 127 : max(($rgba >> 24) & 0x7F, (int) round(127 * $d));
                imagesetpixel($out, $px, $py, ($alpha << 24) | ($rgba & 0xFFFFFF));
            }
        }

        return $out;
    }

    /**
     * М’яке сяйво: концентричні напівпрозорі кола.
     *
     * @param  array{int<0, 255>, int<0, 255>, int<0, 255>}  $rgb
     */
    private function glow(GdImage $img, int $cx, int $cy, int $radius, array $rgb): void
    {
        for ($i = 24; $i >= 1; $i--) {
            $r = (int) ($radius * $i / 24);
            imagefilledellipse($img, $cx, $cy, $r * 2, $r * 2, $this->color($img, $rgb[0], $rgb[1], $rgb[2], 0.018));
        }
    }

    /** @return int<0, 255> */
    private function channel(float $value): int
    {
        return max(0, min(255, (int) round($value)));
    }

    /**
     * @param  int<0, 255>  $r
     * @param  int<0, 255>  $g
     * @param  int<0, 255>  $b
     */
    private function color(GdImage $img, int $r, int $g, int $b, float $opacity = 1.0): int
    {
        $alpha = max(0, min(127, (int) round(127 * (1 - $opacity))));

        return (int) imagecolorallocatealpha($img, $r, $g, $b, $alpha);
    }

    /** Найбільший кегль, з яким заголовок уміщається у два рядки. */
    private function fit(string $font, string $text, int $width, int $max, int $min): int
    {
        for ($size = $max; $size > $min; $size -= 4) {
            $lines = $this->wrap($font, $size, $text, $width, 3);
            if (count($lines) <= 2 && ! str_ends_with(end($lines) ?: '', '…')) {
                return $size;
            }
        }

        return $min;
    }

    /**
     * @return list<string>
     */
    private function wrap(string $font, int $size, string $text, int $width, int $maxLines): array
    {
        $measure = function (string $s) use ($font, $size): int {
            $box = imagettfbbox($size, 0, $font, $s) ?: [0, 0, 0, 0, 0, 0, 0, 0];

            return $box[2] - $box[0];
        };
        $lines = [];
        $current = '';
        foreach (preg_split('/\s+/u', trim($text)) ?: [] as $word) {
            $try = $current === '' ? $word : $current.' '.$word;
            if ($measure($try) <= $width) {
                $current = $try;

                continue;
            }
            if ($current !== '') {
                $lines[] = $current;
            }
            $current = $word;
            // Дуже довге слово — ріжемо по літерах.
            while ($measure($current) > $width && mb_strlen($current) > 1) {
                $cut = mb_strlen($current);
                while ($cut > 1 && $measure(mb_substr($current, 0, $cut)) > $width) {
                    $cut--;
                }
                $lines[] = mb_substr($current, 0, $cut);
                $current = mb_substr($current, $cut);
            }
        }
        if ($current !== '') {
            $lines[] = $current;
        }
        if (count($lines) > $maxLines) {
            $last = $lines[$maxLines - 1];
            while ($last !== '' && $measure($last.'…') > $width) {
                $last = mb_substr($last, 0, -1);
            }
            $lines = [...array_slice($lines, 0, $maxLines - 1), rtrim($last).'…'];
        }

        return $lines;
    }

    /**
     * @param  array{string, string, string}  $forms
     */
    private function plural(int $n, array $forms): string
    {
        $mod10 = $n % 10;
        $mod100 = $n % 100;

        return match (true) {
            $mod10 === 1 && $mod100 !== 11 => $forms[0],
            $mod10 >= 2 && $mod10 <= 4 && ($mod100 < 12 || $mod100 > 14) => $forms[1],
            default => $forms[2],
        };
    }
}
