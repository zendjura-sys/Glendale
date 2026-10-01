<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $report_id
 * @property int $family_id
 * @property string $path
 * @property string $sha256
 * @property string|null $phash
 * @property int|null $width
 * @property int|null $height
 * @property int|null $size
 * @property-read FamilyReport $report
 */
#[Fillable(['report_id', 'family_id', 'path', 'sha256', 'phash', 'width', 'height', 'size'])]
class FamilyReportProof extends Model
{
    public const DISK = 'local';

    /**
     * @return BelongsTo<FamilyReport, $this>
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(FamilyReport::class, 'report_id');
    }
}
