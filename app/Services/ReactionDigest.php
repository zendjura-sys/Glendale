<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\PhotoInteraction;
use App\Notifications\PostInteraction;
use App\Support\NotifyPrefs;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Кілька реакцій на той самий запис чи фото збираються в одне сповіщення.
 */
class ReactionDigest
{
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
            $count = max(1, (int) ($payload['count'] ?? 1)) + 1;
            $payload['count'] = $count;
            $payload['actor_id'] = $notification->actor->id;
            $payload['text'] = $this->text((string) $fresh['kind'], $count);
            $existing->forceFill(['data' => $payload, 'created_at' => now()])->save();

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
}
