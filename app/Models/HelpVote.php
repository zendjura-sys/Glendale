<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Анонімні відповіді «Чи допомогла стаття?» для статті довідки («розділ/стаття»).
 *
 * @property int $id
 * @property string $article
 * @property int $helpful
 * @property int $unhelpful
 */
#[Fillable(['article', 'helpful', 'unhelpful'])]
class HelpVote extends Model
{
    protected $attributes = ['helpful' => 0, 'unhelpful' => 0];

    /** Зарахувати відповідь (атомарно, без гонок між запитами). */
    public static function record(string $article, bool $helpful): void
    {
        $vote = self::query()->firstOrCreate(['article' => $article]);
        $vote->increment($helpful ? 'helpful' : 'unhelpful');
    }
}
