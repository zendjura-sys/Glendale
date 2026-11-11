<?php

namespace App\Support;

use App\Models\User;
use App\Support\Plugins\Plugins;
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
    public const KEYS = ['likes', 'comments', 'mentions', 'events', 'playing', 'deals', 'site', 'email', 'push'];

    /**
     * Розділи, які можна вимкнути цілком (усі сповіщення розділу) — модуль сайту й назва.
     *
     * @var array<string, string>
     */
    public const SECTIONS = [
        'families' => 'Сім’ї',
        'clans' => 'Клани',
        'servers' => 'Сервери й турніри',
        'games' => 'Ігри, знижки й роздачі',
        'cinema' => 'Кіно',
        'music' => 'Музика',
        'party' => 'Пошук паті',
        'communities' => 'Спільноти',
        'events' => 'Події',
    ];

    /** @var array<string, string> */
    private const KINDS = [
        'post_like' => 'likes',
        'photo_like' => 'likes',
        'post_comment' => 'comments',
        'photo_comment' => 'comments',
        'mention' => 'mentions',
        'event_reminder' => 'events',
        'listen_room' => 'events',
        'tournament' => 'events',
        'friend_playing' => 'playing',
        'giveaway' => 'deals',
        'price_drop' => 'deals',
        'game_release' => 'deals',
        'game_night_invite' => 'events',
        'game_night_set' => 'events',
        'broadcast' => 'site',
    ];

    /**
     * Розділ (або функція режиму) кожного виду: без нього в режимі людини сповіщення не надходить.
     *
     * @var array<string, string>
     */
    private const MODE = [
        'tournament' => 'servers',
        'giveaway' => 'games',
        'price_drop' => 'games',
        'game_release' => 'games',
        'listen_room' => 'music',
        'clip_of_week' => 'moments',
        'event_reminder' => 'events',
        'movie_rating' => 'cinema',
        'party_join' => 'party',
        'party_invite' => 'party',
        'party_time' => 'party',
        'party_full' => 'party',
        'game_patch' => 'games',
        'game_night_invite' => 'games',
        'game_night_set' => 'games',
        'family_' => 'families',
        'friend_playing' => 'feature:playing',
        'stream_live' => 'feature:live',
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
        if (! app(Plugins::class)->on('notify_switches')) {
            return $key === 'email' ? $user->email_social !== false : true;
        }
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
        if (! self::inMode($user, $kind)) {
            return false;
        }
        $section = self::section($kind);
        if ($section !== null && ! self::sectionOn($user, $section)) {
            return false;
        }
        $type = self::KINDS[$kind] ?? null;

        return $type === null || self::enabled($user, $type);
    }

    /** Розділ виду сповіщення (для вимкнення розділу цілком) або null, якщо вид загальний. */
    public static function section(string $kind): ?string
    {
        foreach (['family_' => 'families', 'clan_' => 'clans', 'community_' => 'communities', 'movie_' => 'cinema', 'episode' => 'cinema', 'server_' => 'servers', 'party_' => 'party'] as $prefix => $section) {
            if (str_starts_with($kind, $prefix)) {
                return $section;
            }
        }
        $need = self::MODE[$kind] ?? null;

        return $need !== null && ! str_starts_with($need, 'feature:') && array_key_exists($need, self::SECTIONS) ? $need : null;
    }

    /** Чи ввімкнені сповіщення розділу (за замовчуванням — так). */
    public static function sectionOn(User $user, string $section): bool
    {
        $sections = $user->pref('notify_sections');

        return ! is_array($sections) || ! array_key_exists($section, $sections) || (bool) $sections[$section];
    }

    /**
     * @return array<string, bool>
     */
    public static function sections(User $user): array
    {
        return collect(self::SECTIONS)->mapWithKeys(fn (string $label, string $key) => [$key => self::sectionOn($user, $key)])->all();
    }

    /** Чи є розділ виду сповіщення в режимі людини (працює й у черзі, без запиту). */
    public static function inMode(User $user, string $kind): bool
    {
        $need = self::MODE[$kind] ?? (str_starts_with($kind, 'family_') ? self::MODE['family_'] : null);
        if ($need === null) {
            return true;
        }
        $modes = app(NetworkModes::class);

        return str_starts_with($need, 'feature:')
            ? (bool) ($modes->featuresFor($user)[substr($need, 8)] ?? true)
            : in_array($need, $modes->modulesFor($user), true);
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
