<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Варіант банера (A, B, C…): текст, кнопка, посилання, колір і вага в розподілі.
 *
 * @property int $id
 * @property int $promo_banner_id
 * @property string $label
 * @property string $title
 * @property string|null $text
 * @property string $cta
 * @property string $url
 * @property string $tone
 * @property int $weight
 * @property int $impressions
 * @property int $clicks
 * @property-read PromoBanner|null $banner
 */
#[Fillable(['promo_banner_id', 'label', 'title', 'text', 'cta', 'url', 'tone', 'weight', 'impressions', 'clicks'])]
class PromoBannerVariant extends Model
{
    public const TONES = ['indigo', 'sky', 'emerald', 'amber', 'rose'];

    /** @return BelongsTo<PromoBanner, $this> */
    public function banner(): BelongsTo
    {
        return $this->belongsTo(PromoBanner::class, 'promo_banner_id');
    }

    public function ctr(): float
    {
        return $this->impressions > 0 ? $this->clicks / $this->impressions : 0.0;
    }
}
