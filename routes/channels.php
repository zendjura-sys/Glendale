<?php

use App\Models\ConversationParticipant;
use App\Models\FamilyMember;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, int $id) {
    return $user->id === $id;
});

Broadcast::channel('family.{familyId}', function (User $user, int $familyId) {
    return FamilyMember::query()
        ->where('family_id', $familyId)
        ->where('user_id', $user->id)
        ->where('status', FamilyMember::STATUS_ACTIVE)
        ->exists();
});

Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId) {
    return ConversationParticipant::query()
        ->where('conversation_id', $conversationId)
        ->where('user_id', $user->id)
        ->whereNull('left_at')
        ->exists();
});
