<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\PhotoInteraction;
use App\Notifications\PostInteraction;
use App\Services\Push\PushNotifier;
use App\Support\NotifyPrefs;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Кілька реакцій на той самий запис чи фото збираються в одне сповіщення.
 */
class ReactionDigest
{
    /** На цих кількостях — один пуш-підсумок («10 людей оцінили…»). */
    public const MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000];

    public function record(User $author, PostInteraction|PhotoInteraction $notification): void
    {
        if ($author->is($notification->actor) || ! NotifyPrefs::allowsKind($author, $notification->kind)) {
            return;
        }

        $fresh = $notification->toArray($author);
        $existing = $author->unreadNotifications()
            ->where('type', $notification::class)
            ->latest()
            ->limit(40)
            ->get()
            ->first(fn (DatabaseNotification $row) => $this->sameSubject($row->data, $fresh));

        if ($existing instanceof DatabaseNotification) {
            $payload = $existing->data;
            // Хто саме: останні три різні людини (для «Олена, Петро та ще 3»), без повторів того самого.
            $actors = array_values(array_unique([$notification->actor->id, ...array_map('intval', (array) ($payload['actor_ids'] ?? [$payload['actor_id'] ?? 0]))]));
            $actors = array_values(array_filter($actors));
            $repeat = in_array($notification->actor->id, (array) ($payload['actor_ids'] ?? [$payload['actor_id'] ?? 0]), false);
            $count = max(1, (int) ($payload['count'] ?? 1)) + ($repeat ? 0 : 1);
            $payload['count'] = $count;
            $payload['actor_id'] = $notification->actor->id;
            $payload['actor_ids'] = array_slice($actors, 0, 3);
            $payload['text'] = $this->text((string) $fresh['kind'], $count);
            if (isset($fresh['excerpt'])) {
                $payload['excerpt'] = $fresh['excerpt'];
            }
            $existing->forceFill(['data' => $payload, 'created_at' => now()])->save();
            // Без пушу на кожну оцінку: лише підсумок на круглих числах.
            if (! $repeat && in_array($count, self::MILESTONES, true)) {
                rescue(fn () => app(PushNotifier::class)->notification($author, $existing), report: false);
            }

            return;
        }

        $author->notify($notification);
    }

    /**
     * @param  array<string, mixed>  $stored
     * @param  array<string, mixed>  $fresh
     */
    private function sameSubject(array $stored, array $fresh): bool
    {
        if (($stored['kind'] ?? null) !== ($fresh['kind'] ?? null)) {
            return false;
        }

        foreach (['post_id', 'photo_id'] as $key) {
            if (isset($fresh[$key]) && (int) ($stored[$key] ?? 0) !== (int) $fresh[$key]) {
                return false;
            }
        }

        return true;
    }

    private function text(string $kind, int $count): string
    {
        if ($kind === PostInteraction::COMMENT) {
            return "{$count} ".$this->plural($count, 'людина прокоментувала', 'людини прокоментували', 'людей прокоментували').' ваш запис';
        }
        $mod10 = $count % 10;
        $mod100 = $count % 100;
        $people = match (true) {
            $mod10 === 1 && $mod100 !== 11 => 'людина поставила',
            $mod10 >= 2 && $mod10 <= 4 && ($mod100 < 12 || $mod100 > 14) => 'людини поставили',
            default => 'людей поставили',
        };
        $target = $kind === PhotoInteraction::LIKE ? 'реакцію на фото' : 'реакцію';

        return "{$count} {$people} {$target}";
    }

    private function plural(int $n, string $one, string $few, string $many): string
    {
        $mod10 = $n % 10;
        $mod100 = $n % 100;

        return match (true) {
            $mod10 === 1 && $mod100 !== 11 => $one,
            $mod10 >= 2 && $mod10 <= 4 && ($mod100 < 12 || $mod100 > 14) => $few,
            default => $many,
        };
    }
}
