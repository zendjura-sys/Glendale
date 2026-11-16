<?php

namespace App\Support;

use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * При м’якому видаленні звільняє унікальні slug/tag, щоб можна було створити
 * нову сутність з тією самою адресою чи тегом (унікальний індекс у БД не бачить deleted_at).
 */
trait FreesUniqueOnDelete
{
    protected static function bootFreesUniqueOnDelete(): void
    {
        static::deleting(function (Model $model) {
            if (method_exists($model, 'isForceDeleting') && $model->isForceDeleting()) {
                return;
            }
            $id = (int) $model->getKey();
            if ($id < 1) {
                return;
            }
            $dirty = false;
            if ($model->isFillable('slug') || array_key_exists('slug', $model->getAttributes())) {
                $slug = (string) $model->getAttribute('slug');
                $suffix = '-d'.$id;
                if ($slug !== '' && ! str_ends_with($slug, $suffix)) {
                    $max = match (true) {
                        $model instanceof Community => 32,
                        $model instanceof Clan => 80,
                        $model instanceof Family => 60,
                        default => 60,
                    };
                    $model->setAttribute('slug', Str::limit($slug, max(1, $max - strlen($suffix)), '').$suffix);
                    $dirty = true;
                }
            }
            if ($model->isFillable('tag') || array_key_exists('tag', $model->getAttributes())) {
                $tag = (string) $model->getAttribute('tag');
                // Тег сім’ї/клану короткий (≤8) — замінюємо на D{id}, щоб унікальний (server_id, tag) звільнився.
                if ($tag !== '' && ! preg_match('/\AD\d+\z/', $tag)) {
                    $model->setAttribute('tag', Str::upper(Str::substr('D'.$id, 0, 8)));
                    $dirty = true;
                }
            }
            if ($dirty) {
                $model->saveQuietly();
            }
        });
    }
}
