<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Архів «Мої дані»: pending → ready (або failed); файл на приватному диску, діє 7 днів.
 *
 * @property int $id
 * @property int $user_id
 * @property string $status
 * @property string|null $path
 * @property int $size
 * @property string|null $error
 * @property Carbon|null $ready_at
 * @property Carbon|null $expires_at
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'status', 'path', 'size', 'error', 'ready_at', 'expires_at'])]
class DataExport extends Model
{
    public const DAYS = 7;

    protected function casts(): array
    {
        return ['ready_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function downloadable(): bool
    {
        return $this->status === 'ready' && $this->path !== null && $this->expires_at?->isFuture();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->downloadable() ? 'ready' : ($this->status === 'ready' ? 'expired' : $this->status),
            'size' => $this->size,
            'created_at' => $this->created_at->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'url' => $this->downloadable() ? '/settings/account/exports/'.$this->id : null,
        ];
    }
}
