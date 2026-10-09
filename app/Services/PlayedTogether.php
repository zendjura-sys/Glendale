<?php

namespace App\Services;

use App\Models\ListenPartyMember;
use App\Models\User;
use App\Models\WatchPartyMember;

/** Люди, з якими цей профіль був у спільному кіно чи музиці. */
class PlayedTogether
{
    /**
     * @return list<array<string, mixed>>
     */
    public function cards(User $user, int $limit = 8): array
    {
        $rows = [];

        $watchIds = WatchPartyMember::query()->where('user_id', $user->id)->pluck('watch_party_id');
        if ($watchIds->isNotEmpty()) {
            $mates = WatchPartyMember::query()
                ->whereIn('watch_party_id', $watchIds)
                ->where('user_id', '!=', $user->id)
                ->with(['user', 'party.movie'])
                ->orderByDesc('last_seen_at')
                ->limit(40)
                ->get();
            foreach ($mates as $mate) {
                if ($mate->user === null || isset($rows[$mate->user_id])) {
                    continue;
                }
                $rows[$mate->user_id] = [
                    ...$mate->user->toCard(),
                    'kind' => 'cinema',
                    'together' => $mate->party->movie->title ?? 'Кіно',
                ];
            }
        }

        $listenIds = ListenPartyMember::query()->where('user_id', $user->id)->pluck('listen_party_id');
        if ($listenIds->isNotEmpty()) {
            $mates = ListenPartyMember::query()
                ->whereIn('listen_party_id', $listenIds)
                ->where('user_id', '!=', $user->id)
                ->with(['user', 'party.track'])
                ->orderByDesc('last_seen_at')
                ->limit(40)
                ->get();
            foreach ($mates as $mate) {
                if ($mate->user === null || isset($rows[$mate->user_id])) {
                    continue;
                }
                $title = $mate->party?->track?->title;
                $rows[$mate->user_id] = [
                    ...$mate->user->toCard(),
                    'kind' => 'music',
                    'together' => $title ?? 'Музика',
                ];
            }
        }

        return array_slice(array_values($rows), 0, $limit);
    }
}
