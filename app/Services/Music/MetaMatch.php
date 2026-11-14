<?php

namespace App\Services\Music;

use Normalizer;

/**
 * Звірка й вибір метаданих з кількох джерел: нормалізація назв (регістр, діакритика, «feat.»),
 * перевірка, що це той самий запис (виконавець, тривалість ±5 с), і вибір значення для кожного
 * поля за довірою — збіг кількох незалежних джерел дає бонус.
 */
class MetaMatch
{
    /** Бонус за кожне додаткове джерело з тим самим значенням. */
    public const AGREEMENT_BONUS = 10;

    /** Допустима різниця тривалості (секунди), інакше це інша версія запису. */
    public const DURATION_TOLERANCE = 5;

    /** Рядок для порівняння: нижній регістр, без діакритики, «feat. …», дужок і розділових знаків. */
    public static function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value));
        if (class_exists(Normalizer::class)) {
            $value = (string) preg_replace('/\p{Mn}+/u', '', (string) Normalizer::normalize($value, Normalizer::FORM_D));
        }
        $value = str_replace(['ё', 'ї', 'й'], ['е', 'і', 'и'], $value);
        // «Song (feat. X)», «Artist ft. Y», «Artist featuring Z» — гостьова участь не змінює запис.
        $value = (string) preg_replace('/[\(\[]?\s*\b(feat|ft|featuring)\b\.?.*$/u', '', $value);
        $value = (string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $value);

        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    /** Головний виконавець: до коми, «&», «x», «feat.». */
    public static function primaryArtist(string $artist): string
    {
        $first = preg_split('/\s*(,|&|;|\s+x\s+|\s+and\s+|\s+і\s+|\s+и\s+|\bfeat\b|\bft\b)\s*/iu', $artist)[0] ?? $artist;

        return self::normalize($first);
    }

    public static function sameArtist(?string $a, ?string $b): bool
    {
        if (blank($a) || blank($b)) {
            return false;
        }
        $na = self::normalize((string) $a);
        $nb = self::normalize((string) $b);

        return $na !== '' && ($na === $nb || self::primaryArtist((string) $a) === self::primaryArtist((string) $b));
    }

    /** Назви збігаються з точністю до регістру, діакритики, «feat.» і приписок у дужках («Remastered»). */
    public static function sameTitle(?string $a, ?string $b): bool
    {
        if (blank($a) || blank($b)) {
            return false;
        }
        $strip = fn (string $v) => self::normalize((string) preg_replace('/\s*[\(\[][^\)\]]*[\)\]]\s*/u', ' ', $v));

        return self::normalize((string) $a) === self::normalize((string) $b) || ($strip((string) $a) !== '' && $strip((string) $a) === $strip((string) $b));
    }

    /** Тривалість збігається (невідома з будь-якого боку — не перешкода). */
    public static function durationOk(?int $a, ?int $b): bool
    {
        return ! $a || ! $b || abs($a - $b) <= self::DURATION_TOLERANCE;
    }

    /** Ключ значення для пошуку збігів між джерелами. */
    public static function valueKey(string $field, mixed $value): string
    {
        return match ($field) {
            'cover' => 'cover',
            'year', 'track_no' => (string) (int) $value,
            // Дати з різних джерел мають різну точність («2015-00-00», «2015-03») — порівнюємо рік.
            'born', 'formed' => substr((string) $value, 0, 4),
            'image' => (string) $value,
            'lyrics' => self::normalize((string) preg_replace('/\[[\d:.]+\]/', '', (string) $value)),
            default => is_string($value) ? self::normalize($value) : (string) json_encode($value),
        };
    }

    /**
     * Найкраще значення для кожного поля. Кандидат: {field, value, source, score 0–100}.
     * Однакові значення з різних джерел складаються: найвища довіра + бонус за кожне додаткове джерело.
     * Обкладинки не порівнюються між собою (різні адреси) — перемагає найнадійніше джерело.
     *
     * @param  list<array{field: string, value: mixed, source: string, score: int|float}>  $candidates
     * @return array<string, array{value: mixed, source: string, score: float, sources: list<string>}>
     */
    public static function pick(array $candidates): array
    {
        $groups = [];
        foreach ($candidates as $candidate) {
            if (blank($candidate['value'] ?? null) || $candidate['score'] <= 0) {
                continue;
            }
            $field = $candidate['field'];
            $key = $field === 'cover' ? $candidate['source'].'|'.md5((string) json_encode($candidate['value'])) : self::valueKey($field, $candidate['value']);
            if ($key === '') {
                continue;
            }
            $groups[$field][$key][] = $candidate;
        }

        $winners = [];
        foreach ($groups as $field => $byValue) {
            foreach ($byValue as $group) {
                usort($group, fn ($a, $b) => $b['score'] <=> $a['score']);
                $sources = array_values(array_unique(array_column($group, 'source')));
                $score = min(100.0, (float) $group[0]['score'] + self::AGREEMENT_BONUS * (count($sources) - 1));
                if (! isset($winners[$field]) || $score > $winners[$field]['score']) {
                    $winners[$field] = ['value' => $group[0]['value'], 'source' => $group[0]['source'], 'score' => $score, 'sources' => $sources];
                }
            }
        }

        return $winners;
    }
}
