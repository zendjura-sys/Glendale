<?php

namespace App\Jobs;

use App\Models\PushDevice;
use App\Services\Push\FcmClient;
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

    public function handle(FcmClient $fcm): void
    {
        if (! $fcm->configured()) {
            return;
        }

        PushDevice::query()->where('user_id', $this->userId)->latest('id')->limit(10)->get()
            ->each(function (PushDevice $device) use ($fcm) {
                $result = $fcm->send($device->token, $this->title, $this->body, $this->data, $this->channel, $this->tag, $this->dataOnly && $device->local_render && $device->platform === 'android');
                match ($result) {
                    FcmClient::GONE => $device->delete(),
                    FcmClient::SENT => $device->forceFill(['last_used_at' => now()])->saveQuietly(),
                    default => null,
                };
            });
    }
}
