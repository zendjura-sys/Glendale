<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Повітряна ціль зі зведення: тип, приблизне місце (центр міста чи області), курс і коли «згасає».
 *
 * @property int $id
 * @property string $type uav|missile|ballistic|kab|mig|artillery
 * @property string|null $region_slug
 * @property string|null $place_name
 * @property string $title
 * @property float $lat
 * @property float $lng
 * @property int|null $course_deg
 * @property int $speed_kmh
 * @property string|null $source_ref
 * @property list<string>|null $sources
 * @property int $confidence
 * @property Carbon $detected_at
 * @property Carbon $expires_at
 */
#[Fillable(['type', 'region_slug', 'place_name', 'title', 'lat', 'lng', 'course_deg', 'speed_kmh', 'source_ref', 'sources', 'confidence', 'detected_at', 'expires_at'])]
class AirThreat extends Model
{
    public const TYPES = ['uav', 'missile', 'ballistic', 'kab', 'mig', 'artillery'];

    protected function casts(): array
    {
        return ['sources' => 'array', 'confidence' => 'integer', 'lat' => 'float', 'lng' => 'float', 'detected_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'region' => $this->region_slug,
            'place' => $this->place_name,
            'title' => $this->title,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'course' => $this->course_deg,
            'speed' => $this->speed_kmh,
            'confidence' => $this->confidence,
            'sources' => $this->sources ?? [],
            'detected_at' => $this->detected_at->toIso8601String(),
            'expires_at' => $this->expires_at->toIso8601String(),
        ];
    }
}
