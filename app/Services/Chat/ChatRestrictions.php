<?php

namespace App\Services\Chat;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Services\Messenger;
use Illuminate\Validation\ValidationException;

/**
 * Тайм-аут і виключення на час у групах та каналах спільнот.
 * Тайм-аут: людина читає, але не пише. Виключення: виходить із бесіди й не повертається до строку.
 * Карають адміністратори бесіди (у каналі — адміністратори спільноти); власника й інших адмінів — лише власник.
 */
class ChatRestrictions
{
    public const TIMEOUT = 'timeout';

    public const KICK = 'kick';

    /** Строки в хвилинах: 5 хв, година, доба, тиждень. */
    public const DURATIONS = [5, 60, 1440, 10080];

    public function __construct(private readonly Messenger $messenger) {}

    public function restrict(Conversation $conversation, User $actor, User $target, string $kind, int $minutes): ConversationParticipant
    {
        [$actorRow, $targetRow] = $this->rows($conversation, $actor, $target);
        abort_if($conversation->isFamily(), 422, 'Учасниками чату сім’ї керує сама сім’я.');
        if ($kind === self::KICK && $conversation->community_channel_id === null && $targetRow->left_at !== null) {
            throw ValidationException::withMessages(['kind' => 'Людина вже не в бесіді.']);
        }
        $until = now()->addMinutes($minutes);
        $when = $until->copy()->timezone('Europe/Kyiv')->format('d.m H:i');

        if ($kind === self::TIMEOUT) {
            $targetRow->update(['timeout_until' => $until]);
            $this->messenger->noticeBy($conversation, $actor, $this->messenger->genderVerb($actor, 'заборонив', 'заборонила')." {$target->name} писати до {$when}");
        } else {
            $targetRow->update(['banned_until' => $until, 'left_at' => now(), 'role' => ConversationParticipant::ROLE_MEMBER, 'timeout_until' => null]);
            $this->messenger->noticeBy($conversation, $actor, $this->messenger->genderVerb($actor, 'виключив', 'виключила')." {$target->name} до {$when}");
        }

        return $targetRow;
    }

    public function lift(Conversation $conversation, User $actor, User $target): void
    {
        [, $targetRow] = $this->rows($conversation, $actor, $target);
        if (! $targetRow->timedOut() && ! $targetRow->banned()) {
            return;
        }
        $targetRow->update(['timeout_until' => null, 'banned_until' => null]);
        $this->messenger->noticeBy($conversation, $actor, $this->messenger->genderVerb($actor, 'зняв', 'зняла')." обмеження з {$target->name}");
    }

    /**
     * @return array{0: ConversationParticipant, 1: ConversationParticipant}
     */
    private function rows(Conversation $conversation, User $actor, User $target): array
    {
        abort_unless($conversation->isGroup(), 422, 'Обмеження діють лише в групах і каналах.');
        abort_if($actor->is($target), 422, 'Себе обмежити не можна.');
        $actorRow = $conversation->participantFor($actor);
        abort_unless($actorRow?->canManage() || $actor->isStaff(), 403);
        $targetRow = ConversationParticipant::query()->where('conversation_id', $conversation->id)->where('user_id', $target->id)->first();
        abort_if($targetRow === null, 404);
        $actorIsOwner = $actorRow?->role === ConversationParticipant::ROLE_OWNER || $actor->isStaff();
        abort_if($targetRow->role === ConversationParticipant::ROLE_OWNER || ($targetRow->canManage() && ! $actorIsOwner), 403, 'Адміністраторів може обмежити лише власник.');

        return [$actorRow ?? $targetRow, $targetRow];
    }
}
