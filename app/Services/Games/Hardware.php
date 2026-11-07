<?php

namespace App\Services\Games;

/**
 * «Чи потягне мій ПК»: орієнтовні бали продуктивності процесорів і відеокарт (порядок величин —
 * як у загальнодоступних синтетичних тестах; точність ±15 %, для порівняння «вище/нижче вимог»
 * цього досить). Невідому модель не вгадуємо — повертаємо null, і на сторінці буде «?».
 */
class Hardware
{
    /** Запас на похибку: 92 % від вимоги ще вважаємо «тягне». */
    public const TOLERANCE = 0.92;

    /**
     * Відеокарти: назва (як показуємо) → бал. Від новіших до старіших у межах серії.
     *
     * @var array<string, int>
     */
    public const GPUS = [
        // NVIDIA
        'RTX 5090' => 40000, 'RTX 5080' => 36000, 'RTX 5070 Ti' => 32500, 'RTX 5070' => 29000, 'RTX 5060 Ti' => 24500, 'RTX 5060' => 22500,
        'RTX 4090' => 38500, 'RTX 4080 Super' => 35000, 'RTX 4080' => 34500, 'RTX 4070 Ti Super' => 32000, 'RTX 4070 Ti' => 31500,
        'RTX 4070 Super' => 30000, 'RTX 4070' => 26800, 'RTX 4060 Ti' => 22600, 'RTX 4060' => 19700, 'RTX 4050' => 15000,
        'RTX 3090 Ti' => 29000, 'RTX 3090' => 26700, 'RTX 3080 Ti' => 26500, 'RTX 3080' => 25000, 'RTX 3070 Ti' => 23500, 'RTX 3070' => 22300,
        'RTX 3060 Ti' => 20200, 'RTX 3060' => 17000, 'RTX 3050' => 12800,
        'RTX 2080 Ti' => 21800, 'RTX 2080 Super' => 19500, 'RTX 2080' => 18700, 'RTX 2070 Super' => 18000, 'RTX 2070' => 16200,
        'RTX 2060 Super' => 16000, 'RTX 2060' => 14000,
        'GTX 1660 Ti' => 12900, 'GTX 1660 Super' => 12700, 'GTX 1660' => 11600, 'GTX 1650 Super' => 10000, 'GTX 1650' => 7800, 'GTX 1630' => 4600,
        'GTX 1080 Ti' => 18300, 'GTX 1080' => 15400, 'GTX 1070 Ti' => 14500, 'GTX 1070' => 13500, 'GTX 1060' => 10000, 'GTX 1050 Ti' => 6300, 'GTX 1050' => 4900,
        'GT 1030' => 2600,
        'GTX Titan X' => 13000, 'GTX 980 Ti' => 13500, 'GTX 980' => 11000, 'GTX 970' => 9600, 'GTX 960' => 6100, 'GTX 950' => 5300,
        'GTX 780 Ti' => 9000, 'GTX 780' => 7900, 'GTX 770' => 6100, 'GTX 760' => 5000, 'GTX 750 Ti' => 3900, 'GTX 750' => 3300,
        'GTX 690' => 6500, 'GTX 680' => 5600, 'GTX 670' => 5500, 'GTX 660 Ti' => 4800, 'GTX 660' => 4400, 'GTX 650 Ti' => 2700, 'GTX 650' => 1800,
        'GTX 590' => 3500, 'GTX 580' => 3500, 'GTX 570' => 3100, 'GTX 560 Ti' => 2900, 'GTX 560' => 2600, 'GTX 550 Ti' => 1900,
        'GTX 480' => 2900, 'GTX 470' => 2500, 'GTX 460' => 2300, 'GTS 450' => 1500, 'GTX 285' => 1700, 'GTX 280' => 1500, 'GTX 260' => 1200,
        'GT 730' => 900, 'GT 710' => 600, 'GT 640' => 1300, 'GT 630' => 700, 'GT 440' => 900, 'GT 430' => 600, '9800 GT' => 800, '8800 GT' => 700,
        // AMD
        'RX 9070 XT' => 30500, 'RX 9070' => 28000, 'RX 9060 XT' => 21000,
        'RX 7900 XTX' => 32000, 'RX 7900 XT' => 31500, 'RX 7900 GRE' => 28000, 'RX 7800 XT' => 27500, 'RX 7700 XT' => 24000, 'RX 7600 XT' => 17200, 'RX 7600' => 16600,
        'RX 6950 XT' => 28500, 'RX 6900 XT' => 27300, 'RX 6800 XT' => 25400, 'RX 6800' => 23400, 'RX 6750 XT' => 20600, 'RX 6700 XT' => 19600, 'RX 6700' => 18000,
        'RX 6650 XT' => 17500, 'RX 6600 XT' => 16900, 'RX 6600' => 15200, 'RX 6500 XT' => 9400, 'RX 6400' => 7500,
        'RX 5700 XT' => 16800, 'RX 5700' => 15600, 'RX 5600 XT' => 13500, 'RX 5500 XT' => 9500,
        'Radeon VII' => 17000, 'RX Vega 64' => 14000, 'RX Vega 56' => 13000,
        'RX 590' => 9600, 'RX 580' => 8800, 'RX 570' => 7600, 'RX 560' => 3900, 'RX 550' => 2700,
        'RX 480' => 8200, 'RX 470' => 7300, 'RX 460' => 3700,
        'R9 Fury X' => 10000, 'R9 Fury' => 9500, 'R9 390X' => 10000, 'R9 390' => 9500, 'R9 380X' => 6500, 'R9 380' => 6000,
        'R9 290X' => 9000, 'R9 290' => 8700, 'R9 280X' => 6500, 'R9 280' => 5800, 'R9 270X' => 5300, 'R9 270' => 4900,
        'R7 370' => 4000, 'R7 360' => 3000, 'R7 265' => 4400, 'R7 260X' => 3100, 'R7 250' => 1500,
        'HD 7970' => 6000, 'HD 7950' => 5500, 'HD 7870' => 5200, 'HD 7850' => 4300, 'HD 7790' => 3300, 'HD 7770' => 2600, 'HD 7750' => 1900,
        'HD 6970' => 3500, 'HD 6950' => 3200, 'HD 6870' => 2900, 'HD 6850' => 2500, 'HD 6790' => 2200, 'HD 6770' => 1600, 'HD 5870' => 2700, 'HD 5850' => 2300, 'HD 5770' => 1600, 'HD 4870' => 1200, 'HD 4850' => 1000,
        // Intel
        'Arc B580' => 16000, 'Arc B570' => 14500, 'Arc A770' => 14000, 'Arc A750' => 13000, 'Arc A580' => 11500, 'Arc A380' => 6800,
        'Iris Xe' => 2600, 'Iris Plus' => 1500, 'UHD 770' => 1600, 'UHD 730' => 1400, 'UHD 630' => 1400, 'UHD 620' => 950, 'HD 630' => 1300, 'HD 620' => 950,
        'HD 530' => 1100, 'HD 520' => 900, 'HD 4600' => 800, 'HD 4400' => 650, 'HD 4000' => 550, 'HD 3000' => 300,
        // Apple
        'Apple M4' => 13000, 'Apple M3' => 11000, 'Apple M2' => 9000, 'Apple M1' => 7000,
    ];

