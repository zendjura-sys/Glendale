<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Які сповіщення і якими каналами отримує людина.
 * Незаповнені ключі лишають звичну поведінку: усе ввімкнено, пошта — як email_social.
 */
class NotifyPrefs
{
    /** @var list<string> */
    public const KEYS = ['likes', 'comments', 'mentions', 'events', 'playing', 'site', 'email', 'push'];

    /** @var array<string, string> */
    private const KINDS = [
        'post_like' => 'likes',
        'photo_like' => 'likes',
        'post_comment' => 'comments',
        'photo_comment' => 'comments',
        'mention' => 'mentions',
        'event_reminder' => 'events',
        'friend_playing' => 'playing',
    ];

    /**
     * @return array<string, bool>
     */
    public static function for(User $user): array
    {
        $prefs = [];
        foreach (self::KEYS as $key) {
            $prefs[$key] = self::enabled($user, $key);
        }

        return $prefs;
    }

    public static function enabled(User $user, string $key): bool
    {
        $notify = $user->pref('notify');
        if (is_array($notify) && array_key_exists($key, $notify)) {
            return (bool) $notify[$key];
        }

        if ($key === 'email') {
            return $user->email_social !== false;
        }

        return true;
    }

    public static function allowsKind(User $user, string $kind): bool
    {
        $type = self::KINDS[$kind] ?? null;

        return $type === null || self::enabled($user, $type);
    }

    /**
     * Канали Laravel. Пошта й push ідуть слідом за записом у дзвіночок і дивляться свої перемикачі.
     *
     * @return list<string>
     */
    public static function channels(object $notifiable, ?string $kind = null, bool $honorQuiet = true): array
    {
        if (! $notifiable instanceof User) {
            return ['database'];
        }
        if ($honorQuiet && $notifiable->inQuietHours()) {
            return [];
        }
        if ($kind !== null && ! self::allowsKind($notifiable, $kind)) {
            return [];
        }

        return ['database'];
    }

    /**
     * @template T of Builder<DatabaseNotification>|Relation<DatabaseNotification, *, *>
     *
     * @param  T  $query
     * @return T
     */
    public static function visible(Builder|Relation $query): Builder|Relation
    {
        return $query->where(function (Builder $inner) {
            $inner->where('data->hidden', false)->orWhereNull('data->hidden');
        });
    }

    public static function unreadCount(User $user): int
    {
        return self::visible($user->unreadNotifications())->count();
    }
}
