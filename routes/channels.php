<?php

use App\Models\ClanMember;
use App\Models\CommunityMember;
use App\Models\ConversationParticipant;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\ListenPartyMember;
use App\Models\User;
use App\Models\WatchPartyMember;
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

// Голосові кімнати спільноти: хто зайшов і вийшов.
Broadcast::channel('community.{communityId}', function (User $user, int $communityId) {
    return CommunityMember::query()
        ->where('community_id', $communityId)
        ->where('user_id', $user->id)
        ->where('status', CommunityMember::STATUS_ACTIVE)
        ->exists();
});

Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId) {
    return ConversationParticipant::query()
        ->where('conversation_id', $conversationId)
        ->where('user_id', $user->id)
        ->whereNull('left_at')
        ->exists();
});

// Спільний перегляд: стан плеєра, чат і хто дивиться — для тих, хто відкрив посилання.
Broadcast::channel('watch.{partyId}', function (User $user, int $partyId) {
    return WatchPartyMember::query()->where('watch_party_id', $partyId)->where('user_id', $user->id)->exists();
});

// Спільне прослуховування: стан плеєра, черга й хто слухає — для тих, хто відкрив посилання.
Broadcast::channel('listen.{partyId}', function (User $user, int $partyId) {
    return ListenPartyMember::query()->where('listen_party_id', $partyId)->where('user_id', $user->id)->exists();
});

// Клан: голосові кімнати (хто зайшов і вийшов).
Broadcast::channel('clan.{clanId}', function (User $user, int $clanId) {
    return ClanMember::query()->where('clan_id', $clanId)->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->exists();
});

// Голосові кімнати опублікованого сервера: зайти може будь-який учасник сайту.
Broadcast::channel('server.{serverId}', function (User $user, int $serverId) {
    if ($user->isBanned()) {
        return false;
    }
    $server = GtaServer::query()->find($serverId);

    return $server !== null && ($server->status === GtaServer::STATUS_PUBLISHED || $user->isAdmin());
});
