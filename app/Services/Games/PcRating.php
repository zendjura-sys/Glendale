<?php

namespace App\Services\Games;

/**
 * Оцінка збірки ПК (№224): бал 0–100 і клас (від «Офісного» до «Топового»), слабке місце й
 * поради апгрейду з конкретними моделями. Бали — з Hardware (орієнтовно, ±15 %): це підказка
 * «що міняти першим», а не тест продуктивності.
 */
class PcRating
{
    /** Бал, який вважаємо «стелею» (100 %) для сучасних ігор у 1440p. */
    private const GPU_TOP = 32000;

    private const CPU_TOP = 36000;

    /** Класи збірки: з якого балу. */
    private const TIERS = [85 => 'Топова', 65 => 'Висока', 45 => 'Середня', 25 => 'Початкова', 0 => 'Офісна'];

    /** Відеокарти для порад: актуальні серії (бали — з Hardware, перебір від слабшої). */
    private const GPU_PICKS = ['RTX 4060', 'RX 7600 XT', 'RTX 5060 Ti', 'RX 9060 XT', 'RTX 5070', 'RX 9070 XT', 'RTX 5070 Ti', 'RTX 5080'];

    /** Процесори для порад (настільні; бали — з Hardware). */
    private const CPU_PICKS = ['Core i5-12400F', 'Ryzen 5 5600', 'Core i5-13400F', 'Ryzen 5 7600', 'Ryzen 7 7800X3D', 'Ryzen 7 9800X3D'];

    /**
     * @param  array{cpu?: string|null, gpu?: string|null, ram?: int|float|null}  $pc
     * @return array{score: int|null, tier: string|null, parts: array{cpu: int|null, gpu: int|null, ram: int|null}, weak: string|null, advice: list<string>}|null
     */
    public static function rate(array $pc): ?array
    {
        $cpuName = is_string($pc['cpu'] ?? null) && $pc['cpu'] !== '' ? $pc['cpu'] : null;
        $gpuName = is_string($pc['gpu'] ?? null) && $pc['gpu'] !== '' ? $pc['gpu'] : null;
        $ram = is_numeric($pc['ram'] ?? null) ? (float) $pc['ram'] : null;
        if ($cpuName === null && $gpuName === null && $ram === null) {
            return null;
        }
        $cpu = $cpuName !== null ? Hardware::cpu($cpuName) : null;
        $gpu = $gpuName !== null ? Hardware::gpu($gpuName) : null;
        $parts = [
            'cpu' => $cpu !== null ? self::pct($cpu, self::CPU_TOP) : null,
            'gpu' => $gpu !== null ? self::pct($gpu, self::GPU_TOP) : null,
            'ram' => $ram !== null ? match (true) {
                $ram >= 32 => 100, $ram >= 16 => 75, $ram >= 12 => 55, $ram >= 8 => 35, default => 15,
            } : null,
        ];

        // Загальний бал — лише коли впізнали і процесор, і відеокарту (інакше чесно «не знаємо»).
        $score = $parts['cpu'] !== null && $parts['gpu'] !== null
            ? (int) round($parts['gpu'] * 0.55 + $parts['cpu'] * 0.3 + ($parts['ram'] ?? 50) * 0.15)
            : null;
        $tier = null;
        if ($score !== null) {
            foreach (self::TIERS as $from => $name) {
                if ($score >= $from) {
                    $tier = $name;
                    break;
                }
            }
        }

        $weak = null;
        if ($parts['cpu'] !== null && $parts['gpu'] !== null && abs($parts['cpu'] - $parts['gpu']) >= 20) {
            $weak = $parts['cpu'] < $parts['gpu'] ? 'cpu' : 'gpu';
        }

        $advice = [];
        if ($ram !== null && $ram < 16) {
            $advice[] = 'Додайте оперативної пам’яті до 16–32 ГБ — найдешевший помітний приріст.';
        }
        if ($gpu !== null && ($weak === 'gpu' || $parts['gpu'] < 60)) {
            $pick = self::nextGpu($gpu);
            if ($pick !== null) {
                $advice[] = "Найбільше дасть відеокарта рівня {$pick} — приблизно ".self::times(Hardware::GPUS[$pick], $gpu).' до кадрів у грі.';
            }
        }
        if ($cpu !== null && ($weak === 'cpu' || $parts['cpu'] < 50)) {
            $pick = self::nextCpu($cpu);
            if ($pick !== null) {
                $advice[] = "Процесор стримує систему — подивіться на {$pick}.";
            }
        }
        if ($cpuName !== null && $cpu === null) {
            $advice[] = 'Процесор не впізнали — напишіть модель повністю, як «Ryzen 5 5600» чи «Core i5-12400F».';
        }
        if ($gpuName !== null && $gpu === null) {
            $advice[] = 'Відеокарту не впізнали — оберіть модель із підказок.';
        }
        if ($advice === [] && $score !== null) {
            $advice[] = 'Збірка збалансована — апгрейд поки не потрібен.';
        }

        return ['score' => $score, 'tier' => $tier, 'parts' => $parts, 'weak' => $weak, 'advice' => $advice];
    }

    private static function pct(int $value, int $top): int
    {
        return (int) min(100, round($value / $top * 100));
    }

    /** «×1,8»: у скільки разів нова деталь швидша. */
    private static function times(int $new, int $old): string
    {
        return '×'.str_replace('.', ',', (string) round($new / max(1, $old), 1));
    }

    /** Найдешевша з актуальних відеокарт, що хоча б у 1,5 раза швидша (і не слабша за 4060). */
    private static function nextGpu(int $gpu): ?string
    {
        $picks = array_intersect_key(Hardware::GPUS, array_flip(self::GPU_PICKS));
        asort($picks);
        foreach ($picks as $name => $score) {
            if ($score >= max($gpu * 1.5, 19000)) {
                return $name;
            }
        }

        return null;
    }

    private static function nextCpu(int $cpu): ?string
    {
        $picks = [];
        foreach (self::CPU_PICKS as $name) {
            $picks[$name] = Hardware::cpu($name) ?? 0;
        }
        asort($picks);
        foreach ($picks as $name => $score) {
            if ($score >= $cpu * 1.4) {
                return $name;
            }
        }

        return null;
    }
}
