<?php

namespace App\Families;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Запис належить родині: запити моделі автоматично обмежені активною
 * родиною (FamilyContext), новий запис отримує її family_id сам. Так
 * інструменти системи родин (звіти, банк, …) працюють для кожної родини
 * окремо, не переписуючи кожен запит у модулях.
 *
 * Обійти межу (наприклад, звіт по всій платформі для адміна) —
 * Model::withoutFamilyScope().
 */
trait BelongsToFamily
{
    public static function bootBelongsToFamily(): void
    {
        static::addGlobalScope('family', function (Builder $query) {
            $id = FamilyContext::id();
            if ($id !== null) {
                $query->where($query->getModel()->qualifyColumn('family_id'), $id);
            }
        });

        static::creating(function (Model $model) {
            if ($model->getAttribute('family_id') === null) {
                $model->setAttribute('family_id', FamilyContext::id());
            }
        });
    }

    public static function withoutFamilyScope(): Builder
    {
        return static::withoutGlobalScope('family');
    }
}