    /**
     * Процесори Intel Core (настільні): тир → покоління → бал.
     *
     * @var array<string, array<int, int>>
     */
    private const INTEL = [
        'i3' => [1 => 1500, 2 => 2000, 3 => 2300, 4 => 2600, 5 => 2700, 6 => 3600, 7 => 4100, 8 => 6100, 9 => 6400, 10 => 8800, 11 => 9500, 12 => 14000, 13 => 14600, 14 => 15000],
        'i5' => [1 => 2600, 2 => 4100, 3 => 4600, 4 => 5000, 5 => 5200, 6 => 5600, 7 => 6300, 8 => 9200, 9 => 9800, 10 => 12200, 11 => 17500, 12 => 19500, 13 => 25000, 14 => 25500],
        'i7' => [1 => 3000, 2 => 5300, 3 => 6400, 4 => 7000, 5 => 7400, 6 => 8000, 7 => 8800, 8 => 13000, 9 => 14200, 10 => 17000, 11 => 21000, 12 => 31000, 13 => 38000, 14 => 41000],
        'i9' => [9 => 17500, 10 => 22000, 11 => 25000, 12 => 41000, 13 => 59000, 14 => 61000],
    ];

    /**
     * AMD Ryzen: тир → покоління (перша цифра моделі) → бал.
     *
     * @var array<int, array<int, int>>
     */
    private const RYZEN = [
        3 => [1 => 6300, 2 => 7500, 3 => 11600, 4 => 11000, 5 => 14000, 7 => 18000, 8 => 18000, 9 => 20000],
        5 => [1 => 12300, 2 => 13200, 3 => 17800, 4 => 16000, 5 => 21900, 7 => 28700, 8 => 26000, 9 => 30000],
        7 => [1 => 15600, 2 => 17800, 3 => 22700, 4 => 20000, 5 => 28000, 7 => 36000, 8 => 32000, 9 => 37000],
        9 => [3 => 32800, 5 => 39400, 7 => 55000, 9 => 63000],
    ];

