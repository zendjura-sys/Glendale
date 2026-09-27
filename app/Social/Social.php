<?php

namespace App\Social;

use App\Models\User;
use App\Support\UnreadCounters;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Спільні правила соцмережі: рівні доступу, дружба, спільноти, сповіщення.
 * Логіка перенесена з Glendale (server/src/models.js, api.js) — поведінку
 * клієнта не міняємо, тому й відповіді ті самі.
 */
final class Social
{
    public const PAGE = 20;

    /** Відповідь-помилка у форматі, який чекає клієнт: { error, code }. */
    public static function fail(int $status, string $message, ?string $code = null): never
    {
        throw new HttpResponseException(response()->json(array_filter([
            'error' => $message,
            'code' => $code,
        ], fn ($v) => $v !== null), $status));
    }

    /** Курсорна пагінація: ?before=<id> — записи зі старішим id. */
    public static function before(Request $request): int
    {
        $before = (int) $request->query('before');

        return $before > 0 ? $before : PHP_INT_MAX;
    }

    /** @param  list<array{id:int}>  $items */
    public static function page(array $items): array
    {
        return [
            'items' => $items,
            'nextCursor' => count($items) === self::PAGE ? $items[count($items) - 1]['id'] : null,
        ];
    }

    public static function str(mixed $value, int $max): string
    {
        return is_string($value) ? mb_substr(trim($value), 0, $max) : '';
    }

    // ───────────── рівні доступу ─────────────

    /**
     * Рівень у термінах клієнта Glendale. Джерело — ролі й права сайту
     * (spatie), окремої таблиці рівнів немає: адміністратор родини є
     * адміністратором і в соцмережі.
     *
     * @return array{id:int, title:string, type:string}
     */
    public static function level(User $user): array
    {
        if ($user->hasRole('admin')) {
            return ['id' => 1, 'title' => 'Адміністратор', 'type' => 'admin'];
        }
        if ($user->can('users.manage') || $user->can('members.manage') || $user->can('reports.manage')) {
            return ['id' => 3, 'title' => 'Модератор', 'type' => 'moderator'];
        }

        return ['id' => 4, 'title' => 'Учасник', 'type' => 'user'];
    }

    public static function isStaff(User $user): bool
    {
        return self::level($user)['type'] !== 'user';
    }

    // ───────────── дружба ─────────────

    public static function areFriends(int $a, int $b): bool
    {
        return DB::table('social_friends')->where('user_id', $a)->where('friend_id', $b)->exists();
    }

    public static function friendship(int $me, int $other): string
    {
        if ($me === $other) {
            return 'self';
        }
        if (self::areFriends($me, $other)) {
            return 'friends';
        }
        if (DB::table('social_friend_requests')->where('from_id', $me)->where('to_id', $other)->exists()) {
            return 'outgoing';
        }
        if (DB::table('social_friend_requests')->where('from_id', $other)->where('to_id', $me)->exists()) {
            return 'incoming';
        }

        return 'none';
    }

    // ───────────── спільноти ─────────────

    public static function group(int $id): ?object
    {
        return DB::table('social_groups')->find($id);
    }

    public static function isGroupAdmin(int $groupId, int $userId): bool
    {
        return DB::table('social_group_members')
            ->where('group_id', $groupId)->where('user_id', $userId)->where('role', 'admin')
            ->exists();
    }

    public static function isGroupMember(int $groupId, int $userId): bool
    {
        return DB::table('social_group_members')->where('group_id', $groupId)->where('user_id', $userId)->exists();
    }

    public static function canSeeGroup(int $groupId, User $user): bool
    {
        $group = self::group($groupId);
        if (! $group) {
            return false;
        }

        return $group->privacy !== 'closed' || self::isGroupMember($groupId, $user->id) || self::isStaff($user);
    }

    /** Стіна родини — для її учасників (і адміністрації платформи). */
    public static function canSeeFamilyWall(int $familyId, User $user): bool
    {
        return \App\Families\FamilyContext::isMember($user, $familyId) || $user->can('families.manage');
    }

    /** Приховує записи закритих спільнот і стін чужих родин. */
    public static function visiblePosts(Builder $query, int $viewerId): Builder
    {
        return $query->whereNot(function (Builder $q) use ($viewerId) {
            $q->where('social_posts.owner_type', 'group')
                ->whereIn('social_posts.owner_id', function (Builder $sub) use ($viewerId) {
                    $sub->select('g.id')->from('social_groups as g')->where('g.privacy', 'closed')
                        ->whereNotIn('g.id', fn (Builder $m) => $m->select('group_id')->from('social_group_members')->where('user_id', $viewerId));
                });
        })->whereNot(function (Builder $q) use ($viewerId) {
            $q->where('social_posts.owner_type', 'family')
                ->whereNotIn('social_posts.owner_id', fn (Builder $m) => $m->select('family_id')->from('family_members')->where('user_id', $viewerId));
        });
    }

    // ───────────── сповіщення та лічильники ─────────────

    public static function notify(int $userId, int $actorId, string $type, ?int $postId = null, ?int $groupId = null, string $text = ''): void
    {
        if ($userId === $actorId) {
            return;
        }

        DB::table('social_notifications')->insert([
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'post_id' => $postId,
            'group_id' => $groupId,
            'text' => mb_substr($text, 0, 200),
            'created_at' => now(),
        ]);
    }

    /** @return array{messages:int, friends:int, notifications:int} */
    public static function counters(int $userId): array
    {
        return [
            'messages' => UnreadCounters::messages($userId),
            'friends' => DB::table('social_friend_requests')->where('to_id', $userId)->count(),
            'notifications' => DB::table('social_notifications')->where('user_id', $userId)->where('is_read', false)->count(),
        ];
    }

    // ───────────── файли ─────────────

    public static function url(?string $path): ?string
    {
        return $path ? Storage::disk('public')->url($path) : null;
    }

    public static function storeImage(\Illuminate\Http\UploadedFile $file, string $dir = 'social'): string
    {
        return $file->store($dir.'/'.now()->format('Y/m'), 'public');
    }

    /** Правила валідації завантажуваного фото (до 10 МБ). */
    public const IMAGE_RULES = ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:10240'];
}
