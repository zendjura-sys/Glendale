<?php

namespace App\Support\I18n;

/**
 * Мова запису за самим текстом: алфавіт і характерні літери чи слова.
 * Повертає код мови сайту або null, якщо тексту замало чи він неоднозначний.
 */
class LanguageGuess
{
    public const MIN_LETTERS = 12;

    /** Мови, які вміє розпізнати. */
    public const LANGS = ['uk', 'en', 'de', 'fr', 'es', 'ru', 'kk', 'zh', 'ja'];

    public static function guess(?string $text): ?string
    {
        $text = (string) $text;
        $text = (string) preg_replace(['#https?://\S+#u', '/[@#][\p{L}\p{N}_.]+/u'], ' ', $text);
        $letters = (int) preg_match_all('/\p{L}/u', $text);
        if ($letters < self::MIN_LETTERS) {
            return null;
        }
        $kana = (int) preg_match_all('/[\p{Hiragana}\p{Katakana}]/u', $text);
        $han = (int) preg_match_all('/\p{Han}/u', $text);
        $cyrillic = (int) preg_match_all('/\p{Cyrillic}/u', $text);
        $latin = (int) preg_match_all('/\p{Latin}/u', $text);

        if ($kana > 0 && $kana + $han >= $letters / 3) {
            return 'ja';
        }
        if ($han >= $letters / 3) {
            return 'zh';
        }
        $lower = mb_strtolower($text);
        if ($cyrillic >= $latin) {
            return match (true) {
                preg_match('/[әғқңөұүһ]/u', $lower) === 1 => 'kk',
                preg_match('/[іїєґ]/u', $lower) === 1 => 'uk',
                preg_match('/[ыэёъ]/u', $lower) === 1 => 'ru',
                default => self::cyrillicWords($lower),
            };
        }

        $words = preg_split('/[^\p{L}]+/u', $lower, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $score = ['en' => 0, 'de' => 0, 'fr' => 0, 'es' => 0];
        $common = [
            'en' => ['the', 'and', 'is', 'you', 'to', 'of', 'in', 'it', 'with', 'for', 'this', 'that', 'are', 'was', 'have'],
            'de' => ['und', 'der', 'die', 'das', 'ist', 'nicht', 'ich', 'mit', 'ein', 'eine', 'zu', 'auf', 'wir', 'sie'],
            'fr' => ['le', 'la', 'les', 'est', 'et', 'pas', 'des', 'une', 'je', 'vous', 'pour', 'avec', 'qui', 'nous'],
            'es' => ['el', 'los', 'que', 'por', 'para', 'es', 'y', 'una', 'con', 'las', 'pero', 'muy', 'yo', 'del'],
        ];
        foreach ($words as $word) {
            foreach ($common as $lang => $list) {
                if (in_array($word, $list, true)) {
                    $score[$lang]++;
                }
            }
        }
        $score['de'] += 2 * (int) preg_match_all('/[äöüß]/u', $lower);
        $score['fr'] += 2 * (int) preg_match_all('/[èêàçùœ]/u', $lower);
        $score['es'] += 2 * (int) preg_match_all('/[ñ¿¡]/u', $lower);
        arsort($score);
        $best = (string) array_key_first($score);

        return $score[$best] > 0 ? $best : 'en';
    }

    /** Без характерних літер — за частими словами. */
    private static function cyrillicWords(string $lower): ?string
    {
        $words = preg_split('/[^\p{L}’\']+/u', $lower, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $ru = ['что', 'это', 'как', 'кто', 'сегодня', 'привет', 'будет', 'всем', 'очень', 'только', 'она', 'они', 'если', 'или', 'где', 'здесь', 'когда', 'нет', 'да', 'вечером', 'играем'];
        $uk = ['що', 'це', 'як', 'хто', 'сьогодні', 'привіт', 'буде', 'всім', 'дуже', 'тільки', 'вона', 'вони', 'якщо', 'або', 'де', 'тут', 'коли', 'ні', 'так', 'граємо'];
        $score = 0;
        foreach ($words as $word) {
            $score += in_array($word, $ru, true) ? 1 : (in_array($word, $uk, true) ? -1 : 0);
        }

        return match (true) {
            $score > 0 => 'ru',
            $score < 0 => 'uk',
            default => null,
        };
    }
}
