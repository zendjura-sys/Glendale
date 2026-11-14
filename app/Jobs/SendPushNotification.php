<?php

namespace App\Jobs;

use App\Models\PushDevice;
use App\Models\User;
use App\Models\WebPushSubscription;
use App\Services\Push\FcmClient;
use App\Services\Push\PushStats;
use App\Services\Push\WebPush;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Надсилає одне push-сповіщення на всі пристрої користувача. Йде через чергу,
 * щоб відповідь сайту не чекала на Firebase.
 */
class SendPushNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 60;

    /**
     * @param  array<string, string>  $data
     */
    public function __construct(
        public readonly int $userId,
        public readonly string $title,
        public readonly string $body,
        public readonly array $data,
        public readonly string $channel,
        public readonly ?string $tag = null,
        public readonly bool $dataOnly = false,
        /** Лише в застосунок (без push у браузери). */
        public readonly bool $appOnly = false,
        /** Скільки секунд пуш актуальний (тривоги): пізніше — не надсилається й не доставляється. */
        public readonly ?int $ttl = null,
    ) {}

    public function handle(FcmClient $fcm, ?WebPush $web = null): void
    {
        $web ??= app(WebPush::class);
        // Застаріле термінове сповіщення (тривога, відбій) не надсилаємо «заднім числом».
        $expires = $this->data['expires_at'] ?? null;
        if (is_string($expires) && is_numeric($expires) && (int) $expires < now()->getTimestamp()) {
            PushStats::hit('app', 'expired', $this->kind());

            return;
        }

        // Заголовок і текст — мовою отримувача.
        $user = User::query()->find($this->userId);
        $locale = $user instanceof User ? app(Locales::class)->forUser($user) : app(Locales::class)->fallback();
        $translations = app(Translations::class);
        $title = $translations->line($this->title, $locale);
        $body = $translations->line($this->body, $locale);

        if (! $this->appOnly) {
            $this->toBrowsers($web, $title, $body);
        }
        if (! $fcm->configured()) {
            return;
        }

        PushDevice::query()->where('user_id', $this->userId)->latest('id')->limit(10)->get()
            ->each(function (PushDevice $device) use ($fcm, $title, $body) {
                // Тривогу data-повідомленням — лише застосунку, що вміє її малювати (alert_render), іншим — звичайний пуш.
                $alert = str_starts_with((string) ($this->data['kind'] ?? ''), 'air_alert');
                $local = $this->dataOnly && $device->local_render && $device->platform === 'android' && (! $alert || $device->alert_render);
                $result = $fcm->send($device->token, $title, $body, $this->data, $this->channel, $this->tag, $local, $this->ttl);
                match ($result) {
                    FcmClient::GONE => $device->delete(),
                    FcmClient::SENT => $device->forceFill(['last_used_at' => now()])->saveQuietly(),
                    default => null,
                };
                PushStats::hit('app', match ($result) {
                    FcmClient::SENT => 'sent',
                    FcmClient::GONE => 'gone',
                    default => 'failed',
                }, $this->kind());
            });
    }

    /** Те саме сповіщення в браузери, де людина ввімкнула сповіщення сайту. */
    private function toBrowsers(WebPush $web, string $title, string $body): void
    {
        WebPushSubscription::query()->where('user_id', $this->userId)->latest('id')->limit(10)->get()
            ->each(function (WebPushSubscription $subscription) use ($web, $title, $body) {
                $result = $web->send($subscription, [
                    'title' => $title,
                    'body' => $body,
                    'url' => $this->data['url'] ?? '/notifications',
                    'tag' => $this->tag,
                ], $this->tag);
                match ($result) {
                    WebPush::GONE => $subscription->delete(),
                    WebPush::SENT => $subscription->forceFill(['last_used_at' => now()])->saveQuietly(),
                    default => null,
                };
                PushStats::hit('web', match ($result) {
                    WebPush::SENT => 'sent',
                    WebPush::GONE => 'gone',
                    default => 'failed',
                }, $this->kind());
            });
    }

    private function kind(): string
    {
        return (string) ($this->data['kind'] ?? $this->data['type'] ?? 'other');
    }
}
