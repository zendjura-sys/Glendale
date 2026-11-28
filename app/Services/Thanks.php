<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\GameGuide;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * «Подякувати» під гідом чи корисним коментарем. Подяки копляться в профілі автора
 * як показник корисності. Собі дякувати не можна; одна подяка на людину й запис.
 */
class Thanks
{
    public const KINDS = ['guide', 'comment'];

    /** @var array<string, array<int, true>> */
    private array $mine = [];

    /**
     * @return array{thanked: bool, count: int}
     */
    public function toggle(User $user, string $kind, int $id): array
    {
        $owner = $this->owner($kind, $id);
        abort_if($owner === null, 404);
        abort_if($owner === $user->id, 422, 'Собі дякувати не можна.');
        $query = DB::table('thanks')->where(['user_id' => $user->id, 'kind' => $kind, 'subject_id' => $id]);
        if ($query->exists()) {
            $query->delete();
            $thanked = false;
        } else {
            DB::table('thanks')->insertOrIgnore(['user_id' => $user->id, 'owner_id' => $owner, 'kind' => $kind, 'subject_id' => $id, 'created_at' => now()]);
            $thanked = true;
        }
        unset($this->mine[$user->id.':'.$kind]);

        return ['thanked' => $thanked, 'count' => $this->count($kind, $id)];
    }

    public function has(User $user, string $kind, int $id): bool
    {
        $key = $user->id.':'.$kind;
        $this->mine[$key] ??= array_fill_keys(
            DB::table('thanks')->where('user_id', $user->id)->where('kind', $kind)->pluck('subject_id')->map(fn ($v) => (int) $v)->all(),
            true,
        );

        return isset($this->mine[$key][$id]);
    }

    public function count(string $kind, int $id): int
    {
        return DB::table('thanks')->where('kind', $kind)->where('subject_id', $id)->count();
    }

    /** Скільки подяк зібрав автор. */
    public function received(User $user): int
    {
        return DB::table('thanks')->where('owner_id', $user->id)->count();
    }

    private function owner(string $kind, int $id): ?int
    {
        $owner = match ($kind) {
            'guide' => GameGuide::query()->whereKey($id)->value('user_id'),
            'comment' => Comment::query()->whereKey($id)->value('user_id'),
            default => null,
        };

        return is_numeric($owner) ? (int) $owner : null;
    }
}
