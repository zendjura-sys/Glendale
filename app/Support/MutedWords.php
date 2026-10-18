<?php

namespace App\Support;

use App\Models\Post;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;

/**
 * Фрази, які людина не хоче бачити в стрічці і в сповіщеннях.
 */
class MutedWords
{
    /**
     * @return list<string>
     */
    public static function phrases(User $user): array
    {
        if (! app(Plugins::class)->on('muted_words')) {
            return [];
        }
        $stored = $user->pref('mute_words', []);
        if (! is_array($stored)) {
            return [];
        }

        $phrases = [];
        foreach ($stored as $phrase) {
            $phrase = trim((string) $phrase);
            if ($phrase !== '') {
                $phrases[] = $phrase;
            }
        }

        return array_values(array_unique($phrases));
    }

    /**
     * @param  list<string>  $raw
     * @return list<string>
     */
    public static function normalize(array $raw): array
    {
        $phrases = [];
        foreach ($raw as $phrase) {
            $phrase = trim((string) $phrase);
            if ($phrase === '' || mb_strlen($phrase) > 40) {
                continue;
            }
            $phrases[] = $phrase;
        }

        return array_slice(array_values(array_unique($phrases)), 0, 20);
    }

    public static function blocks(User $user, ?string ...$texts): bool
    {
        $haystack = mb_strtolower(implode("\n", array_filter($texts, fn (?string $text) => is_string($text) && $text !== '')));
        if ($haystack === '') {
            return false;
        }

        foreach (self::phrases($user) as $phrase) {
            if (mb_stripos($haystack, mb_strtolower($phrase)) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  Builder<Post>  $query
     */
    public static function hidePosts(Builder $query, User $user): void
    {
        foreach (self::phrases($user) as $phrase) {
            $like = '%'.addcslashes($phrase, '%_\\').'%';
            $query->where(fn (Builder $inner) => $inner->whereNull('body')->orWhere('body', 'not like', $like));
        }
    }
}
