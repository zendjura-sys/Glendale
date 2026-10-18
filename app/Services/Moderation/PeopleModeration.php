<?php

namespace App\Services\Moderation;

use App\Models\Appeal;
use App\Models\User;
use App\Models\UserReport;
use App\Services\Auth\AccountSecurity;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Скарги на людей і оскарження рішень модерації. */
class PeopleModeration
{
    public function report(User $reporter, User $target, string $reason, ?string $comment): UserReport
    {
        if ($reporter->is($target)) {
            throw ValidationException::withMessages(['reason' => 'На себе скаржитися не можна.']);
        }

        return UserReport::query()->updateOrCreate(
            ['user_id' => $target->id, 'reporter_id' => $reporter->id],
            ['reason' => $reason, 'comment' => $comment !== null && trim($comment) !== '' ? Str::limit(trim($comment), 1000, '') : null, 'status' => UserReport::PENDING],
        );
    }

    /**
     * ban — заблокувати, mute — заборонити писати на $hours, dismiss — відхилити.
     */
    public function resolve(User $target, User $moderator, string $action, ?int $hours, ?string $reason): void
    {
        $reasonText = $reason !== null && trim($reason) !== '' ? Str::limit(trim($reason), 200, '') : null;
        if (! $target->isStaff()) {
            if ($action === 'ban') {
                $target->forceFill(['banned_at' => now(), 'ban_reason' => $reasonText])->save();
                app(AccountSecurity::class)->revoke($target, null, null, null);
            } elseif ($action === 'mute') {
                $target->forceFill(['muted_until' => now()->addHours(max(1, (int) $hours)), 'mute_reason' => $reasonText])->save();
            }
        }

        UserReport::query()->where('user_id', $target->id)->where('status', UserReport::PENDING)->update([
            'status' => $action === 'dismiss' ? UserReport::DISMISSED : UserReport::RESOLVED,
            'resolved_by' => $moderator->id,
            'resolution' => $action,
            'updated_at' => now(),
        ]);
    }

    /**
     * Прийняте оскарження знімає блокування чи заборону писати.
     */
    public function answer(Appeal $appeal, User $moderator, bool $accept, ?string $reply): void
    {
        $appeal->update([
            'status' => $accept ? Appeal::ACCEPTED : Appeal::REJECTED,
            'reply' => $reply !== null && trim($reply) !== '' ? trim($reply) : null,
            'handled_by' => $moderator->id,
        ]);
        $user = $appeal->user;
        if ($accept && $user instanceof User) {
            if ($appeal->kind === 'ban') {
                $user->forceFill(['banned_at' => null, 'ban_reason' => null])->save();
            } elseif ($appeal->kind === 'mute') {
                $user->forceFill(['muted_until' => null, 'mute_reason' => null])->save();
            }
        }
    }
}