    /**
     * Старші й окремі процесори (шаблон → бал).
     *
     * @var array<string, int>
     */
    private const CPU_EXTRA = [
        'fx-9590' => 6900, 'fx-9370' => 6500, 'fx-8370' => 6100, 'fx-8350' => 5900, 'fx-8320' => 5300, 'fx-8300' => 5100, 'fx-8150' => 5000, 'fx-8120' => 4700,
        'fx-6350' => 4500, 'fx-6300' => 4100, 'fx-6100' => 3500, 'fx-4350' => 3200, 'fx-4300' => 3100, 'fx-4100' => 2500,
        'phenom ii x6' => 3800, 'phenom ii x4' => 2900, 'phenom ii x2' => 1500, 'phenom x4' => 1900,
        'athlon ii x4' => 2300, 'athlon ii x2' => 1200, 'athlon x4' => 2800, 'athlon 3000g' => 4600, 'athlon 200ge' => 3500, 'athlon 64 x2' => 800,
        'core 2 quad' => 1900, 'core 2 duo' => 1100, 'pentium dual' => 800, 'pentium d' => 600, 'pentium 4' => 300,
        'pentium gold' => 4000, 'pentium g4560' => 3400, 'pentium g' => 2400, 'celeron' => 1500,
        'xeon e3' => 6000, 'xeon e5' => 7000,
        'apple m4' => 24000, 'apple m3' => 19000, 'apple m2' => 15000, 'apple m1' => 14000,
    ];

    /** Бал відеокарти або null, якщо модель не впізнали. */
    public static function gpu(string $text): ?int
    {
        $text = self::normalize($text);
        // Довші назви першими: «gtx 1660 super» раніше за «gtx 1660».
        $names = array_keys(self::GPUS);
        usort($names, fn (string $a, string $b) => strlen($b) <=> strlen($a));
        foreach ($names as $name) {
            $pattern = '/(?<![a-z0-9])'.str_replace(' ', '\s*', preg_quote(strtolower($name), '/')).'(?![a-z0-9])/';
            if (preg_match($pattern, $text) === 1) {
                return self::GPUS[$name];
            }
        }

        return null;
    }

    /** Бал процесора або null. */
    public static function cpu(string $text): ?int
    {
        $text = self::normalize($text);
        // Intel Core i5-12400F, i7 8700K, i5-1135G7 (ноутбук), Core i5 4th gen.
        if (preg_match('/\bi([3579])[\s-]*(\d{3,5})([a-z]{0,2}\d?)\b/', $text, $m)) {
            $tier = 'i'.$m[1];
            $digits = $m[2];
            // Три цифри (i5 750, i7 920) — перше покоління.
            $gen = match (strlen($digits)) {
                5 => (int) substr($digits, 0, 2),
                3 => 1,
                default => (int) $digits[0],
            };
            if (strlen($digits) === 4 && $digits[0] === '1' && in_array($digits[1], ['0', '1', '2', '3', '4'], true) && $m[3] !== '') {
                // i5-1135G7 / i7-1260P — ноутбучні 10–14 покоління.
                $gen = (int) substr($digits, 0, 2);
            }
            $score = self::pick(self::INTEL[$tier], $gen);
            if ($score === null) {
                return null;
            }
            $suffix = $m[3];

            return (int) round($score * match (true) {
                str_starts_with($suffix, 'u'), str_starts_with($suffix, 'g'), str_starts_with($suffix, 'y') => 0.6,
                str_starts_with($suffix, 'h'), str_starts_with($suffix, 'p') => 0.85,
                default => 1.0,
            });
        }
        if (preg_match('/\bi([3579])\b.*?\b(\d{1,2})(?:st|nd|rd|th)\s*gen/', $text, $m)) {
            return self::pick(self::INTEL['i'.$m[1]], (int) $m[2]);
        }
        // Ryzen 5 3600, Ryzen 7 5800X3D, Ryzen 5 5500U.
        if (preg_match('/ryzen\s*([3579])\s*(?:pro\s*)?(\d)(\d{3})([a-z0-9]*)/', $text, $m)) {
            $score = self::pick(self::RYZEN[(int) $m[1]], (int) $m[2]);
            if ($score === null) {
                return null;
            }

            return (int) round($score * (str_starts_with($m[4], 'u') ? 0.65 : (str_starts_with($m[4], 'h') ? 0.85 : 1.0)));
        }
        $keys = array_keys(self::CPU_EXTRA);
        usort($keys, fn (string $a, string $b) => strlen($b) <=> strlen($a));
        foreach ($keys as $key) {
            if (str_contains($text, $key)) {
                return self::CPU_EXTRA[$key];
            }
        }

        return null;
    }

