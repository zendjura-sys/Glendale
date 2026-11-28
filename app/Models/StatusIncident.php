<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Інцидент на сторінці статусу: заголовок, серйозність, поточний стан і хід робіт (updates).
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $title
 * @property string $severity minor|major
 * @property string $status investigating|identified|monitoring|resolved
 * @property list<array{status: string, message: string, at: string}>|null $updates
 * @property Carbon $started_at
 * @property Carbon|null $resolved_at
 */
#[Fillable(['user_id', 'title', 'severity', 'status', 'updates', 'started_at', 'resolved_at'])]
class StatusIncident extends Model
{
    public const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

    public const SEVERITIES = ['minor', 'major'];

    protected function casts(): array
    {
        return ['updates' => 'array', 'started_at' => 'datetime', 'resolved_at' => 'datetime'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'severity' => $this->severity,
            'status' => $this->status,
            'updates' => array_reverse($this->updates ?? []),
            'started_at' => $this->started_at->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
        ];
    }
}
