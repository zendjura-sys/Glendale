<?php

namespace App\Models;

use App\Support\Staff\StaffRoles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Роль команди, створена адміністратором: назва («Модератор чатів»), колір значка й розділи адмінки.
 *
 * @property int $id
 * @property string $name
 * @property string $color
 * @property list<string>|null $sections
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['name', 'color', 'sections'])]
class StaffRole extends Model
{
    /** Кольори значків ролей (як на сайті — назви кольорів Tailwind). */
    public const COLORS = ['sky', 'emerald', 'amber', 'rose', 'violet', 'orange', 'teal', 'slate'];

    protected function casts(): array
    {
        return ['sections' => 'array'];
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return list<string>
     */
    public function cleanSections(): array
    {
        return array_values(array_filter((array) $this->sections, fn ($s) => is_string($s) && array_key_exists($s, StaffRoles::SECTIONS)));
    }

    /**
     * @return array{id: int, name: string, color: string, sections: list<string>, members: int}
     */
    public function toCard(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'color' => $this->color, 'sections' => $this->cleanSections(), 'members' => (int) ($this->users_count ?? 0)];
    }
}
