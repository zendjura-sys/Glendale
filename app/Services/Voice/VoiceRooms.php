<?php

namespace App\Services\Voice;

use App\Events\VoiceRoomsChanged;
use App\Models\Community;
use App\Models\Family;
use App\Models\User;
use App\Models\VoiceParticipant;
use App\Models\VoiceRoom;
use App\Models\VoiceRoomTemplate;
use App\Services\Families\FamilyGate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Голосові кімнати сімей і спільнот: хто може зайти й керувати, список із присутніми, вхід через LiveKit.
 * Права сім’ї — з матриці рангів (voice.manage), спільноти — керівні ролі; адміністратор сайту може все.
 * Кімнати з шаблонів адмінки з’являються в кожній сім’ї; хто може зайти — ранги кімнати (права сім’ї).
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

    /** Чи може людина зайти саме в цю кімнату: у сім’ї — за рангами кімнати. */
    public function canEnter(?User $user, VoiceRoom $room, Family|Community|null $owner = null): bool
    {
        $owner ??= $this->ownerOf($room);
        if (! $this->canJoin($user, $owner)) {
            return false;
        }
        if (! $owner instanceof Family) {
            return true;
        }
        $member = $this->gate->member($owner, $user);

        return $member !== null && ($member->user_id === $owner->owner_id || $room->allowsRank($member->rank));
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
     * Кімнати з присутніми; першого разу створює «Загальну». Закриті для людини кімнати
     * показуємо із замком і без списку присутніх (керівники бачать усіх).
     *
     * @return list<array<string, mixed>>
     */
    public function list(Family|Community $owner, ?User $viewer = null): array
    {
        [$type, $id] = $this->key($owner);
        if ($owner instanceof Family) {
            $this->syncTemplates($owner);
        }
        $rooms = VoiceRoom::query()->where('owner_type', $type)->where('owner_id', $id)
            ->orderBy('position')->orderBy('id')
            ->with(['participants' => fn ($q) => $q->orderBy('joined_at'), 'participants.user'])
            ->get();

        if ($rooms->isEmpty()) {
            VoiceRoom::query()->create(['owner_type' => $type, 'owner_id' => $id, 'name' => 'Загальна', 'position' => 0]);

            return $this->list($owner, $viewer);
        }
        $manager = $this->canManage($viewer, $owner);

        $userIds = [];
        foreach ($rooms as $room) {
            foreach ($room->participants as $participant) {
                $userIds[] = $participant->user_id;
            }
        }
        $names = $owner instanceof Family ? $this->familyNames($owner, $userIds) : [];

        $list = [];
        foreach ($rooms as $room) {
            $locked = ! $this->canEnter($viewer, $room, $owner);
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
            $list[] = [
                'id' => $room->id,
                'name' => $room->name,
                'locked' => $locked,
                'system' => $room->template_id !== null,
                'ranks' => $room->ranks,
                'count' => count($people),
                'participants' => $locked && ! $manager ? [] : $people,
            ];
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
            'rooms' => $this->list($owner, $user),
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
        if ($room->template_id !== null) {
            throw ValidationException::withMessages(['room' => 'Цю кімнату додала адміністрація сайту — її можна лише перейменувати.']);
        }
        if (VoiceRoom::query()->where('owner_type', $type)->where('owner_id', $id)->count() <= 1) {
            throw ValidationException::withMessages(['room' => 'Остання кімната лишається — її можна лише перейменувати.']);
        }

        $this->livekit->deleteRoom($room->livekitName());
        $room->delete();
        $this->changed($owner);
    }

    /**
     * Кімнати сім’ї для матриці прав: ключ voice.room.{id} → ранги, яким відкрита.
     *
     * @return array{labels: array<string, string>, matrix: array<string, list<int>>}
     */
    public function familyAccess(Family $family): array
    {
        $this->syncTemplates($family);
        $labels = [];
        $matrix = [];
        foreach (VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_FAMILY)->where('owner_id', $family->id)->orderBy('position')->orderBy('id')->get() as $room) {
            $labels[$room->permissionKey()] = 'Голосова кімната «'.$room->name.'»: заходити';
            $matrix[$room->permissionKey()] = $room->ranks ?? range(1, 9);
        }

        return ['labels' => $labels, 'matrix' => $matrix];
    }

    /**
     * Зберігає доступ до кімнат із матриці прав. Повертає [було, стало] для аудиту.
     *
     * @param  array<string, list<int>>  $matrix  ключі voice.room.{id}
     * @return array{0: array<string, list<int>|null>, 1: array<string, list<int>|null>}
     */
    public function saveFamilyAccess(Family $family, array $matrix): array
    {
        $before = [];
        $after = [];
        $rooms = VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_FAMILY)->where('owner_id', $family->id)->get();
        foreach ($rooms as $room) {
            if (! array_key_exists($room->permissionKey(), $matrix)) {
                continue;
            }
            $ranks = VoiceRoomTemplate::normalizeRanks($matrix[$room->permissionKey()]);
            if ($ranks !== $room->ranks) {
                $before[$room->name] = $room->ranks;
                $after[$room->name] = $ranks;
                $room->update(['ranks' => $ranks]);
            }
        }
        if ($after !== []) {
            $this->changed($family);
        }

        return [$before, $after];
    }

    /** Додає в сім’ю кімнати з шаблонів адмінки, яких у неї ще немає. */
    public function syncTemplates(Family $family): void
    {
        $have = VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_FAMILY)->where('owner_id', $family->id)
            ->whereNotNull('template_id')->pluck('template_id')->all();

        foreach (VoiceRoomTemplate::query()->whereNotIn('id', $have)->orderBy('position')->orderBy('id')->get() as $template) {
            VoiceRoom::query()->create([
                'owner_type' => VoiceRoom::OWNER_FAMILY,
                'owner_id' => $family->id,
                'name' => $template->name,
                'position' => $template->position,
                'ranks' => $template->ranks,
                'template_id' => $template->id,
            ]);
        }
    }

    /**
     * Адмінка змінила шаблон: назва — в усіх сім’ях, доступ — лише якщо просили застосувати.
     *
     * @param  list<int>|null  $ranks
     */
    public function updateTemplate(VoiceRoomTemplate $template, string $name, ?array $ranks, bool $applyRanks): void
    {
        $template->update(['name' => $name, 'ranks' => VoiceRoomTemplate::normalizeRanks($ranks)]);
        $template->rooms()->update(['name' => $name]);
        if ($applyRanks) {
            $template->rooms()->update(['ranks' => $template->ranks === null ? null : json_encode($template->ranks)]);
        }
        $this->templateChanged($template);
    }

    /** Шаблон видалено: кімнати зникають з усіх сімей, розмови в них завершуються. */
    public function deleteTemplate(VoiceRoomTemplate $template): void
    {
        $families = [];
        foreach ($template->rooms()->get() as $room) {
            $this->livekit->deleteRoom($room->livekitName());
            $families[$room->owner_id] = true;
        }
        $template->delete();
        foreach (Family::query()->whereIn('id', array_keys($families))->get() as $family) {
            $this->changed($family);
        }
    }

    private function templateChanged(VoiceRoomTemplate $template): void
    {
        $ids = $template->rooms()->distinct()->pluck('owner_id')->all();
        foreach (Family::query()->whereIn('id', $ids)->get() as $family) {
            $this->changed($family);
        }
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
