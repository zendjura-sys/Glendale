<?php

namespace App\Social;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Система управління родинами (публічно — «Моя родина»): правила доступу
 * й серіалізація родин і союзів для API v2.
 *
 * Статуси: pending — чекає перевірки адміністрацією; verified —
 * підтверджена; rejected — відхилена (лідер може виправити й подати
 * знову). До верифікації родину бачать лише її учасники й адміністрація.
 */
final class Families
{
    public const ROLES = ['leader', 'deputy', 'member'];

    public const ROLE_LABELS = ['leader' => 'Лідер', 'deputy' => 'Заступник', 'member' => 'Учасник'];

    /**
     * Фірмовий колір родини — 20 базових на вибір лідеру/заступнику.
     * Сторінка родини (профіль, кнопки, бейдж) підлаштовується під нього;
     * решта сайту лишається на золотому кольорі за замовчуванням.
     */
    public const COLORS = [
        '#E4572E', '#F2A03D', '#EAC435', '#8BC34A', '#2E8B57',
        '#16A085', '#00B8D9', '#2E86DE', '#3949AB', '#7B61FF',
        '#9C27B0', '#D63384', '#E63946', '#C0392B', '#A0522D',
        '#6D4C41', '#607D8B', '#4B5563', '#D4AF37', '#B0BEC5',
    ];

    public static function find(int $id): ?object
    {
        return DB::table('families')->find($id);
    }

    public static function role(int $familyId, int $userId): ?string
    {
        return DB::table('family_members')->where('family_id', $familyId)->where('user_id', $userId)->value('role');
    }

    /** Лідер або заступник — керують складом і заявками. */
    public static function canManage(object $family, User $user): bool
    {
        return in_array(self::role($family->id, $user->id), ['leader', 'deputy'], true);
    }

    public static function isAdmin(User $user): bool
    {
        return $user->can('families.manage');
    }

    public static function canView(object $family, User $user): bool
    {
        return $family->status === 'verified' || self::role($family->id, $user->id) !== null || self::isAdmin($user);
    }

    /**
     * Гравець — щонайбільше в одній родині на тому самому сервері проєкту
     * (на різних серверах можна бути в різних родинах).
     */
    public static function memberOnServer(int $userId, ?int $serverId, ?int $exceptFamily = null): ?object
    {
        if (! $serverId) {
            return null;
        }

        return DB::table('family_members as m')->join('families as f', 'f.id', '=', 'm.family_id')
            ->where('m.user_id', $userId)
            ->where('f.server_id', $serverId)
            ->where('f.status', '!=', 'rejected')
            ->when($exceptFamily, fn ($q) => $q->where('f.id', '!=', $exceptFamily))
            ->select('f.*')->first();
    }

    /** Союз, у якому зараз родина (щонайбільше один). */
    public static function unionOf(int $familyId): ?object
    {
        return DB::table('family_union_members as m')->join('family_unions as u', 'u.id', '=', 'm.union_id')
            ->where('m.family_id', $familyId)->select('u.*', 'm.role as family_role')->first();
    }

    // ───────────── серіалізація ─────────────

    /** @param  list<object>  $rows */
    public static function presentMany(array $rows, User $me): array
    {
        if (! $rows) {
            return [];
        }
        $ids = array_map(fn ($f) => $f->id, $rows);
        $counts = DB::table('family_members')->whereIn('family_id', $ids)->groupBy('family_id')
            ->selectRaw('family_id, COUNT(*) as c')->pluck('c', 'family_id');
        $myRoles = DB::table('family_members')->whereIn('family_id', $ids)->where('user_id', $me->id)->pluck('role', 'family_id');
        $requested = DB::table('family_join_requests')->whereIn('family_id', $ids)->where('user_id', $me->id)->pluck('family_id')->flip();

        return array_map(fn ($f) => [
            'id' => $f->id,
            'name' => $f->name,
            'tag' => $f->tag,
            'color' => $f->color,
            'project' => $f->project,
            'server' => $f->server,
            'projectId' => $f->project_id ?? null,
            'serverId' => $f->server_id ?? null,
            'description' => (string) $f->description,
            'avatar' => Social::url($f->avatar_path),
            'cover' => Social::url($f->cover_path),
            'status' => $f->status,
            'membersCount' => (int) ($counts[$f->id] ?? 0),
            'myRole' => $myRoles[$f->id] ?? null,
            'requested' => isset($requested[$f->id]),
            'createdAt' => Presenter::ms($f->created_at),
        ], $rows);
    }

