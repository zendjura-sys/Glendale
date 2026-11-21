<?php

namespace App\Services\Spellcheck;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Throwable;

/**
 * Перевірка орфографії текстів адміністрації й модераторів (причини блокувань, відповіді на
 * апеляції, оголошення). Безкоштовно й без лімітів:
 *  1) Hunspell на сервері (apt: hunspell hunspell-uk hunspell-en-us) — завжди, режим «-a» (ispell pipe);
 *  2) LanguageTool — граматика, якщо в Адмінці → Інтеграції вказано адресу (свій сервер або api).
 *     Не відповів / ліміт — мовчки лишаємося з Hunspell.
 * Словник GameCon (resources/dictionaries/gamecon.dic + слова з адмінки) — слова, які не помилка.
 *
 * Позиції (offset, length) — у кодових одиницях UTF-16, як у JavaScript.
 */
class Spellchecker
{
    /** Мова → словник Hunspell. */
    public const DICTIONARIES = ['uk' => 'uk_UA', 'en' => 'en_US'];

    public const MAX_LENGTH = 10000;

    /** Закінчення, з якими слово словника GameCon теж не помилка. */
    private const ENDINGS = ['а', 'у', 'ю', 'я', 'е', 'є', 'і', 'и', 'ї', 'о', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ами', 'ями', 'ів', 'їв', 'ові', 'еві', 'ою', 'ею', 'ці', 'ки', 'ка', 'ку', 'ок', 'ть', 'ти', 'в', 'ла', 'ли', 'ло', 's', 'es', "'s", 'ed', 'ing', 'er', 'ers'];

    private const DIRS = ['/usr/share/hunspell', '/usr/share/myspell', '/usr/share/myspell/dicts'];

    /** @var array<string, true>|null */
    private ?array $words = null;

    private ?string $wordsVersion = null;

    public function __construct(private readonly SiteSettings $settings) {}

    /** Шлях до hunspell або null (шукаємо в PATH без запуску оболонки). */
    public function binary(): ?string
    {
        $configured = (string) config('services.hunspell.path', 'hunspell');
        if (str_contains($configured, '/')) {
            return is_executable($configured) ? $configured : null;
        }
        $dirs = array_unique([...explode(':', (string) getenv('PATH')), '/usr/local/bin', '/usr/bin', '/bin']);
        foreach (array_filter($dirs) as $dir) {
            $path = rtrim($dir, '/').'/'.$configured;
            if (@is_executable($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Встановлені словники Hunspell (uk_UA, en_US).
     *
     * @return list<string>
     */
    public function dictionaries(): array
    {
        $configured = config('services.hunspell.dictionaries');
        if (is_string($configured) && $configured !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $configured))));
        }
        $found = [];
        foreach (self::DICTIONARIES as $name) {
            foreach (self::DIRS as $dir) {
                if (is_file("{$dir}/{$name}.dic") && is_file("{$dir}/{$name}.aff")) {
                    $found[] = $name;
                    break;
                }
            }
        }

        return $found;
    }

    public function available(): bool
    {
        return $this->binary() !== null && $this->dictionaries() !== [];
    }

    public function languageToolUrl(): ?string
    {
        $url = $this->settings->get('languagetool_url') ?: config('services.languagetool.url');

        return is_string($url) && trim($url) !== '' ? rtrim(trim($url), '/') : null;
    }

    /** «Перевірити» в Інтеграціях: Hunspell знаходить помилку в «Привт», LanguageTool (якщо вказано) відповідає. */
    public function test(): bool
    {
        $hunspell = $this->hunspell('Привт', 'uk');
        if ($hunspell === null || $hunspell === []) {
            return false;
        }

        return $this->languageToolUrl() === null || $this->languageTool('Це тест', 'uk') !== null;
    }

    /**
     * @return array{issues: list<array{offset: int, length: int, word: string, suggestions: list<string>, rule: string, message: string}>, engine: string, available: bool}
     */
    public function check(string $text, ?string $lang = null): array
    {
        $text = mb_substr($text, 0, self::MAX_LENGTH);
        $lang = $lang ?? (preg_match('/\p{Cyrillic}/u', $text) ? 'uk' : 'en');

        return Cache::remember('spellcheck.'.sha1($lang.'|'.$this->allowlistVersion().'|'.$text), now()->addMinutes(10), function () use ($text, $lang) {
            $issues = $this->hunspell($text, $lang) ?? [];
            $engine = 'hunspell';
            if ($this->languageToolUrl() !== null) {
                $grammar = $this->languageTool($text, $lang);
                if ($grammar !== null) {
                    $engine = 'languagetool';
                    foreach ($grammar as $issue) {
                        if (! $this->overlaps($issue, $issues)) {
                            $issues[] = $issue;
                        }
                    }
                }
            }
            usort($issues, fn (array $a, array $b) => $a['offset'] <=> $b['offset']);

            return ['issues' => $issues, 'engine' => $engine, 'available' => $this->available() || $engine === 'languagetool'];
        });
    }

    /** Чи слово в словнику GameCon (з формами: «акаунта», «плейлисти»). */
    public function allowed(string $word): bool
    {
        $word = mb_strtolower(str_replace(['’', 'ʼ'], "'", $word));
        $words = $this->allowlist();
        if (isset($words[$word])) {
            return true;
        }
        // Відмінки й множина: основа зі словника + звичне закінчення (акаунт → акаунта, акаунтами).
        foreach ($words as $entry => $_) {
            if (mb_strlen($entry) >= 3 && str_starts_with($word, $entry) && in_array(mb_substr($word, mb_strlen($entry)), self::ENDINGS, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Додати слово до словника адмінки.
     */
    public function addWord(string $word): void
    {
        $current = (string) $this->settings->get('spellcheck_words');
        $lines = array_filter(array_map('trim', preg_split('/\R/', $current) ?: []));
        if (! in_array(mb_strtolower($word), array_map('mb_strtolower', $lines), true)) {
            $lines[] = $word;
        }
        $this->settings->put(['spellcheck_words' => implode("\n", $lines)]);
        $this->words = null;
    }

    /**
     * @return array<string, true>
     */
    private function allowlist(): array
    {
        $version = $this->allowlistVersion();
        if ($this->words !== null && $this->wordsVersion === $version) {
            return $this->words;
        }
        $this->wordsVersion = $version;
        $file = resource_path('dictionaries/gamecon.dic');
        $raw = (is_file($file) ? (string) file_get_contents($file) : '')."\n".(string) $this->settings->get('spellcheck_words');
        $words = [];
        foreach (preg_split('/\R/', $raw) ?: [] as $line) {
            $line = trim($line);
            if ($line !== '' && ! str_starts_with($line, '#')) {
                $words[mb_strtolower(str_replace(['’', 'ʼ'], "'", $line))] = true;
            }
        }

        return $this->words = $words;
    }

    /** Зміна словника в адмінці скидає кеш перевірок. */
    private function allowlistVersion(): string
    {
        return substr(sha1((string) $this->settings->get('spellcheck_words')), 0, 8);
    }

    /**
     * @return list<array{offset: int, length: int, word: string, suggestions: list<string>, rule: string, message: string}>|null null — Hunspell недоступний
     */
    private function hunspell(string $text, string $lang): ?array
    {
        $binary = $this->binary();
        $installed = $this->dictionaries();
        $primary = self::DICTIONARIES[$lang] ?? null;
        if ($binary === null || $primary === null || ! in_array($primary, $installed, true)) {
            return null;
        }
        // Англійські слова в українському тексті — теж перевіряємо (обидва словники разом).
        $dicts = implode(',', array_values(array_unique([$primary, ...array_intersect(['uk_UA', 'en_US'], $installed)])));

        $lines = explode("\n", $this->mask($text));
        // «^» на початку рядка — «перевір цей рядок», щоб символи *, &, # не стали командами.
        $input = implode("\n", array_map(fn (string $l) => '^'.str_replace("\r", ' ', $l), $lines))."\n";
        try {
            $result = Process::timeout(10)->input($input)->run([$binary, '-a', '-i', 'utf-8', '-d', $dicts]);
        } catch (Throwable) {
            return null;
        }
        if (! $result->successful()) {
            return null;
        }

        $issues = [];
        $index = 0;
        $start = 0; // початок поточного рядка в кодових точках
        $output = preg_split('/\R/', $result->output()) ?: [];
        foreach ($output as $i => $row) {
            if ($i === 0 && str_starts_with($row, '@(#)')) {
                continue;
            }
            if ($row === '') {
                // Кінець рядка введення.
                $start += mb_strlen($lines[$index] ?? '') + 1;
                $index++;
                if ($index >= count($lines)) {
                    break;
                }

                continue;
            }
            if (preg_match('/^& (\S+) \d+ (\d+): (.*)$/u', $row, $m)) {
                $word = $m[1];
                $offset = (int) $m[2] - 1;
                $suggestions = array_values(array_filter(array_map('trim', explode(',', $m[3]))));
            } elseif (preg_match('/^# (\S+) (\d+)$/u', $row, $m)) {
                $word = $m[1];
                $offset = (int) $m[2] - 1;
                $suggestions = [];
            } else {
                continue;
            }
            if ($this->ignored($word)) {
                continue;
            }
            $line = $lines[$index] ?? '';
            // Позиція від Hunspell — у символах; звіряємо зі словом і шукаємо поруч, якщо не збіглося.
            if (mb_substr($line, $offset, mb_strlen($word)) !== $word) {
                $found = mb_strpos($line, $word, max(0, $offset - 3));
                if ($found === false) {
                    continue;
                }
                $offset = $found;
            }
            $issues[] = $this->issue($text, $start + $offset, mb_strlen($word), $word, array_slice($suggestions, 0, 6), 'spelling', 'Можлива орфографічна помилка');
        }

        return $issues;
    }

    /**
     * @return list<array{offset: int, length: int, word: string, suggestions: list<string>, rule: string, message: string}>|null
     */
    private function languageTool(string $text, string $lang): ?array
    {
        $url = $this->languageToolUrl();
        if ($url === null) {
            return null;
        }
        $payload = ['text' => $text, 'language' => $lang === 'uk' ? 'uk-UA' : 'en-US'];
        $username = $this->settings->get('languagetool_username') ?: config('services.languagetool.username');
        $key = $this->settings->secret('languagetool_key') ?? config('services.languagetool.key');
        if (is_string($username) && $username !== '' && is_string($key) && $key !== '') {
            $payload['username'] = $username;
            $payload['apiKey'] = $key;
        }
        try {
            $response = Http::timeout(8)->connectTimeout(3)->acceptJson()->asForm()->post($url.'/v2/check', $payload);
        } catch (ConnectionException) {
            return null;
        }
        $matches = $response->successful() ? $response->json('matches') : null;
        if (! is_array($matches)) {
            return null;
        }

        $utf16 = (string) mb_convert_encoding($text, 'UTF-16LE', 'UTF-8');
        $issues = [];
        foreach ($matches as $match) {
            if (! is_array($match) || ! isset($match['offset'], $match['length'])) {
                continue;
            }
            $offset = (int) $match['offset'];
            $length = (int) $match['length'];
            $word = (string) mb_convert_encoding(substr($utf16, $offset * 2, $length * 2), 'UTF-8', 'UTF-16LE');
            $rule = is_array($match['rule'] ?? null) ? $match['rule'] : [];
            $spelling = ($rule['issueType'] ?? null) === 'misspelling';
            if ($spelling && $this->ignored($word)) {
                continue;
            }
            $suggestions = [];
            foreach (is_array($match['replacements'] ?? null) ? array_slice($match['replacements'], 0, 6) : [] as $r) {
                if (is_array($r) && is_string($r['value'] ?? null)) {
                    $suggestions[] = $r['value'];
                }
            }
            $issues[] = [
                'offset' => $offset, 'length' => $length, 'word' => $word, 'suggestions' => $suggestions,
                'rule' => $spelling ? 'spelling' : 'grammar',
                'message' => is_string($match['message'] ?? null) ? $match['message'] : 'Можлива помилка',
            ];
        }

        return $issues;
    }

    /** Абревіатури (GTA, RP), слова з цифрами й слова зі словника GameCon — не помилки. */
    private function ignored(string $word): bool
    {
        if (preg_match('/\d/u', $word)) {
            return true;
        }
        if (mb_strlen($word) <= 5 && mb_strtoupper($word) === $word) {
            return true;
        }

        return $this->allowed($word);
    }

    /**
     * Посилання, пошта, @згадки, #хештеги й підстановки {name} — пробілами тієї ж довжини
     * (позиції решти слів не зсуваються).
     */
    private function mask(string $text): string
    {
        return (string) preg_replace_callback(
            '~https?://\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+|[@#][\p{L}\p{N}_.]+|\{\w+\}|:[a-z_]+\b~u',
            fn (array $m) => str_repeat(' ', mb_strlen($m[0])),
            $text,
        );
    }

    /**
     * Помилка з позицією в кодових одиницях UTF-16 (символи поза BMP, як емодзі, — це 2 одиниці).
     *
     * @param  list<string>  $suggestions
     * @return array{offset: int, length: int, word: string, suggestions: list<string>, rule: string, message: string}
     */
    private function issue(string $text, int $codepoint, int $chars, string $word, array $suggestions, string $rule, string $message): array
    {
        $units = fn (string $s) => intdiv(strlen((string) mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);

        return [
            'offset' => $units(mb_substr($text, 0, $codepoint)),
            'length' => $units(mb_substr($text, $codepoint, $chars)),
            'word' => $word,
            'suggestions' => $suggestions,
            'rule' => $rule,
            'message' => $message,
        ];
    }

    /**
     * @param  array{offset: int, length: int}  $issue
     * @param  list<array{offset: int, length: int}>  $issues
     */
    private function overlaps(array $issue, array $issues): bool
    {
        foreach ($issues as $other) {
            if ($issue['offset'] < $other['offset'] + $other['length'] && $other['offset'] < $issue['offset'] + $issue['length']) {
                return true;
            }
        }

        return false;
    }
}
