<?php

namespace App\Services;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\Post;
use App\Models\Save;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Збережені пости, фільми, ігри й сервери.
 */
class SavedItems
{
    public function has(User $user, string $kind, int $id): bool
    {
        return Save::query()->where('user_id', $user->id)->where('kind', $kind)->where('subject_id', $id)->exists();
    }

    public function toggle(User $user, string $kind, int $id): bool
    {
        abort_unless(in_array($kind, Save::KINDS, true) && $this->exists($kind, $id), 404);

        $existing = Save::query()->where('user_id', $user->id)->where('kind', $kind)->where('subject_id', $id)->first();
        if ($existing) {
            $existing->delete();

            return false;
        }

        Save::query()->create(['user_id' => $user->id, 'kind' => $kind, 'subject_id' => $id]);

        return true;
    }

    /**
     * @return Collection<int, Save>
     */
    public function for(User $user): Collection
    {
        return Save::query()->where('user_id', $user->id)->latest('id')->limit(80)->get();
    }

    private function exists(string $kind, int $id): bool
    {
        return match ($kind) {
            Save::POST => Post::query()->whereKey($id)->exists(),
            Save::MOVIE => Movie::query()->published()->whereKey($id)->exists(),
            Save::GAME => Game::query()->published()->whereKey($id)->exists(),
            Save::SERVER => GtaServer::query()->published()->whereKey($id)->exists(),
            default => false,
        };
    }
}
