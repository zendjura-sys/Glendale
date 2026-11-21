<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Випуск подкасту.
 *
 * @property int $id
 * @property int $podcast_id
 * @property string $title
 * @property string|null $description
 * @property string $audio_path
 * @property int $duration
 * @property int $plays_count
 * @property Carbon $created_at
 */
#[Fillable(['podcast_id', 'title', 'description', 'audio_path', 'duration', 'plays_count'])]
class PodcastEpisode extends Model
{
    /** @return BelongsTo<Podcast, $this> */
    public function podcast(): BelongsTo
    {
        return $this->belongsTo(Podcast::class);
    }
}
