<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Персонаж RP: роль гравця на конкретному сервері — з біографією, історією, фото й сім’єю.
 *
 * @property int $id
 * @property int $user_id
 * @property int $gta_server_id
 * @property int|null $family_id
 * @property string $name
 * @property int|null $age
 * @property string|null $occupation
 * @property string|null $bio
 * @property string|null $story
 * @property string|null $portrait_path
 * @property list<string>|null $photos
 * @property string $status
 * @property bool $is_main
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read string|null $portrait_url
 * @property-read User $user
 * @property-read GtaServer $server
 * @property-read Family|null $family
 */
#[Fillable(['user_id', 'gta_server_id', 'family_id', 'name', 'age', 'occupation', 'bio', 'story', 'portrait_path', 'photos', 'status', 'is_main'])]
class RpCharacter extends Model
{
    public const STATUSES = ['active' => 'Грає', 'retired' => 'На паузі', 'dead' => 'Загинув'];

    /** Скільки персонажів можна мати загалом і скільки фото в галереї. */
    public const LIMIT = 10;

    public const PHOTOS = 6;

    protected function casts(): array
    {
        return ['photos' => 'array', 'is_main' => 'boolean', 'age' => 'integer'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }

    /**
     * @return BelongsTo<Family, $this>
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function portraitUrl(): Attribute
    {
        return Attribute::get(fn () => $this->portrait_path ? Storage::disk('public')->url($this->portrait_path) : null);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'age' => $this->age,
            'occupation' => $this->occupation,
            'bio' => $this->bio,
            'portrait_url' => $this->portrait_url,
            'status' => $this->status,
            'status_label' => self::STATUSES[$this->status] ?? $this->status,
            'is_main' => $this->is_main,
            'href' => '/characters/'.$this->id,
            'server' => ['slug' => $this->server->slug, 'name' => $this->server->name, 'icon' => $this->server->icon],
            'family' => $this->family ? ['slug' => $this->family->slug, 'name' => $this->family->name, 'tag' => $this->family->tag] : null,
            'player' => ['name' => $this->user->name, 'username' => $this->user->username, 'avatar_url' => $this->user->avatar_url],
        ];
    }
}
