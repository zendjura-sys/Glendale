<?php

namespace App\Services\Communities;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Models\CommunityChannelCategory;
use App\Models\CommunityMember;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Models\VoiceRoom;
use App\Services\Messenger;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Канали спільноти (як у Discord): категорії, текстові канали, «Оголошення» й голосові.
 *
 * Текстовий канал — це бесіда месенджера з `community_channel_id`: повідомлення, реакції, файли,
 * зведена «Поки тебе не було» працюють як у групах, але в «Повідомленнях» канал не з’являється.
 * Учасником бесіди людина стає, коли вперше відкриває канал (без розсилки сповіщень — канал тихий).
 * Голосовий канал — голосова кімната спільноти (LiveKit), тож кімнати й канали завжди збігаються.
 */
class CommunityChannels
{
    public const MAX_CHANNELS = 50;

    public const MAX_CATEGORIES = 15;

    public function __construct(
        private readonly Messenger $messenger,
    ) {}

    public function canManage(Community $community, ?User $user): bool
    {
        return $user !== null && ((bool) $community->membershipFor($user)?->isManager() || $user->isStaff());
    }

    /** Бачить канал: учасник спільноти; приватний — лише вибрані й адміністратори. */
    public function canView(CommunityChannel $channel, ?User $user, ?CommunityMember $membership = null): bool
    {
        if ($user === null) {
            return false;
        }
        $membership ??= $channel->community->membershipFor($user);
        if (! $membership?->isActive() && ! $user->isStaff()) {
            return false;
        }
        if (! $channel->is_private || $membership?->isManager() || $user->isStaff()) {
            return true;
        }

        return $channel->members()->where('users.id', $user->id)->exists();
    }

    /** Писати в «Оголошення» можуть лише адміністратори; в текстовий — усі, хто бачить канал. */
    public function canPost(CommunityChannel $channel, User $user): bool
    {
        if ($channel->isVoice() || ! $this->canView($channel, $user)) {
            return false;
        }

        return $channel->type === CommunityChannel::TEXT || $this->canManage($channel->community, $user);
    }

