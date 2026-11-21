<?php

namespace App\Services\Communities;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\VoiceRoom;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Каталог спільнот: добірки «Зараз активні», «Ростуть», «Нові» й сортування списку.
 * Активність — повідомлення в каналах за добу й люди в голосових каналах; ріст — нові учасники за тиждень.
 * Спільноти, приховані з каталогу, сюди не потрапляють.
 */
class CommunityExplore
{
    public const SORTS = ['popular', 'active', 'growing', 'new'];

    private const SECTION_SIZE = 6;

    /** @return Builder<Community> */
    public function listed(): Builder
    {
        return Community::query()->where('is_listed', true);
    }

    /**
     * Лічильники для карток і сортування.
     *
     * @param  Builder<Community>  $query
     * @return Builder<Community>
     */
    public function withStats(Builder $query): Builder
    {
        return $query->select('communities.*')
            ->selectSub($this->messagesToday()->selectRaw('count(*)'), 'active_today')
            ->selectSub($this->voiceNow()->selectRaw('count(*)'), 'voice_now')
            ->selectSub($this->newMembers()->selectRaw('count(*)'), 'growth_week');
    }

    /**
     * @param  Builder<Community>  $query
     * @return Builder<Community>
     */
    public function sort(Builder $query, string $sort): Builder
    {
        $sorted = match ($sort) {
            'active' => $query->orderByRaw('(active_today + voice_now * 5) desc'),
            'growing' => $query->orderByDesc('growth_week'),
            'new' => $query->orderByDesc('communities.id'),
            default => $query->orderByDesc('is_verified')->orderByDesc('members_count'),
        };

        return $sorted->orderByDesc('communities.id');
    }

    /**
     * Добірки над списком.
     *
     * @return list<array{key: string, title: string, items: list<Community>}>
     */
    public function sections(): array
    {
        $base = fn () => $this->withStats($this->listed());
        $sections = [
            ['key' => 'active', 'title' => 'Зараз активні', 'items' => array_values($base()->where(fn (Builder $q) => $q->whereExists($this->messagesToday())->orWhereExists($this->voiceNow()))->orderByRaw('(active_today + voice_now * 5) desc')->limit(self::SECTION_SIZE)->get()->all())],
            ['key' => 'growing', 'title' => 'Ростуть', 'items' => array_values($base()->whereExists($this->newMembers())->orderByDesc('growth_week')->limit(self::SECTION_SIZE)->get()->all())],
            ['key' => 'new', 'title' => 'Нові', 'items' => array_values($base()->where('communities.created_at', '>=', now()->subDays(30))->orderByDesc('communities.id')->limit(self::SECTION_SIZE)->get()->all())],
        ];

        return array_values(array_filter($sections, fn (array $s) => $s['items'] !== []));
    }

    /**
     * @return array{active_today: int, voice_now: int, growth_week: int}
     */
    public function stats(Community $community): array
    {
        return [
            'active_today' => (int) ($community->getAttribute('active_today') ?? 0),
            'voice_now' => (int) ($community->getAttribute('voice_now') ?? 0),
            'growth_week' => (int) ($community->getAttribute('growth_week') ?? 0),
        ];
    }

    private function messagesToday(): QueryBuilder
    {
        return DB::table('messages')
            ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->join('community_channels', 'community_channels.id', '=', 'conversations.community_channel_id')
            ->whereColumn('community_channels.community_id', 'communities.id')
            ->where('messages.created_at', '>=', now()->subDay())
            ->whereNull('messages.deleted_at');
    }

    private function voiceNow(): QueryBuilder
    {
        return DB::table('voice_participants')
            ->join('voice_rooms', 'voice_rooms.id', '=', 'voice_participants.voice_room_id')
            ->where('voice_rooms.owner_type', VoiceRoom::OWNER_COMMUNITY)
            ->whereColumn('voice_rooms.owner_id', 'communities.id');
    }

    private function newMembers(): QueryBuilder
    {
        return DB::table('community_members')
            ->whereColumn('community_members.community_id', 'communities.id')
            ->where('community_members.status', CommunityMember::STATUS_ACTIVE)
            ->where('community_members.created_at', '>=', now()->subWeek());
    }
}
