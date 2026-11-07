<?php

namespace App\Services\Alerts;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Стан тривог без ключа API: офіційний публічний канал «Повітряна тривога» (t.me/s/air_alert_ua) —
 * кожен допис «🔴 Повітряна тривога в …» / «🟢 Відбій тривоги в …» для області, району чи громади.
 * Дописи читаємо по порядку й ведемо стан «що зараз активне» в кеші.
 */
class AirAlertChannel
{
    /** Скільки сторінок каналу читати при першому запуску (по ~20 дописів). */
    public const BOOT_PAGES = 5;

    /** Стан вважаємо свіжим, якщо канал читали не пізніше ніж стільки хвилин тому. */
    public const FRESH_MINUTES = 5;

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly AirAlertService $alerts,
    ) {}

    public function channel(): string
    {
        $raw = (string) ($this->settings->get('alerts_status_channel') ?: 'air_alert_ua');

        return preg_replace('/[^A-Za-z0-9_]/', '', ltrim(trim($raw), '@')) ?: 'air_alert_ua';
    }

    /**
     * Нові дописи каналу → оновлений стан. Повертає кількість застосованих подій.
     */
    public function sync(): int
    {
        $last = (int) Cache::get('alerts.channel.last', 0);
        $posts = [];
        $before = null;
        for ($page = 0; $page < ($last === 0 ? self::BOOT_PAGES : 2); $page++) {
            $batch = $this->fetch($before);
            if ($batch === null) {
                return 0;
            }
            $posts = [...$batch, ...$posts];
            $oldest = $batch === [] ? null : min(array_column($batch, 'id'));
            // Дійшли до вже прочитаного або канал закінчився.
            if ($oldest === null || $oldest <= $last || count($batch) < 5) {
                break;
            }
            $before = $oldest;
        }
        usort($posts, fn (array $a, array $b) => $a['id'] <=> $b['id']);
        /** @var array<string, array{oblast: string, level: int, code: string|null, kind: string, started_at: string|null}> $state */
        $state = (array) Cache::get('alerts.channel.state', []);
        $applied = 0;
        foreach ($posts as $post) {
            if ($post['id'] <= $last) {
                continue;
            }
            $event = $this->parse($post['text']);
            $last = $post['id'];
            if ($event === null) {
                continue;
            }
            $key = $event['oblast'].'|'.$event['level'].'|'.($event['code'] ?? '').'|'.$event['kind'];
            if ($event['start']) {
                $state[$key] = [
                    'oblast' => $event['oblast'],
                    'level' => $event['level'],
                    'code' => $event['code'],
                    'kind' => $event['kind'],
                    'started_at' => $post['at'],
                ];
            } else {
                unset($state[$key]);
            }
            $applied++;
        }
        Cache::forever('alerts.channel.state', $state);
        Cache::forever('alerts.channel.last', $last);
        Cache::put('alerts.channel.synced', now()->toIso8601String(), now()->addMinutes(self::FRESH_MINUTES));
        if ($applied > 0) {
            Log::info('alerts: channel', ['events' => $applied, 'active' => count($state)]);
        }

        return $applied;
    }

    /** Чи читали канал нещодавно (інакше стан може бути застарілим). */
    public function fresh(): bool
    {
        return Cache::has('alerts.channel.synced');
    }

    /**
     * Активні тривоги з каналу в загальному форматі рядків.
     *
     * @return list<array{oblast: string, level: int, code: string|null, kind: string, started_at: string|null}>
     */
    public function rows(): array
    {
        $rows = [];
        foreach ((array) Cache::get('alerts.channel.state', []) as $row) {
            if (is_array($row) && is_string($row['oblast'] ?? null) && is_int($row['level'] ?? null) && is_string($row['kind'] ?? null)) {
                $rows[] = [
                    'oblast' => $row['oblast'],
                    'level' => $row['level'],
                    'code' => is_string($row['code'] ?? null) ? $row['code'] : null,
                    'kind' => $row['kind'],
                    'started_at' => is_string($row['started_at'] ?? null) ? $row['started_at'] : null,
                ];
            }
        }

        return $rows;
    }

    /**
     * Сторінка каналу (новіші за $before немає — лише старіші, якщо задано).
     *
     * @return list<array{id: int, text: string, at: string}>|null
     */
    private function fetch(?int $before): ?array
    {
        try {
            $response = Http::timeout(6)->withHeaders(['Accept-Language' => 'uk'])
                ->get('https://t.me/s/'.$this->channel(), $before !== null ? ['before' => $before] : []);
        } catch (ConnectionException) {
            return null;
        }
        if (! $response->successful()) {
            return null;
        }
        $posts = [];
        foreach ($this->alerts->parseChannel($response->body()) as $post) {
            $posts[] = ['id' => (int) explode('/', $post['ref'])[1], 'text' => $post['text'], 'at' => $post['at']->toIso8601String()];
        }

        return $posts;
    }

    /**
     * «🔴 21:14 Повітряна тривога в Бучанський район. … #Київська_область» → подія.
     *
     * @return array{start: bool, kind: string, oblast: string, level: int, code: string|null}|null
     */
    public function parse(string $text): ?array
    {
        $line = trim(strtok($text, "\n") ?: $text);
        // «Повітряна тривога в …», «Загроза артобстрілу в …», «Відбій загрози вуличних боїв в …».
        if (preg_match('/(тривог|загроз)\w*(?:\s+[^\s.]+){0,2}?\s+(в|у)\s+(.+?)\.?\s*$/iu', $line, $m) !== 1) {
            return null;
        }
        $lower = mb_strtolower($line);
        $start = ! str_contains($lower, 'відбій');
        $kind = match (true) {
            str_contains($lower, 'артобстріл') => 'artillery',
            str_contains($lower, 'вуличн') => 'urban_fights',
            str_contains($lower, 'хімічн') => 'chemical',
            str_contains($lower, 'радіаційн') => 'nuclear',
            default => 'air_raid',
        };
        $place = trim($m[3]);
        $hint = preg_match('/#([\p{L}\-’\']+)_област/u', $text, $tag) === 1 ? $this->alerts->slugFor($tag[1].' область') : null;
        // «м. Харків та Харківська територіальна громада» — беремо громаду.
        if (str_contains($place, ' та ')) {
            $place = trim((string) mb_substr($place, (int) mb_strrpos($place, ' та ') + 4));
        }
        $placeLower = mb_strtolower($place);
        if (str_contains($placeLower, 'район')) {
            $found = AlertUnits::locate(2, $place, $hint);

            return $found === null ? null : ['start' => $start, 'kind' => $kind, 'oblast' => $found['oblast'], 'level' => 2, 'code' => $found['code']];
        }
        if (str_contains($placeLower, 'громад')) {
            $found = AlertUnits::locate(3, $place, $hint);

            return $found === null ? null : ['start' => $start, 'kind' => $kind, 'oblast' => $found['oblast'], 'level' => 3, 'code' => $found['code']];
        }
        $slug = $this->alerts->slugFor($place);

        return $slug === null ? null : ['start' => $start, 'kind' => $kind, 'oblast' => $slug, 'level' => 1, 'code' => null];
    }
}
