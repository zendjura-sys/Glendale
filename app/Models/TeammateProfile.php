<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Анкета для підбору тиммейтів.
 *
 * @property int $id
 * @property int $user_id
 * @property list<int>|null $games
 * @property list<string>|null $languages
 * @property list<string>|null $times
 * @property string|null $skill
 * @property string|null $platform
 * @property bool $mic
 * @property string|null $note
 * @property bool $visible
 * @property Carbon|null $looking_until
 * @property Carbon $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'games', 'languages', 'times', 'skill', 'platform', 'mic', 'note', 'visible', 'looking_until'])]
class TeammateProfile extends Model
{
    /** Коли зазвичай грає. */
    public const TIMES = ['morning' => 'Вранці', 'day' => 'Вдень', 'evening' => 'Ввечері', 'night' => 'Вночі', 'weekend' => 'На вихідних'];

    /** Рівень гри — порівнюється за відстанню (сусідні рівні теж підходять). */
    public const SKILLS = ['new' => 'Новачок', 'casual' => 'Для душі', 'mid' => 'Впевнено', 'pro' => 'Профі'];

    public const LANGUAGES = ['uk' => 'Українська', 'en' => 'English', 'pl' => 'Polski', 'de' => 'Deutsch'];

    protected $attributes = ['mic' => false, 'visible' => true];

    protected function casts(): array
    {
        return ['games' => 'array', 'languages' => 'array', 'times' => 'array', 'mic' => 'boolean', 'visible' => 'boolean', 'looking_until' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isLooking(): bool
    {
        return $this->looking_until !== null && $this->looking_until->isFuture();
    }
}
