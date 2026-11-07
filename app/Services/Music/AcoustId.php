<?php

namespace App\Services\Music;

use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Throwable;

/**
 * Розпізнавання треку за звуком: відбиток Chromaprint (fpcalc) → AcoustID → MBID запису MusicBrainz.
 * Потрібні fpcalc на сервері (deploy/remote.sh ставить libchromaprint-tools) і ключ застосунку
 * AcoustID (Адмінка → Інтеграції). Без них — просто нічого не знаходить.
 */
class AcoustId
{
    public function __construct(
        private readonly SiteSettings $settings,
        private readonly AudioProbe $probe,
    ) {}

    public function key(): ?string
    {
        return $this->settings->secret('acoustid_key') ?: config('services.acoustid.key');
    }

    public function configured(): bool
    {
        return filled($this->key());
    }

    public function available(): bool
    {
        return $this->configured() && $this->probe->fpcalc() !== null;
    }

    /**
     * Відбиток файлу: {duration, fingerprint} або null.
     *
     * @return array{duration: int, fingerprint: string}|null
     */
    public function fingerprint(string $file): ?array
    {
        $fpcalc = $this->probe->fpcalc();
        if ($fpcalc === null || ! is_file($file)) {
            return null;
        }

        try {
            $result = Process::timeout(30)->run([$fpcalc, '-json', '-length', '120', $file]);
        } catch (Throwable) {
            return null;
        }
        $data = $result->successful() ? json_decode($result->output(), true) : null;
        if (! is_array($data) || blank($data['fingerprint'] ?? null) || (float) ($data['duration'] ?? 0) <= 0) {
            return null;
        }

        return ['duration' => (int) round((float) $data['duration']), 'fingerprint' => (string) $data['fingerprint']];
    }

    /**
     * Записи, що відповідають відбитку: {score 0–1, mbid, title, artist, artist_mbid, duration}, найкращий першим.
     *
     * @return list<array{score: float, mbid: string, title: string, artist: string, artist_mbid: string|null, duration: int|null}>
     */
    public function lookup(string $fingerprint, int $duration): array
    {
        $key = $this->key();
        if (! $key) {
            return [];
        }
        $cacheKey = 'music.acoustid.'.md5($fingerprint.'|'.$duration);
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return array_values($cached);
        }

        try {
            $response = Http::asForm()->timeout(10)->acceptJson()->post(rtrim((string) config('services.acoustid.url'), '/').'/lookup', [
                'client' => $key,
                'meta' => 'recordings+releasegroups+compress',
                'duration' => $duration,
                'fingerprint' => $fingerprint,
                'format' => 'json',
            ]);
            $data = $response->json();
        } catch (Throwable $e) {
            Log::warning('AcoustID недоступний', ['error' => $e->getMessage()]);

            return [];
        }
        if (! is_array($data) || ($data['status'] ?? '') !== 'ok') {
            Log::warning('AcoustID відхилив запит', ['error' => is_array($data) ? ($data['error']['message'] ?? null) : null]);

            return [];
        }

        $found = [];
        foreach ((array) ($data['results'] ?? []) as $result) {
            $score = (float) ($result['score'] ?? 0);
            foreach ((array) ($result['recordings'] ?? []) as $recording) {
                if (! is_array($recording) || blank($recording['id'] ?? null) || blank($recording['title'] ?? null)) {
                    continue;
                }
                $artists = array_values(array_filter((array) ($recording['artists'] ?? []), 'is_array'));
                $found[] = [
                    'score' => $score,
                    'mbid' => (string) $recording['id'],
                    'title' => (string) $recording['title'],
                    'artist' => trim(implode('', array_map(fn ($a) => ($a['name'] ?? '').($a['joinphrase'] ?? ''), $artists))),
                    'artist_mbid' => $artists[0]['id'] ?? null,
                    'duration' => isset($recording['duration']) ? (int) round((float) $recording['duration']) : null,
                ];
            }
        }
        usort($found, fn ($a, $b) => $b['score'] <=> $a['score']);
        Cache::put($cacheKey, $found, now()->addDays($found ? 30 : 7));

        return $found;
    }

    /** Перевірка ключа в адмінці: AcoustID відповідає «ok» (код 4 — неправильний ключ застосунку). */
    public function test(): bool
    {
        $key = $this->key();
        if (! $key) {
            return false;
        }

        try {
            $data = Http::timeout(10)->acceptJson()->get(rtrim((string) config('services.acoustid.url'), '/').'/lookup', [
                'client' => $key,
                'trackid' => '9ff43b6a-4f16-427c-93c2-92307ca505e0',
                'format' => 'json',
            ])->json();
        } catch (Throwable) {
            return false;
        }

        return is_array($data) && (($data['status'] ?? '') === 'ok' || ! in_array((int) ($data['error']['code'] ?? 0), [4, 0], true));
    }
}
