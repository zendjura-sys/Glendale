<?php

namespace App\Services;

use App\Models\ClanMember;
use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PlayedPlace;
use App\Models\User;
use App\Services\Quests\SeasonPass;
use App\Support\Modules\ModuleManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Game Card — картка гравця для поширення: рівень і звання, ігри, сервери, сім’я й клан, сезон, нагороди,
 * улюблений виконавець. Закритий профіль показує стороннім лише публічне: ім’я, рівень, сім’ю й клан.
 */
class GameCard
{
    public function __construct(private readonly ModuleManager $modules) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user, bool $full): array
    {
        $achievements = app(Achievements::class)->for($user);

        return Cache::remember("game-card.{$user->id}.".($full ? 'full' : 'public'), now()->addMinutes(10), fn () => [
            'level' => $achievements['level'],
            'title' => $achievements['title'],
            'badges' => ['earned' => $achievements['earned'], 'total' => $achievements['total']],
            'since' => $user->created_at->year,
            'family' => $this->family($user),
            'clan' => $this->clan($user),
            'season' => $this->modules->enabled('quests') ? $this->season($user) : null,
            'games' => $full ? $this->games($user) : [],
            'servers' => $full && $this->modules->enabled('servers') ? $this->servers($user) : [],
            'artist' => $full && $this->modules->enabled('music') && $user->showsListening() ? $this->topArtist($user) : null,
        ]);
    }

    /**
     * @return array{name: string, tag: string|null}|null
     */
    private function family(User $user): ?array
    {
        $member = FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->latest('joined_at')->first();

        return $member?->family ? ['name' => $member->family->name, 'tag' => $member->family->tag] : null;
    }

    /**
     * @return array{name: string, tag: string|null}|null
     */
    private function clan(User $user): ?array
    {
        $member = ClanMember::query()->with('clan')->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->latest('id')->first();

        return $member?->clan ? ['name' => $member->clan->name, 'tag' => $member->clan->tag] : null;
    }

    /**
     * @return array{level: int, max: int}
     */
    private function season(User $user): array
    {
        $board = app(SeasonPass::class)->board($user);

        return ['level' => (int) $board['level'], 'max' => (int) $board['max_level']];
    }

    /**
     * @return list<string>
     */
    private function games(User $user): array
    {
        $ids = PlayedPlace::query()->where('user_id', $user->id)->where('kind', PlayedPlace::GAME)->latest('id')->limit(4)->pluck('subject_id');

        return array_values(Game::query()->whereIn('id', $ids)->pluck('name')->map(fn ($n) => (string) $n)->all());
    }

    /**
     * @return list<string>
     */
    private function servers(User $user): array
    {
        $ids = PlayedPlace::query()->where('user_id', $user->id)->where('kind', PlayedPlace::SERVER)->latest('id')->limit(3)->pluck('subject_id');

        return array_values(GtaServer::query()->whereIn('id', $ids)->pluck('name')->map(fn ($n) => (string) $n)->all());
    }

    private function topArtist(User $user): ?string
    {
        $artist = DB::table('music_plays')->where('user_id', $user->id)->where('artist', '!=', '')->where('played_at', '>=', now()->subDays(90))
            ->groupBy('artist')->selectRaw('artist, COUNT(*) as total')->orderByDesc('total')->value('artist');

        return $artist === null ? null : (string) $artist;
    }
}
