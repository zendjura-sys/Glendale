<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Відеофон з бібліотеки (Адмінка → Дизайн): учасники GameCon+ обирають його в Налаштування → Вигляд.
 *
 * @property int $id
 * @property string $title
 * @property string|null $mobile_path
 * @property string|null $desktop_path
 * @property string|null $poster_path
 * @property bool $is_active
 * @property int $position
 */
#[Fillable(['title', 'mobile_path', 'desktop_path', 'poster_path', 'is_active', 'position', 'created_by'])]
class VideoBackground extends Model
{
    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'position' => 'integer'];
    }

    /**
     * @return array{id: int, title: string, mobile: string|null, desktop: string|null, poster: string|null}
     */
    public function card(): array
    {
        $url = fn (?string $path) => $path === null ? null : Storage::disk('public')->url($path);

        return [
            'id' => $this->id,
            'title' => $this->title,
            // Файл для смартфона; якщо його немає — той самий, що для ПК (і навпаки).
            'mobile' => $url($this->mobile_path ?? $this->desktop_path),
            'desktop' => $url($this->desktop_path ?? $this->mobile_path),
            'poster' => $url($this->poster_path),
        ];
    }
}