    /** Обсяг пам'яті в ГБ із рядка «8 GB RAM» / «4096 MB». */
    public static function ram(string $text): ?float
    {
        if (preg_match('/(\d+(?:[.,]\d+)?)\s*(gb|mb|гб|мб)/i', $text, $m)) {
            $value = (float) str_replace(',', '.', $m[1]);

            return str_starts_with(strtolower($m[2]), 'm') || str_starts_with(mb_strtolower($m[2]), 'м') ? round($value / 1024, 1) : $value;
        }

        return null;
    }

    /**
     * Вимога з кількома варіантами («Intel Core i5-4460 or AMD FX-6300») → найнижчий упізнаний бал.
     *
     * @param  callable(string): ?int  $score
     */
    public static function requirement(string $text, callable $score): ?int
    {
        $best = null;
        foreach (preg_split('/\s+or\s+|\s*\/\s*|\s*\|\s*|,|;|\s+або\s+/i', $text) ?: [] as $part) {
            $value = $score($part);
            if ($value !== null) {
                $best = $best === null ? $value : min($best, $value);
            }
        }

        return $best ?? $score($text);
    }

    /**
     * Порівняння збірки з вимогами одного рівня: ok / fail / unknown для процесора, відеокарти й пам'яті.
     *
     * @param  array{cpu?: string|null, gpu?: string|null, ram?: int|float|null}  $pc
     * @param  array<string, string>  $req
     * @return array{cpu: string, gpu: string, ram: string, verdict: string}|null
     */
    public static function compare(array $pc, array $req): ?array
    {
        if ($req === []) {
            return null;
        }
        $check = function (?float $mine, ?float $need): string {
            if ($need === null) {
                return 'none';
            }
            if ($mine === null) {
                return 'unknown';
            }

            return $mine >= $need * self::TOLERANCE ? 'ok' : 'fail';
        };
        $cpuMine = is_string($pc['cpu'] ?? null) ? self::cpu($pc['cpu']) : null;
        $gpuMine = is_string($pc['gpu'] ?? null) ? self::gpu($pc['gpu']) : null;
        $ramMine = is_numeric($pc['ram'] ?? null) ? (float) $pc['ram'] : null;
        $cpuNeed = isset($req['cpu']) ? self::requirement($req['cpu'], [self::class, 'cpu']) : null;
        $gpuNeed = isset($req['gpu']) ? self::requirement($req['gpu'], [self::class, 'gpu']) : null;
        $ramNeed = isset($req['ram']) ? self::ram($req['ram']) : null;
        $result = [
            'cpu' => isset($req['cpu']) && $cpuNeed === null ? 'unknown' : $check($cpuMine, $cpuNeed),
            'gpu' => isset($req['gpu']) && $gpuNeed === null ? 'unknown' : $check($gpuMine, $gpuNeed),
            'ram' => $ramMine !== null && $ramNeed !== null ? ($ramMine >= $ramNeed ? 'ok' : 'fail') : $check($ramMine, $ramNeed),
        ];
        $states = array_values($result);
        $verdict = in_array('fail', $states, true) ? 'fail' : (in_array('unknown', $states, true) ? 'unknown' : 'ok');

        return [...$result, 'verdict' => $verdict];
    }

    /** @param  array<int, int>  $table */
    private static function pick(array $table, int $gen): ?int
    {
        if ($table === []) {
            return null;
        }
        if (isset($table[$gen])) {
            return $table[$gen];
        }
        // Проміжне покоління — найближче менше.
        $lower = array_filter(array_keys($table), fn (int $g) => $g <= $gen);

        return $lower === [] ? null : $table[max($lower)];
    }

    private static function normalize(string $text): string
    {
        $text = strtolower($text);
        $text = (string) preg_replace('/\b(nvidia|geforce|amd|radeon|ati|intel\(r\)|intel|\(r\)|\(tm\)|graphics|series|core™)\b/', ' ', $text);

        return trim((string) preg_replace('/\s+/', ' ', str_replace(['®', '™'], ' ', $text)));
    }

    /**
     * Підказки для поля відеокарти (процесор вводять вільно — його модель упізнаємо за шаблоном).
     *
     * @return list<string>
     */
    public static function gpuNames(): array
    {
        return array_keys(self::GPUS);
    }
}
