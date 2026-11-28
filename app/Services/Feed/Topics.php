<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/** Підписки на теми (хештеги): вкладка «Теми» в стрічці й сторінка теми. */
class Topics
{
    public const MAX = 30;

    public static function normalize(string $tag): string
    {
        return mb_strtolower(trim(ltrim(trim($tag), '#')));
    }

    public static function valid(string $tag): bool
    {
        return (bool) preg_match('/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,39}$/u', $tag);
    }

    /**
     * @return list<string>
     */
    public function of(User $user): array
    {
        $topics = $user->pref('topics');

        return is_array($topics) ? array_values(array_filter($topics, fn ($t) => is_string($t) && self::valid($t))) : [];
    }

    /** Підписатися або відписатися; повертає новий стан. */
    public function toggle(User $user, string $tag): bool
    {
        $tag = self::normalize($tag);
        if (! self::valid($tag)) {
            throw ValidationException::withMessages(['tag' => 'Така тема не підходить.']);
        }
        $topics = $this->of($user);
        $following = in_array($tag, $topics, true);
        if (! $following && count($topics) >= self::MAX) {
            throw ValidationException::withMessages(['tag' => 'Можна стежити щонайбільше за '.self::MAX.' темами.']);
        }
        $user->mergePref(['topics' => $following ? array_values(array_diff($topics, [$tag])) : [...$topics, $tag]]);

        return ! $following;
    }

    /**
     * Записи з будь-яким із хештегів.
     *
     * @param  Builder<Post>  $query
     * @param  list<string>  $tags
     */
    public function apply(Builder $query, array $tags): void
    {
        if ($tags === []) {
            $query->whereRaw('1 = 0');

            return;
        }
        $query->where(function (Builder $q) use ($tags) {
            foreach ($tags as $tag) {
                $q->orWhere('body', 'like', '%#'.$tag.'%');
            }
        });
    }
}
