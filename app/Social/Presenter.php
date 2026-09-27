<?php

namespace App\Social;

use App\Models\User;
use App\Support\Presence;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Серіалізація в JSON, який чекає клієнт (resources/app/lib/types.ts).
 * На відміну від Glendale, записи гідруються пакетом — однаковими
 * запитами на всю сторінку стрічки, а не по кілька запитів на запис.
 */
final class Presenter
{
    public static function ms(mixed $time): int
    {
        if ($time === null) {
            return 0;
        }
        if (! $time instanceof \DateTimeInterface) {
            $time = \Illuminate\Support\Carbon::parse($time);
        }

        return (int) ($time->getTimestamp() * 1000);
    }

    // ───────────── люди ─────────────

    public static function userShort(?User $u): ?array
    {
        if (! $u) {
            return null;
        }

        return [
            'id' => $u->id,
            'firstName' => (string) ($u->first_name ?: $u->name),
            'lastName' => (string) ($u->last_name ?? ''),
            'avatar' => Social::url($u->avatar_path),
            'online' => Presence::isOnline($u),
            'lastSeen' => self::ms($u->last_seen_at ?? $u->created_at),
            // Галочка — учасник із посадою в родині (не гість платформи).
            'verified' => $u->position_key !== null && ! $u->is_shadow,
        ];
    }

    public static function userFull(User $u): array
    {
        return [
            ...self::userShort($u),
            'cover' => Social::url($u->cover_path),
            'status' => (string) $u->status,
            'bio' => (string) $u->bio,
            'city' => (string) $u->city,
            'birthday' => $u->birth_date?->format('Y-m-d') ?? '',
            'createdAt' => self::ms($u->created_at),
        ];
    }

    public static function me(User $u): array
    {
        return [
            ...self::userFull($u),
            'email' => $u->email,
            'hasPassword' => true,
            'level' => Social::level($u),
            'permissions' => ['post' => true, 'comment' => true, 'message' => true, 'createGroups' => true, 'upload' => true],
            // Для меню «Моя родина»: у яких родинах людина і з якою роллю.
            'families' => DB::table('family_members as m')->join('families as f', 'f.id', '=', 'm.family_id')
                ->where('m.user_id', $u->id)->where('f.status', '!=', 'rejected')
                ->orderByRaw("CASE m.role WHEN 'leader' THEN 0 WHEN 'deputy' THEN 1 ELSE 2 END")
                ->get(['f.id', 'f.name', 'f.tag', 'f.status', 'm.role'])
                ->map(fn ($f) => ['id' => $f->id, 'name' => $f->name, 'tag' => $f->tag, 'status' => $f->status, 'role' => $f->role])
                ->values()->all(),
            'canManageFamilies' => $u->can('families.manage'),
        ];
    }

    /** @param  iterable<int>  $ids  @return Collection<int, User> */
    public static function users(iterable $ids): Collection
    {
        $ids = collect($ids)->filter()->unique()->values();

        return $ids->isEmpty() ? collect() : User::query()->whereIn('id', $ids)->get()->keyBy('id');
    }

    // ───────────── спільноти ─────────────

    /** @param  list<object>  $groups */
    public static function groups(array $groups, int $meId): array
    {
        if (! $groups) {
            return [];
        }
        $ids = array_map(fn ($g) => $g->id, $groups);

        $counts = DB::table('social_group_members')->whereIn('group_id', $ids)
            ->groupBy('group_id')->selectRaw('group_id, COUNT(*) as c')->pluck('c', 'group_id');
        $roles = DB::table('social_group_members')->whereIn('group_id', $ids)->where('user_id', $meId)->pluck('role', 'group_id');
        $requested = DB::table('social_group_requests')->whereIn('group_id', $ids)->where('user_id', $meId)->pluck('group_id')->flip();
        $requests = DB::table('social_group_requests')->whereIn('group_id', $ids)
            ->groupBy('group_id')->selectRaw('group_id, COUNT(*) as c')->pluck('c', 'group_id');

        return array_map(function ($g) use ($counts, $roles, $requested, $requests, $meId) {
            $role = $roles[$g->id] ?? null;

            return [
                'id' => $g->id,
                'name' => $g->name,
                'description' => (string) $g->description,
                'avatar' => Social::url($g->avatar_path),
                'cover' => Social::url($g->cover_path),
                'ownerId' => $g->owner_id,
                'privacy' => $g->privacy === 'closed' ? 'closed' : 'open',
                'membersCount' => (int) ($counts[$g->id] ?? 0),
                'isMember' => $role !== null,
                'isAdmin' => $role === 'admin',
                'isOwner' => $g->owner_id === $meId,
                'requested' => $role === null && isset($requested[$g->id]),
                'requestsCount' => $role === 'admin' ? (int) ($requests[$g->id] ?? 0) : 0,
                'createdAt' => self::ms($g->created_at),
            ];
        }, $groups);
    }

    public static function group(object $g, int $meId): array
    {
        return self::groups([$g], $meId)[0];
    }

    // ───────────── записи ─────────────

