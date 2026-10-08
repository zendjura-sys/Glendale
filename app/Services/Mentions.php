<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\Mention;
use Illuminate\Support\Collection;

/**
 * @ім’я в тексті поста чи коментаря.
 */
class Mentions
{
    /**
     * @return Collection<int, User>
     */
    public function people(?string $text, User $actor): Collection
    {
        if ($text === null || preg_match_all('/@([A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9])/', $text, $match) < 1) {
            return new Collection;
        }

        $names = array_values(array_unique(array_map(strtolower(...), $match[1])));

        return User::query()
            ->whereNull('banned_at')
            ->whereKeyNot($actor->id)
            ->where(function ($query) use ($names) {
                foreach ($names as $name) {
                    $query->orWhereRaw('lower(username) = ?', [$name]);
                }
            })
            ->limit(12)
            ->get();
    }

    public function notify(User $actor, ?string $text, string $url): void
    {
        $excerpt = $text === null ? null : mb_substr(trim($text), 0, 80);
        $this->people($text, $actor)->each(function (User $user) use ($actor, $url, $excerpt) {
            $user->notify(new Mention($actor, $url, $excerpt));
        });
    }
}
