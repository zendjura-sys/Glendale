<?php

namespace App\Services\Antispam;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\SpamBlock;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Статистика чатів для адмінки: обсяг повідомлень по днях, активні бесіди, гості й боти,
 * найживіші групи та що зупинив антиспам. Кеш на 5 хвилин.
 */
class ChatStats
{
    public const DAYS = 30;

    /**
     * @return array<string, mixed>
     */
    public function overview(): array
    {
        return Cache::remember('admin.chat-stats', 300, fn () => $this->build());
    }

    /**
     * @return array<string, mixed>
     */
    private function build(): array
    {
        $now = CarbonImmutable::now();
        $today = $now->startOfDay();
        $week = $now->subDays(7);
        $from = $today->subDays(self::DAYS - 1);
        $human = fn () => Message::query()->whereNotNull('user_id')->where('type', '!=', Message::TYPE_SYSTEM);

        // По днях: особисті / групи / гості (бесіда тієї ж мітки часу).
        $rows = Message::query()->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->where('messages.created_at', '>=', $from)->where('messages.type', '!=', Message::TYPE_SYSTEM)
            ->selectRaw('DATE(messages.created_at) as day, conversations.type as kind, messages.user_id is null as anon, count(*) as total')
            ->groupBy('day', 'kind', 'anon')->get();
        $series = [];
        for ($i = 0; $i < self::DAYS; $i++) {
            $series[$from->addDays($i)->toDateString()] = ['date' => $from->addDays($i)->toDateString(), 'direct' => 0, 'group' => 0, 'other' => 0];
        }
        foreach ($rows as $row) {
            $day = (string) $row->getAttribute('day');
            if (! isset($series[$day])) {
                continue;
            }
            $bucket = (bool) $row->getAttribute('anon') ? 'other' : ($row->getAttribute('kind') === Conversation::TYPE_GROUP ? 'group' : 'direct');
            $series[$day][$bucket] += (int) $row->getAttribute('total');
        }

        $top = Message::query()->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->where('conversations.type', Conversation::TYPE_GROUP)->where('messages.created_at', '>=', $week)
            ->selectRaw('conversations.id, conversations.title, conversations.community_channel_id, count(*) as total')
            ->groupBy('conversations.id', 'conversations.title', 'conversations.community_channel_id')
            ->orderByDesc('total')->limit(8)->get();
        $members = DB::table('conversation_participants')->whereIn('conversation_id', $top->pluck('id'))
            ->selectRaw('conversation_id, count(*) as total')->groupBy('conversation_id')->pluck('total', 'conversation_id');

        $blocked = SpamBlock::query()->where('created_at', '>=', $week)
            ->selectRaw('kind, count(*) as total')->groupBy('kind')->pluck('total', 'kind');

        return [
            'totals' => [
                'today' => $human()->where('created_at', '>=', $today)->count(),
                'week' => $human()->where('created_at', '>=', $week)->count(),
                'active_chats' => Message::query()->where('created_at', '>=', $week)->distinct()->count('conversation_id'),
                'senders' => $human()->where('created_at', '>=', $week)->distinct()->count('user_id'),
                'groups' => Conversation::query()->where('type', Conversation::TYPE_GROUP)->count(),
                'new_groups' => Conversation::query()->where('type', Conversation::TYPE_GROUP)->where('created_at', '>=', $week)->count(),
                'guests' => Message::query()->whereNull('user_id')->whereNotNull('meta->guest')->where('created_at', '>=', $week)->count(),
                'bots' => Message::query()->whereNull('user_id')->whereNotNull('meta->bot')->where('created_at', '>=', $week)->count(),
                'blocked' => (int) $blocked->sum(),
            ],
            'series' => array_values($series),
            'top' => $top->map(fn ($row) => [
                'id' => (int) $row->getAttribute('id'),
                'title' => (string) ($row->getAttribute('title') ?: 'Без назви'),
                'channel' => $row->getAttribute('community_channel_id') !== null,
                'messages' => (int) $row->getAttribute('total'),
                'members' => (int) ($members[$row->getAttribute('id')] ?? 0),
            ])->values()->all(),
            'blocked' => collect(SpamBlock::KINDS)->map(fn (string $label, string $kind) => [
                'kind' => $kind, 'label' => $label, 'total' => (int) ($blocked[$kind] ?? 0),
            ])->values()->all(),
        ];
    }
}
