<?php

namespace App\Services\Families;

use App\Models\Family;
use Illuminate\Validation\ValidationException;

/**
 * Статут сім’ї й тест за ним перед вступом.
 * Зберігається в settings сім’ї: charter (текст), charter_quiz (питання з варіантами), charter_pass (поріг у %).
 */
class FamilyCharter
{
    public const MAX_QUESTIONS = 10;

    public const MAX_TEXT = 20000;

    public function text(Family $family): ?string
    {
        $text = trim((string) ($family->settings['charter'] ?? ''));

        return $text === '' ? null : $text;
    }

    /** @return list<array{q: string, options: list<string>, correct: int}> */
    public function quiz(Family $family): array
    {
        $quiz = [];
        foreach ((array) ($family->settings['charter_quiz'] ?? []) as $item) {
            if (! is_array($item)) {
                continue;
            }
            $options = array_values(array_filter(array_map(fn ($o) => trim((string) $o), (array) ($item['options'] ?? [])), fn ($o) => $o !== ''));
            $q = trim((string) ($item['q'] ?? ''));
            $correct = (int) ($item['correct'] ?? 0);
            if ($q === '' || count($options) < 2 || $correct < 0 || $correct >= count($options)) {
                continue;
            }
            $quiz[] = ['q' => $q, 'options' => $options, 'correct' => $correct];
        }

        return array_slice($quiz, 0, self::MAX_QUESTIONS);
    }

    /**
     * Питання без правильних відповідей — для кандидата.
     *
     * @return list<array<string, mixed>>
     */
    public function publicQuiz(Family $family): array
    {
        return array_map(fn (array $item) => ['q' => $item['q'], 'options' => $item['options']], $this->quiz($family));
    }

    public function passPercent(Family $family): int
    {
        return max(50, min(100, (int) ($family->settings['charter_pass'] ?? 80)));
    }

    /**
     * Перевірити відповіді. Повертає рядок «N з M» або кидає помилку, якщо тест не пройдено.
     *
     * @param  array<int|string, mixed>  $answers
     */
    public function grade(Family $family, array $answers): ?string
    {
        $quiz = $this->quiz($family);
        if ($quiz === []) {
            return null;
        }
        $right = 0;
        foreach ($quiz as $i => $item) {
            if (isset($answers[$i]) && is_numeric($answers[$i]) && (int) $answers[$i] === $item['correct']) {
                $right++;
            }
        }
        $total = count($quiz);
        if ($right * 100 < $this->passPercent($family) * $total) {
            throw ValidationException::withMessages(['quiz' => "Тест за статутом не пройдено: {$right} з {$total}. Перечитайте статут і спробуйте ще раз."]);
        }

        return "{$right} з {$total}";
    }

    /**
     * @param  list<array{q?: string, options?: list<string>, correct?: int}>  $quiz
     */
    public function save(Family $family, ?string $text, array $quiz, int $pass): void
    {
        $settings = (array) $family->settings;
        $settings['charter'] = $text === null ? null : mb_substr(trim($text), 0, self::MAX_TEXT);
        $settings['charter_quiz'] = array_slice(array_values($quiz), 0, self::MAX_QUESTIONS);
        $settings['charter_pass'] = max(50, min(100, $pass));
        $family->forceFill(['settings' => $settings])->save();
    }
}