    /** @param  list<object>  $rows  рядки social_posts */
    public static function posts(array $rows, User $me, int $depth = 0): array
    {
        if (! $rows) {
            return [];
        }
        $meId = $me->id;
        $ids = array_map(fn ($p) => $p->id, $rows);

        $likes = DB::table('social_likes')->whereIn('post_id', $ids)->groupBy('post_id')->selectRaw('post_id, COUNT(*) as c')->pluck('c', 'post_id');
        $liked = DB::table('social_likes')->whereIn('post_id', $ids)->where('user_id', $meId)->pluck('post_id')->flip();
        $comments = DB::table('social_comments')->whereIn('post_id', $ids)->groupBy('post_id')->selectRaw('post_id, COUNT(*) as c')->pluck('c', 'post_id');
        $reposts = DB::table('social_posts')->whereIn('repost_of', $ids)->groupBy('repost_of')->selectRaw('repost_of, COUNT(*) as c')->pluck('c', 'repost_of');
        $reposted = DB::table('social_posts')->whereIn('repost_of', $ids)->where('author_id', $meId)->pluck('repost_of')->flip();

        $userIds = [];
        $groupIds = [];
        foreach ($rows as $p) {
            $userIds[] = $p->author_id;
            if ($p->owner_type === 'user') {
                $userIds[] = $p->owner_id;
            } else {
                $groupIds[] = $p->owner_id;
            }
        }
        $users = self::users($userIds);
        $groupRows = $groupIds ? DB::table('social_groups')->whereIn('id', array_unique($groupIds))->get()->all() : [];
        $groups = collect(self::groups($groupRows, $meId))->keyBy('id');
        $adminOf = $groupIds ? DB::table('social_group_members')->whereIn('group_id', $groupIds)->where('user_id', $meId)->where('role', 'admin')->pluck('group_id')->flip() : collect();
        $staff = Social::isStaff($me);

        $sources = collect();
        if ($depth < 1) {
            $sourceIds = array_values(array_filter(array_map(fn ($p) => $p->repost_of, $rows)));
            if ($sourceIds) {
                $sourceRows = DB::table('social_posts')->whereIn('id', $sourceIds)->get()->all();
                $sources = collect(self::posts($sourceRows, $me, $depth + 1))->keyBy('id');
            }
        }

        return array_map(function ($p) use ($meId, $likes, $liked, $comments, $reposts, $reposted, $users, $groups, $adminOf, $staff, $sources) {
            $canDelete = $p->author_id === $meId
                || ($p->owner_type === 'user' && $p->owner_id === $meId)
                || ($p->owner_type === 'group' && isset($adminOf[$p->owner_id]))
                || $staff;

            return [
                'id' => $p->id,
                'text' => (string) $p->text,
                'image' => Social::url($p->image_path),
                'createdAt' => self::ms($p->created_at),
                'ownerType' => $p->owner_type,
                'ownerId' => $p->owner_id,
                'fromGroup' => (bool) $p->from_group,
                'author' => self::userShort($users[$p->author_id] ?? null),
                'group' => $p->owner_type === 'group' ? ($groups[$p->owner_id] ?? null) : null,
                'wallOwner' => $p->owner_type === 'user' && $p->owner_id !== $p->author_id ? self::userShort($users[$p->owner_id] ?? null) : null,
                'repost' => $p->repost_of ? ($sources[$p->repost_of] ?? null) : null,
                'audio' => null,
                'spotify' => self::spotifyRef($p->spotify ?: (string) $p->text),
                'likes' => (int) ($likes[$p->id] ?? 0),
                'liked' => isset($liked[$p->id]),
                'comments' => (int) ($comments[$p->id] ?? 0),
                'reposts' => (int) ($reposts[$p->id] ?? 0),
                'reposted' => isset($reposted[$p->id]),
                'canDelete' => $canDelete,
            ];
        }, $rows);
    }

    public static function post(object $row, User $me): array
    {
        return self::posts([$row], $me)[0];
    }

    /** Посилання open.spotify.com → вбудовувана картка. */
    public static function spotifyRef(string $value): ?array
    {
        if (! preg_match('~open\.spotify\.com/(?:intl-[a-z-]+/)?(track|album|playlist|episode|show|artist)/([A-Za-z0-9]{10,40})~', $value, $m)) {
            return null;
        }

        return ['type' => $m[1], 'id' => $m[2]];
    }

    // ───────────── коментарі, фото, сповіщення ─────────────

    /** @param  list<object>  $rows */
    public static function comments(array $rows): array
    {
        $users = self::users(array_map(fn ($c) => $c->author_id, $rows));

        return array_map(fn ($c) => [
            'id' => $c->id,
            'postId' => $c->post_id,
            'text' => $c->text,
            'createdAt' => self::ms($c->created_at),
            'author' => self::userShort($users[$c->author_id] ?? null),
        ], $rows);
    }

    public static function photo(object $p): array
    {
        return ['id' => $p->id, 'url' => Social::url($p->path), 'album' => $p->album, 'createdAt' => self::ms($p->created_at)];
    }

    /** @param  list<object>  $rows */
    public static function notifications(array $rows): array
    {
        $users = self::users(array_map(fn ($n) => $n->actor_id, $rows));
        $postIds = array_values(array_filter(array_map(fn ($n) => $n->post_id, $rows)));
        $posts = $postIds ? DB::table('social_posts')->whereIn('id', $postIds)->get(['id', 'text', 'image_path'])->keyBy('id') : collect();

        return array_map(function ($n) use ($users, $posts) {
            $post = $n->post_id ? ($posts[$n->post_id] ?? null) : null;

            return [
                'id' => $n->id,
                'type' => $n->type,
                'text' => $n->text,
                'isRead' => (bool) $n->is_read,
                'createdAt' => self::ms($n->created_at),
                'actor' => self::userShort($users[$n->actor_id] ?? null),
                'post' => $post ? ['id' => $post->id, 'text' => mb_substr((string) $post->text, 0, 120), 'image' => Social::url($post->image_path)] : null,
                'groupId' => $n->group_id,
                'familyId' => $n->family_id ?? null,
                'unionId' => $n->union_id ?? null,
            ];
        }, $rows);
    }
}
