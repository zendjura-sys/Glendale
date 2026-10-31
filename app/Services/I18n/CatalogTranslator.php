<?php

namespace App\Services\I18n;

use App\Models\Translation;
use App\Support\I18n\Translations;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Автопереклад каталогу інтерфейсу на мову через DeepL (коли його ліміт вичерпано — через
 * LibreTranslate, див. Translator): лише відсутні рядки (або всі, крім виправлених вручну).
 * Прогрес видно в Адмінці → Мови.
 */
class CatalogTranslator
{
    /** Скільки ключів перекладаємо за один прохід (кожен прохід — кілька запитів до перекладача). */
    private const CHUNK = 200;

    public function __construct(private readonly Translator $translator, private readonly Translations $translations) {}

    /**
     * @return array{done: int, total: int, running: bool, error: string|null, finished_at: string|null}
     */
    public function progress(string $locale): array
    {
        $stored = Cache::get("i18n.progress.{$locale}");

        return is_array($stored) ? [
            'done' => (int) ($stored['done'] ?? 0),
            'total' => (int) ($stored['total'] ?? 0),
            'running' => (bool) ($stored['running'] ?? false),
            'error' => isset($stored['error']) ? (string) $stored['error'] : null,
            'finished_at' => isset($stored['finished_at']) ? (string) $stored['finished_at'] : null,
        ] : ['done' => 0, 'total' => 0, 'running' => false, 'error' => null, 'finished_at' => null];
    }

    /**
     * Скільки рядків каталогу вже перекладено.
     *
     * @return array{translated: int, manual: int, total: int}
     */
    public function stats(string $locale): array
    {
        $catalog = $this->translations->catalog();
        $hashes = array_flip(array_map(fn (string $k) => Translation::hashOf($k), $catalog));
        $rows = Translation::query()->where('locale', $locale)->get(['hash', 'is_manual']);
        $translated = $rows->filter(fn (Translation $t) => isset($hashes[$t->hash]))->count();

        return ['translated' => $translated, 'manual' => $rows->where('is_manual', true)->count(), 'total' => count($catalog)];
    }

    /**
     * @return array{translated: int, error: string|null}
     */
    public function run(string $locale, bool $all = false): array
    {
        if (! $this->translator->available()) {
            return $this->finish($locale, 0, 0, 'Немає робочого перекладача. Додайте ключ DeepL чи Azure в Адмінці → Інтеграції або увімкніть перекладач в Адмінці → Мови.');
        }
        if (! $this->translator->supports($locale)) {
            return $this->finish($locale, 0, 0, 'Перекладач не знає цієї мови — заповніть переклади вручну.');
        }
        $engines = [];

        $existing = Translation::query()->where('locale', $locale)->get(['hash', 'is_manual'])->keyBy('hash');
        $todo = array_values(array_filter($this->translations->catalog(), function (string $key) use ($existing, $all) {
            $row = $existing->get(Translation::hashOf($key));

            return $row === null || ($all && ! $row->is_manual);
        }));
        $total = count($todo);
        $done = 0;
        $this->save($locale, ['done' => 0, 'total' => $total, 'running' => true]);

        foreach (array_chunk($todo, self::CHUNK) as $chunk) {
            // Множина «друг|друзі|друзів» — кожна форма окремо.
            $texts = [];
            foreach ($chunk as $key) {
                foreach (explode('|', $key) as $part) {
                    $texts[] = $part;
                }
            }
            $translated = $this->translator->interface($texts, $locale);
            if ($translated === null) {
                Log::warning('i18n: translate failed', ['locale' => $locale, 'done' => $done, 'total' => $total]);

                return $this->finish($locale, $done, $total, 'Переклад зупинився: '.$this->translator->lastError().'. Решту можна докласти пізніше.');
            }
            $result = $translated['texts'];
            $engines[$translated['engine']] = ($engines[$translated['engine']] ?? 0) + count($chunk);
            $i = 0;
            $now = now();
            $rows = [];
            foreach ($chunk as $key) {
                $parts = [];
                foreach (explode('|', $key) as $_) {
                    $parts[] = $result[$i++] ?? '';
                }
                $rows[] = ['locale' => $locale, 'hash' => Translation::hashOf($key), 'source' => $key, 'value' => implode('|', $parts), 'is_manual' => false, 'created_at' => $now, 'updated_at' => $now];
            }
            Translation::query()->upsert($rows, ['locale', 'hash'], ['source', 'value', 'updated_at']);
            $done += count($chunk);
            $this->save($locale, ['done' => $done, 'total' => $total, 'running' => true]);
            $this->translations->touch($locale);
        }

        // Рядки, яких більше немає в каталозі, — прибираємо (виправлені вручну лишаються).
        $hashes = array_map(fn (string $k) => Translation::hashOf($k), $this->translations->catalog());
        Translation::query()->where('locale', $locale)->where('is_manual', false)->whereNotIn('hash', $hashes)->delete();
        $this->translations->touch($locale);
        if ($engines !== []) {
            Log::info('i18n: translated', ['locale' => $locale, 'engines' => $engines]);
        }

        return $this->finish($locale, $done, $total, null);
    }

    /**
     * @return array{translated: int, error: string|null}
     */
    private function finish(string $locale, int $done, int $total, ?string $error): array
    {
        $this->save($locale, ['done' => $done, 'total' => $total, 'running' => false, 'error' => $error, 'finished_at' => now()->toIso8601String()]);

        return ['translated' => $done, 'error' => $error];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function save(string $locale, array $state): void
    {
        Cache::put("i18n.progress.{$locale}", $state, now()->addDays(7));
    }
}
