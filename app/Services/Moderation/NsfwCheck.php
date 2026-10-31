<?php

namespace App\Services\Moderation;

use App\Models\ImageFlag;
use App\Models\Photo;
use App\Models\PostAttachment;
use App\Services\Ai\AiAssistant;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Автоперевірка фото на відвертий вміст через Sightengine (модель nudity-2.1).
 * Від 0.5 — фото розмивається з позначкою «чутливий вміст»; від 0.85 — ще й іде модераторам.
 * Без ключів у адмінці нічого не робить.
 */
class NsfwCheck
{
    public const BLUR = 0.5;

    public const FLAG = 0.85;

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->sightengine() || $this->viaAi();
    }

    private function sightengine(): bool
    {
        return filled($this->settings->get('sightengine_user')) && $this->settings->secret('sightengine_secret') !== null;
    }

    /** Без Sightengine фото оцінює ШІ сайту, якщо ввімкнено «ШІ-модерацію». */
    private function viaAi(): bool
    {
        return app(Plugins::class)->on('ai_moderation');
    }

    /** Ймовірність відвертого вмісту 0..1 або null, якщо перевірити не вдалося. */
    public function score(string $path): ?float
    {
        if (! Storage::disk('public')->exists($path)) {
            return null;
        }
        if (! $this->sightengine()) {
            return $this->viaAi() ? app(AiAssistant::class)->imageScore($path) : null;
        }
        try {
            $response = Http::timeout(20)
                ->attach('media', Storage::disk('public')->get($path) ?? '', basename($path))
                ->post(rtrim((string) config('services.sightengine.url', 'https://api.sightengine.com'), '/').'/1.0/check.json', [
                    'models' => 'nudity-2.1',
                    'api_user' => (string) $this->settings->get('sightengine_user'),
                    'api_secret' => (string) $this->settings->secret('sightengine_secret'),
                ]);
        } catch (Throwable) {
            return null;
        }
        $nudity = $response->json('nudity');
        if (! is_array($nudity)) {
            return null;
        }
        $explicit = max((float) ($nudity['sexual_activity'] ?? 0), (float) ($nudity['sexual_display'] ?? 0), (float) ($nudity['erotica'] ?? 0));
        $suggestive = (float) ($nudity['very_suggestive'] ?? 0) * 0.8;

        return round(max($explicit, $suggestive), 3);
    }

    public function checkPhoto(Photo $photo): void
    {
        $score = $this->score($photo->path);
        if ($score === null || $score < self::BLUR) {
            return;
        }
        $photo->forceFill(['is_sensitive' => true])->save();
        if ($score >= self::FLAG) {
            $this->flag('photo', $photo->id, $photo->user_id, $photo->path, $score);
        }
    }

    public function checkPostImage(PostAttachment $attachment): void
    {
        $score = $this->score($attachment->path);
        if ($score !== null && $score >= self::FLAG) {
            $this->flag('post_image', $attachment->id, $attachment->post?->author_id, $attachment->path, $score);
        }
    }

    public function test(): bool
    {
        try {
            return Http::timeout(10)->get(rtrim((string) config('services.sightengine.url', 'https://api.sightengine.com'), '/').'/1.0/check.json', [
                'models' => 'nudity-2.1',
                'url' => 'https://sightengine.com/assets/img/examples/example-tt-1000.jpg',
                'api_user' => (string) $this->settings->get('sightengine_user'),
                'api_secret' => (string) $this->settings->secret('sightengine_secret'),
            ])->json('status') === 'success';
        } catch (Throwable) {
            return false;
        }
    }

    private function flag(string $kind, int $id, ?int $userId, string $path, float $score): void
    {
        ImageFlag::query()->updateOrCreate(['kind' => $kind, 'subject_id' => $id], [
            'user_id' => $userId,
            'path' => $path,
            'score' => $score,
            'status' => ImageFlag::PENDING,
        ]);
    }
}