    public static function present(object $family, User $me): array
    {
        return self::presentMany([$family], $me)[0];
    }

    public static function presentFull(object $f, User $me): array
    {
        $myRole = self::role($f->id, $me->id);
        $staff = self::isAdmin($me);
        $manage = in_array($myRole, ['leader', 'deputy'], true);
        $union = self::unionOf($f->id);
        $leader = $f->leader_id ? User::find($f->leader_id) : null;

        return [
            ...self::present($f, $me),
            'discordUrl' => $f->discord_url,
            'telegramUrl' => $f->telegram_url,
            'leader' => Presenter::userShort($leader),
            'reviewNote' => ($myRole === 'leader' || $staff) ? $f->review_note : null,
            'proof' => ($myRole === 'leader' || $staff) ? Social::url($f->proof_path) : null,
            'verifiedAt' => $f->verified_at ? Presenter::ms($f->verified_at) : null,
            'canManage' => $manage,
            'isLeader' => $myRole === 'leader',
            'requestsCount' => $manage ? DB::table('family_join_requests')->where('family_id', $f->id)->count() : 0,
            'union' => $union ? ['id' => $union->id, 'name' => $union->name, 'tag' => $union->tag, 'status' => $union->status, 'role' => $union->family_role] : null,
        ];
    }

    /** @param  list<object>  $rows */
    public static function presentUnions(array $rows, User $me): array
    {
        if (! $rows) {
            return [];
        }
        $ids = array_map(fn ($u) => $u->id, $rows);
        $counts = DB::table('family_union_members')->whereIn('union_id', $ids)->groupBy('union_id')
            ->selectRaw('union_id, COUNT(*) as c')->pluck('c', 'union_id');
        $founders = DB::table('families')->whereIn('id', array_map(fn ($u) => $u->founder_family_id, $rows))->get()->keyBy('id');

        return array_map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'tag' => $u->tag,
            'description' => (string) $u->description,
            'avatar' => Social::url($u->avatar_path),
            'status' => $u->status,
            'familiesCount' => (int) ($counts[$u->id] ?? 0),
            'founder' => isset($founders[$u->founder_family_id]) ? self::present($founders[$u->founder_family_id], $me) : null,
            'createdAt' => Presenter::ms($u->created_at),
        ], $rows);
    }

    /** Родини, якими керує користувач (лідер) — від їхнього імені діють у союзах. */
    public static function ledFamilies(User $user): array
    {
        return DB::table('family_members as m')->join('families as f', 'f.id', '=', 'm.family_id')
            ->where('m.user_id', $user->id)->where('m.role', 'leader')
            ->select('f.*')->get()->all();
    }

    /** Сповістити лідера й заступників родини. */
    public static function notifyManagers(int $familyId, int $actorId, string $type, string $text = '', ?int $unionId = null): void
    {
        $ids = DB::table('family_members')->where('family_id', $familyId)->whereIn('role', ['leader', 'deputy'])->pluck('user_id');
        foreach ($ids as $uid) {
            self::notify($uid, $actorId, $type, $familyId, $unionId, $text);
        }
    }

    public static function notify(int $userId, int $actorId, string $type, ?int $familyId, ?int $unionId = null, string $text = ''): void
    {
        if ($userId === $actorId) {
            return;
        }
        DB::table('social_notifications')->insert([
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'family_id' => $familyId,
            'union_id' => $unionId,
            'text' => mb_substr($text, 0, 200),
            'created_at' => now(),
        ]);
    }
}
