<?php

namespace App\Services\Alerts;

/**
 * Райони й громади (КАТОТТГ) для тривог на рівні районів і громад: назва з API тривог → код,
 * який малює мапа (`resources/js/data/ua-units.json`, `ua-hromadas.json`).
 */
final class AlertUnits
{
    /** @var array<string, array{0: string, 1: int, 2: string, 3: string|null}>|null */
    private static ?array $index = null;

    /** @var array<string, list<string>>|null ключ «область|рівень|назва» → коди */
    private static ?array $byName = null;

    /** @return array<string, array{0: string, 1: int, 2: string, 3: string|null}> */
    public static function all(): array
    {
        if (self::$index === null) {
            /** @var array<string, array{0: string, 1: int, 2: string, 3: string|null}> $data */
            $data = json_decode((string) file_get_contents(__DIR__.'/units.json'), true);
            self::$index = $data;
        }

        return self::$index;
    }

    /**
     * «Бучанський район» / «Бучанська територіальна громада» / «м. Буча та громада» → «буча».
     */
    public static function normalize(string $name): string
    {
        $name = mb_strtolower(str_replace(['’', 'ʼ', '`', '\''], '’', trim($name)));
        $name = (string) preg_replace('/(територіальна|міська|селищна|сільська)\s+/u', '', $name);
        $name = (string) preg_replace('/\b(громада|район|та громада)\b|^м\.\s*|^смт\s*|^с\.\s*/u', '', $name);
        $name = (string) preg_replace('/(ський|цький|зький|ська|цька|зька|ський|ий|а)$/u', '', trim($name));

        return trim((string) preg_replace('/\s+/u', ' ', $name));
    }

    /**
     * Код району (рівень 2) чи громади (3) за назвою в межах області; для громад з однаковою назвою — ще й за районом.
     */
    public static function find(string $oblast, int $level, string $name, ?string $raion = null): ?string
    {
        if (self::$byName === null) {
            self::$byName = [];
            foreach (self::all() as $code => [$unitName, $unitLevel, $unitOblast]) {
                self::$byName[$unitOblast.'|'.$unitLevel.'|'.self::normalize($unitName)][] = $code;
            }
        }
        $codes = self::$byName[$oblast.'|'.$level.'|'.self::normalize($name)] ?? [];
        if (count($codes) > 1 && $raion !== null) {
            $codes = array_values(array_filter($codes, fn (string $code) => (self::all()[$code][3] ?? null) === $raion));
        }

        return $codes[0] ?? null;
    }

    /**
     * Район (2) чи громада (3) за назвою, коли область невідома: шукаємо по всіх областях.
     *
     * @return array{oblast: string, code: string}|null
     */
    public static function locate(int $level, string $name, ?string $oblast = null): ?array
    {
        if ($oblast !== null) {
            $code = self::find($oblast, $level, $name);

            return $code !== null ? ['oblast' => $oblast, 'code' => $code] : null;
        }
        $key = self::normalize($name);
        $hits = [];
        foreach (self::all() as $code => [$unitName, $unitLevel, $unitOblast]) {
            if ($unitLevel === $level && self::normalize($unitName) === $key) {
                $hits[] = ['oblast' => $unitOblast, 'code' => $code];
            }
        }

        // Однакові назви в різних областях без підказки — не вгадуємо.
        return count($hits) === 1 ? $hits[0] : null;
    }

    /**
     * Коди районів області (для тривоги на всю область).
     *
     * @return list<string>
     */
    public static function raionsOf(string $oblast): array
    {
        $out = [];
        foreach (self::all() as $code => [, $level, $unitOblast]) {
            if ($level === 2 && $unitOblast === $oblast) {
                $out[] = $code;
            }
        }

        return $out;
    }
}
