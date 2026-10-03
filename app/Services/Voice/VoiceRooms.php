<?php

namespace App\Services\Voice;

use App\Events\VoiceRoomsChanged;
use App\Models\Community;
use App\Models\Family;
use App\Models\User;
use App\Models\VoiceParticipant;
use App\Models\VoiceRoom;
use App\Services\Families\FamilyGate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Голосові кімнати сімей і спільнот: хто може зайти й керувати, список із присутніми, вхід через LiveKit.
 * Права сім’ї — з матриці рангів (voice.manage), спільноти — керівні ролі; адміністратор сайту може все.
 */
class VoiceRooms
{
    public function __construct(
        private readonly FamilyGate $gate,
        private readonly LiveKit $livekit,
    ) {}

    public function owner(string $type, int $id): Family|Community
    {
        return match ($type) {
            VoiceRoom::OWNER_FAMILY => Family::query()->findOrFail($id),
            VoiceRoom::OWNER_COMMUNITY => Community::query()->findOrFail($id),
            default => abort(404),
        };
    }

    public function ownerOf(VoiceRoom $room): Family|Community
    {
        return $this->owner($room->owner_type, $room->owner_id);
    }

    public function canJoin(?User $user, Family|Community $owner): bool
    {
        if (! $user || $user->banned_at !== null) {
            return false;
        }

        return $owner instanceof Family
            ? $this->gate->member($owner, $user) !== null
            : (bool) $owner->membershipFor($user)?->isActive();
    }

