<?php

namespace App\Jobs;

use App\Models\PushDevice;
use App\Models\User;
use App\Models\WebPushSubscription;
use App\Services\Push\FcmClient;
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
    ) {}

    public function handle(FcmClient $fcm, ?WebPush $web = null): void
    {
        $web ??= app(WebPush::class);

        // Заголовок і текст — мовою отримувача.
        $user = User::query()->find($this->userId);
        $locale = $user instanceof User ? app(Locales::class)->forUser($user) : app(Locales::class)->fallback();
        $translations = app(Translations::class);
        $title = $translations->line($this->title, $locale);
        $body = $translations->line($this->body, $locale);

        $this->toBrowsers($web, $title, $body);
        if (! $fcm->configured()) {
            return;
        }

        PushDevice::query()->where('user_id', $this->userId)->latest('id')->limit(10)->get()
            ->each(function (PushDevice $device) use ($fcm, $title, $body) {
                $result = $fcm->send($device->token, $title, $body, $this->data, $this->channel, $this->tag, $this->dataOnly && $device->local_render && $device->platform === 'android');
                match ($result) {
                    FcmClient::GONE => $device->delete(),
                    FcmClient::SENT => $device->forceFill(['last_used_at' => now()])->saveQuietly(),
                    default => null,
                };
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
            });
    }
}
