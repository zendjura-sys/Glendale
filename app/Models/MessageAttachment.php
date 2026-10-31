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
 * @property string $disk
 * @property string $path
 * @property string|null $name
 * @property string|null $mime
 * @property int|null $width
 * @property int|null $height
 * @property int|null $size
 * @property int|null $duration
 * @property array<string, mixed>|null $meta
 * @property int $position
 */
#[Fillable(['type', 'disk', 'path', 'name', 'mime', 'width', 'height', 'size', 'duration', 'meta', 'position'])]
class MessageAttachment extends Model
{
    public const TYPE_IMAGE = 'image';

    public const TYPE_FILE = 'file';

    public const TYPE_VOICE = 'voice';

    public const TYPE_VIDEO_NOTE = 'video_note';

    /** Документи зберігаються поза публічним диском і віддаються лише учасникам бесіди. */
    public const PRIVATE_DISK = 'local';

    protected $appends = ['url'];

    /** Розширення текстових файлів, які можна показати прямо в чаті. */
    public const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'log', 'ini', 'cfg', 'xml', 'yml', 'yaml'];

    /**
     * Як показати документ без завантаження: pdf, text, image, audio, video або null (лише завантажити).
     */
    public static function previewKind(?string $mime, ?string $name): ?string
    {
        $mime = strtolower((string) $mime);
        $extension = strtolower(pathinfo((string) $name, PATHINFO_EXTENSION));

        return match (true) {
            $mime === 'application/pdf' || $extension === 'pdf' => 'pdf',
            str_starts_with($mime, 'text/') || in_array($extension, self::TEXT_EXTENSIONS, true) => 'text',
            in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true) => 'image',
            in_array($mime, ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'], true) => 'audio',
            in_array($mime, ['video/mp4', 'video/webm'], true) => 'video',
            default => null,
        };
    }

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

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
        return Attribute::get(fn () => $this->disk === self::PRIVATE_DISK
            ? route('messages.attachments.download', $this, absolute: false)
            : Storage::disk($this->disk)->url($this->path));
    }
}
