<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $message_id
 * @property string $type
 * @property string $path
 * @property string|null $mime
 * @property int|null $width
 * @property int|null $height
 * @property int|null $size
 * @property int $position
 */
#[Fillable(['type', 'path', 'mime', 'width', 'height', 'size', 'position'])]
class MessageAttachment extends Model
{
    public const TYPE_IMAGE = 'image';

    protected $appends = ['url'];

    /**
     * @return BelongsTo<Message, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }
}
