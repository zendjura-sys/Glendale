<?php

namespace App\Services\Party;

use App\Models\PartyMember;
use App\Models\PartyPost;
use App\Models\User;
use App\Notifications\PartyJoined;
use Illuminate\Support\Carbon;

/**
 * Дошка «Пошук пати»: оголошення живе до старту + 3 години (або 3 години, якщо «зараз»),
 * автор бачить, хто з якою роллю приєднався, а учасники заходять у голосову кімнату пати.
 */
class PartyBoard
{
    /** Скільки відкритих оголошень може мати одна людина. */
    public const OPEN_LIMIT = 3;

    public const HOURS = 3;

    /**
     * @param  array{title: string, note?: string|null, platform?: string|null, roles?: list<string>, slots: int, starts_at?: Carbon|null, game_id?: int|null, gta_server_id?: int|null}  $data
     */
    public function create(User $user, array $data): PartyPost
    {
        abort_if(PartyPost::query()->open()->where('user_id', $user->id)->count() >= self::OPEN_LIMIT, 422, 'Можна мати до трьох відкритих оголошень.');
        $start = $data['starts_at'] ?? null;

        return PartyPost::query()->create([
            ...$data,
            'user_id' => $user->id,
            'roles' => ($data['roles'] ?? []) === [] ? null : $data['roles'],
            'expires_at' => ($start ?? now())->copy()->addHours(self::HOURS),
        ]);
    }

    public function join(PartyPost $party, User $user, ?string $role): void
    {
        $party->loadMissing('members');
        abort_unless($party->isOpen(), 422, 'Оголошення вже закрите.');
        abort_if($party->hasMember($user), 422, 'Ви вже в цій паті.');
        abort_if($party->members->count() + 1 >= $party->slots, 422, 'Місць більше немає.');
        if ($party->roles) {
            abort_unless($role === null || in_array($role, $party->roles, true), 422, 'Оберіть роль зі списку.');
        } else {
            $role = null;
        }

        PartyMember::query()->create(['party_post_id' => $party->id, 'user_id' => $user->id, 'role' => $role]);
        $party->user->notify(new PartyJoined($user, $party, $role));
    }

    public function leave(PartyPost $party, User $user): void
    {
        PartyMember::query()->where('party_post_id', $party->id)->where('user_id', $user->id)->delete();
    }

    public function close(PartyPost $party): void
    {
        $party->update(['closed_at' => now()]);
    }

    /**
     * @return array<string, mixed>
     */
    public function card(PartyPost $party, User $viewer): array
    {
        $party->loadMissing(['user', 'game', 'server', 'members.user']);
        $taken = [];
        foreach ($party->members as $member) {
            if ($member->role !== null) {
                $taken[] = $member->role;
            }
        }

        return [
            'id' => $party->id,
            'href' => '/party/'.$party->id,
            'title' => $party->title,
            'note' => $party->note,
            'platform' => $party->platform,
            'platform_label' => $party->platform ? (PartyPost::PLATFORMS[$party->platform] ?? $party->platform) : null,
            'roles' => $party->roles ?? [],
            'taken_roles' => $taken,
            'slots' => $party->slots,
            'count' => $party->members->count() + 1,
            'starts_at' => $party->starts_at?->toIso8601String(),
            'expires_at' => $party->expires_at->toIso8601String(),
            'open' => $party->isOpen(),
            'mine' => $party->user_id === $viewer->id,
            'joined' => $party->hasMember($viewer),
            'host' => $party->user->toCard(),
            'game' => $party->game ? ['slug' => $party->game->slug, 'name' => $party->game->name, 'cover' => $party->game->cover] : null,
            'server' => $party->server ? ['slug' => $party->server->slug, 'name' => $party->server->name, 'icon' => $party->server->icon] : null,
            'members' => array_values($party->members->map(fn (PartyMember $member) => [...$member->user->toCard(), 'role' => $member->role])->all()),
        ];
    }
}
