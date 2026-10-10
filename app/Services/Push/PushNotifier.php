<?php

namespace App\Services\Push;

use App\Jobs\SendPushNotification;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\Family;
use App\Models\Message;
use App\Models\PushDevice;
use App\Models\User;
use App\Models\WebPushSubscription;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;

/**
 * Дублює сповіщення сайту (дзвіночок) і нові повідомлення чату в push застосунку.
 * Текст той самий, що на сайті, — окремої логіки сповіщень немає.
 */
class PushNotifier
{
    public const CHANNEL_MESSAGES = 'messages';

    public const CHANNEL_ACTIVITY = 'activity';

    /** Вхідні дзвінки: окремий канал із мелодією й показом поверх екрана. */
    public const CHANNEL_CALLS = 'calls';

    public function __construct(private readonly FcmClient $fcm) {}

    /**
     * Нове сповіщення в базі (лайк, коментар, заявка в друзі, події сім’ї…).
     */
    public function notification(object $notifiable, DatabaseNotification $notification): void
    {
        if (! $notifiable instanceof User || ! $this->reachable($notifiable->id)) {
            return;
        }

        $data = $notification->data;
        $title = $this->sender($data);
        // Текст сповіщення — мовою отримувача.
        $text = app(Translations::class)->line(trim((string) ($data['text'] ?? '')), app(Locales::class)->forUser($notifiable));
        $excerpt = trim((string) ($data['excerpt'] ?? ''));
        $body = Str::limit($excerpt !== '' ? "{$text}: «{$excerpt}»" : $text, 180);

        if ($body === '') {
            return;
        }

        SendPushNotification::dispatch(
            $notifiable->id,
            $title,
            Str::ucfirst($body),
            [
                'type' => 'notification',
                'id' => (string) $notification->id,
                'kind' => (string) ($data['kind'] ?? 'generic'),
                'url' => (string) ($data['url'] ?? '/notifications'),
            ],
            self::CHANNEL_ACTIVITY,
        );
    }

    /**
     * Нове повідомлення в чаті: усім учасникам, крім автора й тих, хто вимкнув звук.
     *
     * @param  array<string, mixed>  $payload  повідомлення у форматі MessengerPresenter::message
     */
    public function message(Conversation $conversation, Message $message, array $payload): void
    {
        if ($message->user_id === null) {
            return;
        }

        $recipients = $conversation->activeParticipants()
            ->where('user_id', '!=', $message->user_id)
            ->where('is_muted', false)
            ->pluck('user_id')
            ->all();
        $recipients = array_values(array_unique([
            ...($this->fcm->configured() ? PushDevice::query()->whereIn('user_id', $recipients)->distinct()->pluck('user_id')->all() : []),
            ...WebPushSubscription::query()->whereIn('user_id', $recipients)->distinct()->pluck('user_id')->all(),
        ]));
        if ($recipients === []) {
            return;
        }

        $author = (string) ($payload['user']['name'] ?? 'GameCon');
        $preview = Str::limit((string) ($payload['preview'] ?? 'Повідомлення'), 180);
        $group = $conversation->isGroup();
        $title = $group ? (string) ($conversation->title ?: 'Бесіда') : $author;
        $body = $group ? ($payload['user']['first_name'] ?? $author).': '.$preview : $preview;

        foreach ($recipients as $userId) {
            SendPushNotification::dispatch(
                (int) $userId,
                $title,
                $body,
                [
                    'type' => 'message',
                    'conversation_id' => (string) $conversation->id,
                    'message_id' => (string) $message->id,
                    'author' => $author,
                    'text' => $preview,
                    'group' => $group ? '1' : '0',
                    'url' => '/messages/'.$conversation->id,
                ],
                self::CHANNEL_MESSAGES,
                'chat-'.$conversation->id,
                dataOnly: true,
            );
        }
    }

    private function reachable(int $userId): bool
    {
        return ($this->fcm->configured() && PushDevice::query()->where('user_id', $userId)->exists())
            || WebPushSubscription::query()->where('user_id', $userId)->exists();
    }

    /**
     * Заголовок як у списку сповіщень сайту: ім’я автора, [ТЕГ] сім’ї або назва спільноти.
     *
     * @param  array<string, mixed>  $data
     */
    private function sender(array $data): string
    {
        $actorId = $this->modelId($data['actor_id'] ?? null);
        if ($actorId !== null) {
            $actor = User::query()->find($actorId);
            if ($actor instanceof User) {
                return $actor->name;
            }
        }

        $familyId = $this->modelId($data['family_id'] ?? null);
        if ($familyId !== null) {
            $family = Family::query()->find($familyId);
            if ($family instanceof Family) {
                return '['.$family->tag.'] '.$family->name;
            }
        }

        $communityId = $this->modelId($data['community_id'] ?? null);
        if ($communityId !== null) {
            $community = Community::query()->find($communityId);
            if ($community instanceof Community) {
                return $community->name;
            }
        }

        return 'GameCon';
    }

    private function modelId(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && ctype_digit($value)) {
            return (int) $value;
        }

        return null;
    }
}