    /**
     * Перші канали спільноти: «Головне» з #загальне й #оголошення; наявні голосові кімнати
     * стають голосовими каналами. Кімнати, створені поза каналами, теж підхоплюються.
     */
    public function bootstrap(Community $community): void
    {
        if (! $community->channels()->where('type', '!=', CommunityChannel::VOICE)->exists()) {
            DB::transaction(function () use ($community) {
                $main = CommunityChannelCategory::query()->firstOrCreate(['community_id' => $community->id, 'name' => 'Головне'], ['position' => 0]);
                $this->createChannel($community, ['name' => 'загальне', 'type' => CommunityChannel::TEXT, 'category_id' => $main->id]);
                $this->createChannel($community, ['name' => 'оголошення', 'type' => CommunityChannel::ANNOUNCEMENT, 'category_id' => $main->id]);
            });
        }

        $orphans = VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_COMMUNITY)->where('owner_id', $community->id)
            ->whereNotIn('id', CommunityChannel::query()->where('community_id', $community->id)->whereNotNull('voice_room_id')->select('voice_room_id'))
            ->orderBy('position')->get();
        if ($orphans->isEmpty() && $community->channels()->where('type', CommunityChannel::VOICE)->exists()) {
            return;
        }
        $voice = CommunityChannelCategory::query()->firstOrCreate(
            ['community_id' => $community->id, 'name' => 'Голосові'],
            ['position' => (int) $community->channelCategories()->max('position') + 1],
        );
        if ($orphans->isEmpty()) {
            $this->createChannel($community, ['name' => 'Загальна', 'type' => CommunityChannel::VOICE, 'category_id' => $voice->id]);

            return;
        }
        foreach ($orphans as $room) {
            CommunityChannel::query()->create([
                'community_id' => $community->id, 'category_id' => $voice->id, 'name' => $room->name,
                'type' => CommunityChannel::VOICE, 'voice_room_id' => $room->id, 'position' => $this->nextPosition($community, $voice->id),
            ]);
        }
    }

    /**
     * @param  array{name: string, type: string, category_id?: int|null, topic?: string|null, is_private?: bool, members?: list<int>}  $data
     */
    public function createChannel(Community $community, array $data, ?User $actor = null): CommunityChannel
    {
        abort_if($community->channels()->count() >= self::MAX_CHANNELS, 422, 'У спільноті може бути до '.self::MAX_CHANNELS.' каналів.');
        $categoryId = $this->ownCategory($community, $data['category_id'] ?? null);

        return DB::transaction(function () use ($community, $data, $categoryId, $actor) {
            $channel = CommunityChannel::query()->create([
                'community_id' => $community->id,
                'category_id' => $categoryId,
                'name' => trim($data['name']),
                'type' => $data['type'],
                'topic' => filled($data['topic'] ?? null) ? trim((string) $data['topic']) : null,
                'is_private' => (bool) ($data['is_private'] ?? false),
                'position' => $this->nextPosition($community, $categoryId),
            ]);

            if ($channel->isVoice()) {
                $room = VoiceRoom::query()->create([
                    'owner_type' => VoiceRoom::OWNER_COMMUNITY, 'owner_id' => $community->id, 'name' => $channel->name,
                    'position' => (int) VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_COMMUNITY)->where('owner_id', $community->id)->max('position') + 1,
                    'created_by' => $actor?->id,
                ]);
                $channel->update(['voice_room_id' => $room->id]);
            } else {
                $conversation = Conversation::query()->create([
                    'type' => Conversation::TYPE_GROUP, 'title' => $channel->name, 'owner_id' => $community->owner_id,
                    'community_channel_id' => $channel->id,
                ]);
                $channel->update(['conversation_id' => $conversation->id]);
            }
            if ($channel->is_private) {
                $channel->members()->sync($this->activeMemberIds($community, $data['members'] ?? []));
            }

            return $channel;
        });
    }

    /**
     * @param  array{name?: string, topic?: string|null, category_id?: int|null, is_private?: bool, members?: list<int>}  $data
     */
    public function updateChannel(CommunityChannel $channel, array $data): CommunityChannel
    {
        $patch = [];
        if (isset($data['name'])) {
            $patch['name'] = trim($data['name']);
        }
        if (array_key_exists('topic', $data)) {
            $patch['topic'] = filled($data['topic']) ? trim((string) $data['topic']) : null;
        }
        if (array_key_exists('category_id', $data) && $data['category_id'] !== $channel->category_id) {
            $patch['category_id'] = $this->ownCategory($channel->community, $data['category_id']);
            $patch['position'] = $this->nextPosition($channel->community, $patch['category_id']);
        }
        if (array_key_exists('is_private', $data)) {
            $patch['is_private'] = (bool) $data['is_private'];
        }
        $channel->update($patch);

        if (isset($patch['name'])) {
            $channel->conversation?->update(['title' => $patch['name']]);
            $channel->voiceRoom?->update(['name' => $patch['name']]);
        }
        if ($channel->is_private && array_key_exists('members', $data)) {
            $channel->members()->sync($this->activeMemberIds($channel->community, $data['members']));
        }
        $this->syncAccess($channel);

        return $channel->refresh();
    }

    /** Видалити канал разом із його бесідою чи голосовою кімнатою (дія адміністратора спільноти). */
    public function deleteChannel(CommunityChannel $channel): void
    {
        DB::transaction(function () use ($channel) {
            $channel->conversation?->delete();
            $channel->voiceRoom?->delete();
            $channel->delete();
        });
    }

    public function createCategory(Community $community, string $name): CommunityChannelCategory
    {
        abort_if($community->channelCategories()->count() >= self::MAX_CATEGORIES, 422, 'У спільноті може бути до '.self::MAX_CATEGORIES.' категорій.');

        return CommunityChannelCategory::query()->create([
            'community_id' => $community->id, 'name' => trim($name),
            'position' => (int) $community->channelCategories()->max('position') + 1,
        ]);
    }

    /** Видалити категорію: її канали лишаються, лише без категорії. */
    public function deleteCategory(CommunityChannelCategory $category): void
    {
        $category->delete();
    }

    /**
     * Новий порядок: категорії зверху вниз і канали в кожній (null — без категорії).
     *
     * @param  list<int>  $categoryIds
     * @param  list<array{category_id: int|null, channels: list<int>}>  $groups
     */
    public function reorder(Community $community, array $categoryIds, array $groups): void
    {
        $ownCategories = $community->channelCategories()->pluck('id')->all();
        $ownChannels = $community->channels()->pluck('id')->all();

        DB::transaction(function () use ($categoryIds, $groups, $ownCategories, $ownChannels) {
            foreach (array_values(array_intersect($categoryIds, $ownCategories)) as $position => $id) {
                CommunityChannelCategory::query()->whereKey($id)->update(['position' => $position]);
            }
            foreach ($groups as $group) {
                $categoryId = $group['category_id'];
                if ($categoryId !== null && ! in_array($categoryId, $ownCategories, true)) {
                    continue;
                }
                foreach (array_values(array_intersect($group['channels'], $ownChannels)) as $position => $id) {
                    CommunityChannel::query()->whereKey($id)->update(['category_id' => $categoryId, 'position' => $position]);
                }
            }
        });
    }

    /**
     * Відкрити текстовий канал: людина стає учасником його бесіди (тихо — без push).
     */
    public function open(CommunityChannel $channel, User $user): ?ConversationParticipant
    {
        $conversation = $channel->conversation;
        if ($conversation === null || ! $this->canView($channel, $user)) {
            return null;
        }
        $role = $this->canManage($channel->community, $user) ? ConversationParticipant::ROLE_ADMIN : ConversationParticipant::ROLE_MEMBER;
        $row = ConversationParticipant::query()->firstOrNew(['conversation_id' => $conversation->id, 'user_id' => $user->id]);
        if (! $row->exists || $row->left_at !== null || $row->role !== $role) {
            $row->fill([
                'role' => $role,
                'is_muted' => $row->exists ? $row->is_muted : true,
                'joined_at' => $row->exists && $row->left_at === null ? $row->joined_at : now(),
                'left_at' => null,
                'last_read_message_id' => $row->exists ? $row->last_read_message_id : $conversation->last_message_id,
            ])->save();
        }

        return $row;
    }

    /** Хто вже не має доступу до каналу (вийшов зі спільноти, прибраний із приватного) — виходить із бесіди. */
    public function syncAccess(CommunityChannel $channel): void
    {
        $conversation = $channel->conversation;
        if ($conversation === null) {
            return;
        }
        $conversation->activeParticipants()->with('user')->get()
            ->filter(fn (ConversationParticipant $p) => $p->user === null || ! $this->canView($channel, $p->user))
            ->each(fn (ConversationParticipant $p) => $p->update(['left_at' => now()]));
    }

    /** Людина вийшла чи її виключили зі спільноти — прибрати з усіх бесід каналів. */
    public function forget(Community $community, User $user): void
    {
        ConversationParticipant::query()->where('user_id', $user->id)->whereNull('left_at')
            ->whereIn('conversation_id', $community->channels()->whereNotNull('conversation_id')->select('conversation_id'))
            ->update(['left_at' => now()]);
        DB::table('community_channel_members')->where('user_id', $user->id)
            ->whereIn('community_channel_id', $community->channels()->select('id'))->delete();
    }

    /**
     * Дерево для бічної панелі: категорії з каналами, які людина бачить, і непрочитане в текстових.
     *
     * @return array{categories: list<array<string, mixed>>, uncategorized: list<array<string, mixed>>}
     */
    public function tree(Community $community, User $viewer): array
    {
        $this->bootstrap($community);
        $membership = $community->membershipFor($viewer);
        $channels = $community->channels()->with(['community', 'voiceRoom.participants.user'])->orderBy('position')->orderBy('id')->get()
            ->filter(fn (CommunityChannel $c) => $this->canView($c, $viewer, $membership));
        $unread = $this->unread($channels, $viewer);
        $card = fn (CommunityChannel $c) => $this->card($c, $unread[$c->conversation_id ?? 0] ?? 0);
        $byCategory = $channels->groupBy(fn (CommunityChannel $c) => (int) $c->category_id);

        return [
            'categories' => array_values($community->channelCategories()->orderBy('position')->orderBy('id')->get()
                ->map(fn (CommunityChannelCategory $category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'channels' => array_values(($byCategory->get($category->id) ?? collect())->map($card)->all()),
                ])->all()),
            'uncategorized' => array_values(($byCategory->get(0) ?? collect())->map($card)->all()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function card(CommunityChannel $channel, int $unread = 0): array
    {
        return [
            'id' => $channel->id,
            'name' => $channel->name,
            'type' => $channel->type,
            'topic' => $channel->topic,
            'is_private' => $channel->is_private,
            'category_id' => $channel->category_id,
            'conversation_id' => $channel->conversation_id,
            'voice_room_id' => $channel->voice_room_id,
            'unread' => $unread,
            'voice' => $channel->isVoice() && $channel->voiceRoom
                ? array_values($channel->voiceRoom->participants->filter(fn ($p) => $p->user !== null)->map(fn ($p) => $p->user->toCard())->all())
                : [],
        ];
    }

    /**
     * Учасники для вибору в приватний канал.
     *
     * @return list<array<string, mixed>>
     */
    public function memberOptions(Community $community, string $query = '', int $limit = 30): array
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $query).'%';

        return array_values(User::query()->whereIn('id', $community->activeMembers()->select('user_id'))
            ->when($query !== '', fn ($q) => $q->where(fn ($w) => $w->where('first_name', 'like', $like)->orWhere('last_name', 'like', $like)->orWhere('username', 'like', $like)))
            ->orderBy('first_name')->limit($limit)->get()->map->toCard()->all());
    }

    /**
     * @param  Collection<int, CommunityChannel>  $channels
     * @return array<int, int>
     */
    private function unread(Collection $channels, User $viewer): array
    {
        $ids = $channels->pluck('conversation_id')->filter()->values()->all();
        if ($ids === []) {
            return [];
        }

        return ConversationParticipant::query()->where('user_id', $viewer->id)->whereNull('left_at')->whereIn('conversation_id', $ids)
            ->select('conversation_id')
            ->selectSub(fn ($q) => $this->messenger->unreadMessages($q->selectRaw('count(*)'), $viewer->id, 'conversation_participants'), 'unread_count')
            ->get()->mapWithKeys(fn ($row) => [(int) $row->conversation_id => (int) $row->getAttribute('unread_count')])->all();
    }

    private function ownCategory(Community $community, mixed $categoryId): ?int
    {
        if ($categoryId === null || $categoryId === '' || $categoryId === 0) {
            return null;
        }

        return $community->channelCategories()->whereKey((int) $categoryId)->value('id');
    }

    private function nextPosition(Community $community, ?int $categoryId): int
    {
        $max = $community->channels()->where('category_id', $categoryId)->max('position');

        return $max === null ? 0 : (int) $max + 1;
    }

    /**
     * @param  list<int>  $ids
     * @return list<int>
     */
    private function activeMemberIds(Community $community, array $ids): array
    {
        return array_values(array_map('intval', $community->activeMembers()->whereIn('user_id', array_map('intval', $ids))->pluck('user_id')->all()));
    }
}