    public function canManage(?User $user, Family|Community $owner): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->isAdmin()) {
            return true;
        }

        return $owner instanceof Family
            ? $this->gate->can($this->gate->member($owner, $user), $owner, 'voice.manage')
            : (bool) $owner->membershipFor($user)?->isManager();
    }

    /**
     * Кімнати з присутніми; першого разу створює «Загальну».
     *
     * @return list<array<string, mixed>>
     */
    public function list(Family|Community $owner): array
    {
        [$type, $id] = $this->key($owner);
        $rooms = VoiceRoom::query()->where('owner_type', $type)->where('owner_id', $id)
            ->orderBy('position')->orderBy('id')
            ->with(['participants' => fn ($q) => $q->orderBy('joined_at'), 'participants.user'])
            ->get();

        if ($rooms->isEmpty()) {
            VoiceRoom::query()->create(['owner_type' => $type, 'owner_id' => $id, 'name' => 'Загальна', 'position' => 0]);

            return $this->list($owner);
        }

        $userIds = [];
        foreach ($rooms as $room) {
            foreach ($room->participants as $participant) {
                $userIds[] = $participant->user_id;
            }
        }
        $names = $owner instanceof Family ? $this->familyNames($owner, $userIds) : [];

        $list = [];
        foreach ($rooms as $room) {
            $people = [];
            foreach ($room->participants as $participant) {
                $user = $participant->user;
                if (! $user instanceof User) {
                    continue;
                }
                $people[] = [
                    ...$user->toCard(),
                    'name' => $names[$user->id] ?? $user->name,
                    'muted' => $participant->muted,
                    'joined_at' => $participant->joined_at->toIso8601String(),
                ];
            }
            $list[] = ['id' => $room->id, 'name' => $room->name, 'participants' => $people];
        }

        return $list;
    }

    /**
     * Повний стан для сторінки: кімнати, чи налаштовано голос і що дозволено користувачу.
     *
     * @return array<string, mixed>
     */
    public function state(Family|Community $owner, ?User $user): array
    {
        [$type, $id] = $this->key($owner);

        return [
            'owner' => ['type' => $type, 'id' => $id],
            'enabled' => $this->livekit->configured(),
            'can_manage' => $this->canManage($user, $owner),
            'rooms' => $this->list($owner),
        ];
    }

    public function create(Family|Community $owner, User $user, string $name): VoiceRoom
    {
        [$type, $id] = $this->key($owner);
        $count = VoiceRoom::query()->where('owner_type', $type)->where('owner_id', $id)->count();
        if ($count >= VoiceRoom::MAX_ROOMS) {
            throw ValidationException::withMessages(['name' => 'Не більше '.VoiceRoom::MAX_ROOMS.' голосових кімнат.']);
        }

        $room = VoiceRoom::query()->create([
            'owner_type' => $type,
            'owner_id' => $id,
            'name' => $name,
            'position' => $count,
            'created_by' => $user->id,
        ]);
        $this->changed($owner);

        return $room;
    }

    public function rename(VoiceRoom $room, string $name): void
    {
        $room->update(['name' => $name]);
        $this->changed($this->ownerOf($room));
    }

    public function delete(VoiceRoom $room): void
    {
        $owner = $this->ownerOf($room);
        [$type, $id] = $this->key($owner);
        if (VoiceRoom::query()->where('owner_type', $type)->where('owner_id', $id)->count() <= 1) {
            throw ValidationException::withMessages(['room' => 'Остання кімната лишається — її можна лише перейменувати.']);
        }

        $this->livekit->deleteRoom($room->livekitName());
        $room->delete();
        $this->changed($owner);
    }

    /**
     * Токен входу для клієнта.
     *
     * @return array{url: string, token: string, room: string, identity: string}
     */
    public function join(VoiceRoom $room, User $user): array
    {
        $owner = $this->ownerOf($room);
        $name = $owner instanceof Family ? ($this->familyNames($owner, [$user->id])[$user->id] ?? $user->name) : $user->name;
        $muted = (bool) VoiceParticipant::query()->where('voice_room_id', $room->id)->where('user_id', $user->id)->value('muted');

        return [
            'url' => (string) $this->livekit->url(),
            'token' => $this->livekit->token(
                $this->identity($user),
                $name,
                $room->livekitName(),
                $muted ? ['canPublish' => false, 'canPublishSources' => []] : [],
                (string) json_encode(['user_id' => $user->id, 'avatar_url' => $user->avatar_url]),
            ),
            'room' => $room->livekitName(),
            'identity' => $this->identity($user),
        ];
    }

    /** Модератор вимикає або дозволяє мікрофон учасникові. */
    public function mute(VoiceRoom $room, User $target, bool $muted): void
    {
        VoiceParticipant::query()->where('voice_room_id', $room->id)->where('user_id', $target->id)->update(['muted' => $muted]);
        $this->livekit->setCanPublish($room->livekitName(), $this->identity($target), ! $muted);
        $this->changed($this->ownerOf($room));
    }

    public function kick(VoiceRoom $room, User $target): void
    {
        $this->livekit->removeParticipant($room->livekitName(), $this->identity($target));
        VoiceParticipant::query()->where('voice_room_id', $room->id)->where('user_id', $target->id)->delete();
        $this->changed($this->ownerOf($room));
    }

    /**
     * Подія від LiveKit: хто зайшов і вийшов. Невідомі кімнати й учасників ігноруємо.
     *
     * @param  array<string, mixed>  $event
     */
    public function webhook(array $event): void
    {
        $roomName = (string) ($event['room']['name'] ?? '');
        $room = ($id = VoiceRoom::idFromLivekit($roomName)) ? VoiceRoom::query()->find($id) : null;
        if (! $room) {
            return;
        }

        $userId = $this->userIdFromIdentity((string) ($event['participant']['identity'] ?? ''));

        match ($event['event'] ?? null) {
            'participant_joined' => $userId && User::query()->whereKey($userId)->exists()
                ? DB::transaction(function () use ($room, $userId) {
                    // Людина в одній кімнаті сім’ї чи спільноти одночасно — як у Discord.
                    VoiceParticipant::query()->where('user_id', $userId)->where('voice_room_id', '!=', $room->id)->delete();
                    VoiceParticipant::query()->updateOrCreate(
                        ['voice_room_id' => $room->id, 'user_id' => $userId],
                        ['joined_at' => now()],
                    );
                })
                : null,
            'participant_left' => $userId ? VoiceParticipant::query()->where('voice_room_id', $room->id)->where('user_id', $userId)->delete() : null,
            'room_finished' => VoiceParticipant::query()->where('voice_room_id', $room->id)->delete(),
            default => null,
        };

        $this->changed($this->ownerOf($room));
    }

    public function identity(User $user): string
    {
        return 'u'.$user->id;
    }

    private function userIdFromIdentity(string $identity): ?int
    {
        return preg_match('/^u(\d+)$/', $identity, $m) === 1 ? (int) $m[1] : null;
    }

    private function changed(Family|Community $owner): void
    {
        [$type, $id] = $this->key($owner);
        rescue(fn () => broadcast(new VoiceRoomsChanged($type, $id)), report: false);
    }

    /**
     * @return array{0: string, 1: int}
     */
    private function key(Family|Community $owner): array
    {
        return $owner instanceof Family ? [VoiceRoom::OWNER_FAMILY, $owner->id] : [VoiceRoom::OWNER_COMMUNITY, $owner->id];
    }

    /**
     * RP-нікнейми учасників сім’ї: у кімнатах сім’ї люди бачать одне одного як у грі.
     *
     * @param  list<int>  $userIds
     * @return array<int, string>
     */
    private function familyNames(Family $family, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return $family->activeMembers()->whereIn('user_id', $userIds)->get()
            ->mapWithKeys(fn ($member) => [$member->user_id => $member->displayName()])
            ->all();
    }
}
