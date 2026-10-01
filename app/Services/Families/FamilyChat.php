<?php

namespace App\Services\Families;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Services\Messenger;
use Illuminate\Support\Facades\DB;

/**
 * Чат сім’ї — групова бесіда месенджера, склад якої синхронізується з активними учасниками.
 */
class FamilyChat
{
    public function __construct(private readonly Messenger $messenger) {}

    public function ensure(Family $family): ?Conversation
    {
        if (! $family->isVerified()) {
            return null;
        }

        $conversation = $family->conversation_id ? Conversation::query()->find($family->conversation_id) : null;

        if (! $conversation) {
            $conversation = DB::transaction(function () use ($family) {
                $conversation = Conversation::query()->create([
                    'type' => Conversation::TYPE_GROUP,
                    'title' => $this->title($family),
                    'owner_id' => $family->owner_id,
                    'family_id' => $family->id,
                ]);
                $family->forceFill(['conversation_id' => $conversation->id])->saveQuietly();

                return $conversation;
            });
            $this->sync($family, $conversation);
            $this->messenger->announce($conversation, "Чат сім’ї [{$family->tag}] {$family->name} відкрито. Тут бачать лише активних учасників — з RP-ніками та рангами.", ['family' => true]);

            return $conversation;
        }

        if ($conversation->title !== $this->title($family)) {
            $conversation->update(['title' => $this->title($family)]);
        }
        $this->sync($family, $conversation);

        return $conversation;
    }

    public function sync(Family $family, ?Conversation $conversation = null): void
    {
        $conversation ??= $family->conversation_id ? Conversation::query()->find($family->conversation_id) : null;
        if (! $conversation) {
            return;
        }

        $members = $family->activeMembers()->get(['id', 'user_id', 'rank']);
        $active = $members->pluck('user_id')->all();

        DB::transaction(function () use ($conversation, $family, $members, $active) {
            foreach ($members as $member) {
                $role = match (true) {
                    $member->user_id === $family->owner_id => ConversationParticipant::ROLE_OWNER,
                    $member->rank >= Family::DEPUTY_RANK => ConversationParticipant::ROLE_ADMIN,
                    default => ConversationParticipant::ROLE_MEMBER,
                };
                $row = ConversationParticipant::query()->firstOrNew(['conversation_id' => $conversation->id, 'user_id' => $member->user_id]);
                if (! $row->exists || $row->left_at !== null) {
                    $row->joined_at = now();
                    $row->last_read_message_id = $conversation->last_message_id;
                }
                $row->left_at = null;
                $row->role = $role;
                $row->save();
            }

            ConversationParticipant::query()
                ->where('conversation_id', $conversation->id)
                ->whereNull('left_at')
                ->whereNotIn('user_id', $active ?: [0])
                ->update(['left_at' => now(), 'role' => ConversationParticipant::ROLE_MEMBER]);
        });
    }

    public function announce(Family $family, string $text): void
    {
        $conversation = $family->conversation_id ? Conversation::query()->find($family->conversation_id) : null;
        if ($conversation) {
            $this->messenger->announce($conversation, $text, ['family' => true]);
        }
    }

    public function memberJoined(Family $family, FamilyMember $member): void
    {
        if (! $family->conversation_id) {
            return;
        }
        $this->sync($family);
        $this->announce($family, "{$member->displayName()} приєднався(-лась) до сім’ї. Ласкаво просимо! 🎉");
    }

    private function title(Family $family): string
    {
        return mb_substr("[{$family->tag}] {$family->name}", 0, 80);
    }
}
